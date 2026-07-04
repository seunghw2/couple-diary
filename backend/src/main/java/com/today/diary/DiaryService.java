package com.today.diary;

import com.today.comment.Comment;
import com.today.comment.CommentDtos.CreateCommentRequest;
import com.today.comment.CommentRepository;
import com.today.common.ApiException;
import com.today.common.ErrorCode;
import com.today.couple.Couple;
import com.today.couple.CoupleService;
import com.today.diary.DiaryDtos.*;
import com.today.notification.NotificationService;
import com.today.question.Question;
import com.today.question.QuestionDtos.QuestionResponse;
import com.today.question.QuestionRepository;
import com.today.user.User;
import com.today.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.time.DateTimeException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DiaryService {

    private final CoupleService coupleService;
    private final UserRepository userRepository;
    private final QuestionRepository questionRepository;
    private final DiaryDayRepository dayRepository;
    private final DiaryEntryRepository entryRepository;
    private final EntryAnswerRepository answerRepository;
    private final PhotoRepository photoRepository;
    private final CommentRepository commentRepository;
    private final DiaryDayFactory dayFactory;
    private final NotificationService notificationService;

    private static final long EDIT_WINDOW_HOURS = 3;
    private static final int MAX_PICK_QUESTIONS = 5;
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    // ================= 월간 목록 =================
    @Transactional(readOnly = true)
    public List<MonthEntrySummary> month(Long userId, int year, int month) {
        Couple couple = coupleService.requireCouple(userId);
        YearMonth ym;
        try {
            ym = YearMonth.of(year, month);
        } catch (DateTimeException e) {
            throw new ApiException(ErrorCode.INVALID_INPUT);
        }
        LocalDate start = ym.atDay(1);
        LocalDate end = ym.atEndOfMonth();

        List<DiaryDay> days = dayRepository.findByCouple_IdAndDateBetween(couple.getId(), start, end);
        if (days.isEmpty()) return List.of();

        List<Long> dayIds = days.stream().map(DiaryDay::getId).toList();
        Map<Long, List<DiaryEntry>> entriesByDay = entryRepository.findByDay_IdIn(dayIds).stream()
                .collect(Collectors.groupingBy(e -> e.getDay().getId()));

        List<Long> entryIds = entriesByDay.values().stream()
                .flatMap(List::stream).map(DiaryEntry::getId).toList();
        Map<Long, List<Photo>> photosByEntry = entryIds.isEmpty() ? Map.of()
                : photoRepository.findByEntry_IdIn(entryIds).stream()
                    .collect(Collectors.groupingBy(p -> p.getEntry().getId()));

        List<MonthEntrySummary> out = new ArrayList<>();
        for (DiaryDay day : days) {
            List<DiaryEntry> entries = entriesByDay.getOrDefault(day.getId(), List.of());
            boolean mine = entries.stream().anyMatch(e -> e.getAuthor().getId().equals(userId));
            boolean partner = entries.stream().anyMatch(e -> !e.getAuthor().getId().equals(userId));
            DayStatus status = statusOf(mine, partner);

            int photoCount = 0;
            String thumbSeed = null;
            for (DiaryEntry e : entries) {
                List<Photo> ps = photosByEntry.getOrDefault(e.getId(), List.of());
                photoCount += ps.size();
                if (thumbSeed == null && !ps.isEmpty()) thumbSeed = ps.get(0).getColorSeed();
            }
            out.add(new MonthEntrySummary(day.getDate().toString(), status, photoCount, thumbSeed, mine, partner));
        }
        out.sort(Comparator.comparing(MonthEntrySummary::date));
        return out;
    }

    // ================= 상세 =================
    @Transactional(readOnly = true)
    public DayDetail detail(Long userId, LocalDate date) {
        Couple couple = coupleService.requireCouple(userId);
        Optional<DiaryDay> dayOpt = dayRepository.findByCouple_IdAndDate(couple.getId(), date);

        if (dayOpt.isEmpty()) {
            return new DayDetail(date.toString(), DayStatus.EMPTY, null, null,
                    List.of(), null, null, List.of());
        }
        DiaryDay day = dayOpt.get();
        List<DiaryEntry> entries = entryRepository.findByDay_Id(day.getId());

        DiaryEntry mine = entries.stream()
                .filter(e -> e.getAuthor().getId().equals(userId)).findFirst().orElse(null);
        DiaryEntry partner = entries.stream()
                .filter(e -> !e.getAuthor().getId().equals(userId)).findFirst().orElse(null);

        DayStatus status = statusOf(mine != null, partner != null);

        List<QuestionResponse> questions = resolveQuestions(day);

        EntryView myView = mine == null ? null : toEntryView(mine);
        Object partnerView;
        if (partner == null) {
            partnerView = null;
        } else if (status == DayStatus.OPEN) {
            partnerView = toEntryView(partner);
        } else {
            partnerView = new LockedEntryView(true);
        }

        List<CommentView> comments = status == DayStatus.OPEN
                ? commentRepository.findByDay_IdOrderByCreatedAtAsc(day.getId()).stream()
                    .map(this::toCommentView).toList()
                : List.of();

        return new DayDetail(date.toString(), status, day.getMode(), day.getTemplateType(),
                questions, myView, partnerView, comments);
    }

    // ================= 작성/수정 upsert =================
    // READ_COMMITTED: 동시 첫 작성 경합 시 DiaryDayFactory(REQUIRES_NEW)가 커밋한
    // 행을 같은 트랜잭션의 재조회/응답 조회에서 볼 수 있어야 한다(MySQL RR 스냅샷 회피).
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public DayDetail upsert(Long userId, LocalDate date, UpsertEntryRequest req) {
        // 미래 날짜(Asia/Seoul 기준) 작성 차단
        if (date.isAfter(LocalDate.now(KST))) {
            throw new ApiException(ErrorCode.INVALID_INPUT);
        }

        Couple couple = coupleService.requireCouple(userId);
        User author = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(ErrorCode.USER_NOT_FOUND));

        DiaryDay day = dayRepository.findByCouple_IdAndDate(couple.getId(), date)
                .orElse(null);

        // DiaryDay 없으면 내가 첫 작성자 → mode/질문세트 확정
        if (day == null) {
            day = createDay(couple, date, req);
        }
        // (있으면 기존 mode/질문세트를 따른다 — 요청의 mode/questionIds 무시)

        // 답 입력의 질문 범위 검증 (저장 전에 수행)
        validateAnswersAgainstDay(day, req.answers());

        DiaryEntry entry = entryRepository.findByDay_IdAndAuthor_Id(day.getId(), userId).orElse(null);
        boolean isNew = entry == null;
        if (isNew) {
            entry = DiaryEntry.builder()
                    .day(day).author(author)
                    .rating(req.rating()).mood(req.mood()).locationName(req.locationName())
                    .build();
            entry = entryRepository.save(entry);
            entry.setEditableAfter(entry.getCreatedAt() == null
                    ? LocalDateTime.now().plusHours(EDIT_WINDOW_HOURS)
                    : entry.getCreatedAt().plusHours(EDIT_WINDOW_HOURS));
        } else {
            // 수정 창(생성+3h)이 지났으면 거부
            if (entry.getEditableAfter() != null && LocalDateTime.now().isAfter(entry.getEditableAfter())) {
                throw new ApiException(ErrorCode.ENTRY_NOT_EDITABLE);
            }
            entry.setRating(req.rating());
            entry.setMood(req.mood());
            entry.setLocationName(req.locationName());
            // 부분 수정 지원: null = 변경 안 함(삭제 스킵), 빈 배열 = 전체 삭제
            if (req.answers() != null) {
                answerRepository.deleteByEntry_Id(entry.getId());
                answerRepository.flush();
            }
            if (req.photoSeeds() != null) {
                photoRepository.deleteByEntry_IdAndUrlIsNull(entry.getId());
            }
            if (req.photoUrls() != null) {
                photoRepository.deleteByEntry_IdAndUrlIsNotNull(entry.getId());
            }
            if (req.photoSeeds() != null || req.photoUrls() != null) {
                photoRepository.flush();
            }
        }

        // 답 저장 (null이면 기존 유지)
        if (req.answers() != null) {
            for (AnswerInput a : req.answers()) {
                if (a.text() == null || a.text().isBlank()) continue;
                answerRepository.save(EntryAnswer.builder()
                        .entry(entry)
                        .questionId(a.questionId())
                        .promptKey(a.promptKey())
                        .text(a.text())
                        .build());
            }
        }
        // 사진 저장 (null이면 기존 유지)
        if (req.photoSeeds() != null) {
            for (String seed : req.photoSeeds()) {
                photoRepository.save(Photo.builder().entry(entry).colorSeed(seed).build());
            }
        }
        if (req.photoUrls() != null) {
            for (String url : req.photoUrls()) {
                if (url == null || url.isBlank()) continue;
                photoRepository.save(Photo.builder().entry(entry).url(url).build());
            }
        }

        // ===== 알림 트리거: 저장 후 그날 상태 재계산 =====
        // 상대 entry 존재 여부로 OPEN/LOCKED 판정. isNew=이번에 내 entry가 처음 생김.
        entryRepository.flush();
        User partner = partnerOf(couple, userId);
        boolean partnerWrote = partner != null
                && entryRepository.findByDay_IdAndAuthor_Id(day.getId(), partner.getId()).isPresent();
        boolean nowOpen = isNew && partnerWrote; // 방금 OPEN으로 전환
        // isNew가 아니어도(수정) 이미 OPEN이면 재알림 금지 → PARTNER_WROTE는 아직 LOCKED일 때만
        if (isNew) {
            notificationService.onEntryUpsert(author, partner, date, nowOpen);
        } else if (!partnerWrote) {
            // 내 수정인데 상대 아직 미작성 → PARTNER_WROTE dedup은 서비스에서 미읽음 검사로 막음
            notificationService.onEntryUpsert(author, partner, date, false);
        }

        return detail(userId, date);
    }

    // 커플 두 멤버 중 나 아닌 쪽
    private User partnerOf(Couple couple, Long userId) {
        User u1 = couple.getUser1();
        User u2 = couple.getUser2();
        if (u1.getId().equals(userId)) return u2;
        if (u2.getId().equals(userId)) return u1;
        return null;
    }

    // ================= 일기 삭제 =================
    @Transactional
    public void deleteEntry(Long userId, LocalDate date) {
        Couple couple = coupleService.requireCouple(userId);  // 커플 스코프 검증
        DiaryDay day = dayRepository.findByCouple_IdAndDate(couple.getId(), date)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND));
        DiaryEntry entry = entryRepository.findByDay_IdAndAuthor_Id(day.getId(), userId)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND));

        answerRepository.deleteByEntry_Id(entry.getId());
        photoRepository.deleteByEntry_Id(entry.getId());
        entryRepository.delete(entry);
        entryRepository.flush();

        // 양쪽 entry가 모두 없으면 DiaryDay(및 댓글)도 삭제
        if (entryRepository.findByDay_Id(day.getId()).isEmpty()) {
            commentRepository.deleteByDay_Id(day.getId());
            dayRepository.delete(day);
        }
    }

    // 첫 작성자용 DiaryDay 생성: 입력 검증 + 동시 생성 경합(uk_day_couple_date) 처리
    private DiaryDay createDay(Couple couple, LocalDate date, UpsertEntryRequest req) {
        List<Long> qIds;
        if (req.mode() == DiaryMode.QUESTION_PICK) {
            if (req.questionIds() == null || req.questionIds().isEmpty()
                    || req.questionIds().size() > MAX_PICK_QUESTIONS) {
                throw new ApiException(ErrorCode.INVALID_INPUT);
            }
            qIds = validateQuestionIds(req.questionIds());
        } else {
            if (req.templateType() == null || req.templateType().isBlank()) {
                throw new ApiException(ErrorCode.INVALID_INPUT);
            }
            qIds = List.of();
        }

        Long dayId;
        try {
            dayId = dayFactory.create(couple, date, req.mode(),
                    req.mode() == DiaryMode.TEMPLATE ? req.templateType() : null, qIds);
        } catch (DataIntegrityViolationException e) {
            // 상대가 같은 순간 먼저 생성함 → 기존 것을 사용 (get-or-create)
            dayId = null;
        }
        return (dayId != null
                ? dayRepository.findById(dayId)
                : dayRepository.findByCouple_IdAndDate(couple.getId(), date))
                .orElseThrow(() -> new ApiException(ErrorCode.INVALID_INPUT));
    }

    // QUESTION_PICK: answer.questionId는 그날 질문세트 안에 있어야 함
    // TEMPLATE: questionId 있는 답 거부(promptKey만 허용)
    private void validateAnswersAgainstDay(DiaryDay day, List<AnswerInput> answers) {
        if (answers == null || answers.isEmpty()) return;
        if (day.getMode() == DiaryMode.QUESTION_PICK) {
            Set<Long> allowed = new HashSet<>(day.getQuestionIds());
            for (AnswerInput a : answers) {
                if (a.questionId() == null || !allowed.contains(a.questionId())) {
                    throw new ApiException(ErrorCode.INVALID_INPUT);
                }
            }
        } else {
            for (AnswerInput a : answers) {
                if (a.questionId() != null) {
                    throw new ApiException(ErrorCode.INVALID_INPUT);
                }
            }
        }
    }

    // ================= 댓글 =================
    @Transactional(readOnly = true)
    public List<CommentView> comments(Long userId, LocalDate date) {
        DiaryDay day = requireOpenDay(userId, date);
        return commentRepository.findByDay_IdOrderByCreatedAtAsc(day.getId()).stream()
                .map(this::toCommentView).toList();
    }

    @Transactional
    public CommentView addComment(Long userId, LocalDate date, CreateCommentRequest req) {
        DiaryDay day = requireOpenDay(userId, date);
        User author = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(ErrorCode.USER_NOT_FOUND));
        Comment c = commentRepository.save(Comment.builder()
                .day(day).author(author).text(req.text()).build());

        // ===== 알림 트리거: 그 일기의 상대 작성자에게 COMMENT =====
        // day의 두 entry 작성자 중 나 아닌 쪽이 recipient (OPEN이므로 둘 다 존재)
        User recipient = entryRepository.findByDay_Id(day.getId()).stream()
                .map(DiaryEntry::getAuthor)
                .filter(u -> !u.getId().equals(userId))
                .findFirst().orElse(null);
        notificationService.onComment(author, recipient, date, req.text());

        return toCommentView(c);
    }

    // ================= helpers =================
    private DiaryDay requireOpenDay(Long userId, LocalDate date) {
        Couple couple = coupleService.requireCouple(userId);
        DiaryDay day = dayRepository.findByCouple_IdAndDate(couple.getId(), date)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND));
        List<DiaryEntry> entries = entryRepository.findByDay_Id(day.getId());
        boolean mine = entries.stream().anyMatch(e -> e.getAuthor().getId().equals(userId));
        boolean partner = entries.stream().anyMatch(e -> !e.getAuthor().getId().equals(userId));
        if (statusOf(mine, partner) != DayStatus.OPEN) {
            throw new ApiException(ErrorCode.DAY_LOCKED);
        }
        return day;
    }

    private DayStatus statusOf(boolean mine, boolean partner) {
        if (mine && partner) return DayStatus.OPEN;
        if (mine || partner) return DayStatus.LOCKED;
        return DayStatus.EMPTY;
    }

    private List<Long> validateQuestionIds(List<Long> ids) {
        if (ids == null || ids.isEmpty()) return List.of();
        List<Question> found = questionRepository.findAllById(ids);
        if (found.size() != new HashSet<>(ids).size()) {
            throw new ApiException(ErrorCode.QUESTION_NOT_FOUND);
        }
        return new ArrayList<>(ids);
    }

    private List<QuestionResponse> resolveQuestions(DiaryDay day) {
        if (day.getMode() != DiaryMode.QUESTION_PICK || day.getQuestionIds().isEmpty()) {
            return List.of();
        }
        Map<Long, Question> byId = questionRepository.findAllById(day.getQuestionIds()).stream()
                .collect(Collectors.toMap(Question::getId, q -> q));
        List<QuestionResponse> out = new ArrayList<>();
        for (Long id : day.getQuestionIds()) {
            Question q = byId.get(id);
            if (q != null) out.add(QuestionResponse.of(q));
        }
        return out;
    }

    private EntryView toEntryView(DiaryEntry e) {
        List<AnswerView> answers = answerRepository.findByEntry_Id(e.getId()).stream()
                .map(a -> new AnswerView(a.getQuestionId(), a.getPromptKey(), a.getText()))
                .toList();
        List<PhotoView> photos = photoRepository.findByEntry_Id(e.getId()).stream()
                .map(p -> new PhotoView(p.getId(), p.getColorSeed(), p.getUrl()))
                .toList();
        boolean editable = e.getEditableAfter() == null || LocalDateTime.now().isBefore(e.getEditableAfter());
        return new EntryView(e.getId(), e.getAuthor().getId(), e.getRating(), e.getMood(),
                e.getLocationName(), answers, photos, e.getCreatedAt(), e.getEditableAfter(), editable);
    }

    private CommentView toCommentView(Comment c) {
        return new CommentView(c.getId(), c.getAuthor().getId(),
                c.getAuthor().getNickname(), c.getText(), c.getCreatedAt());
    }
}
