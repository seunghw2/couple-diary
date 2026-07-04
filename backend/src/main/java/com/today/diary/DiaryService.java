package com.today.diary;

import com.today.comment.Comment;
import com.today.comment.CommentDtos.CreateCommentRequest;
import com.today.comment.CommentRepository;
import com.today.common.ApiException;
import com.today.common.ErrorCode;
import com.today.couple.Couple;
import com.today.couple.CoupleService;
import com.today.diary.DiaryDtos.*;
import com.today.question.Question;
import com.today.question.QuestionDtos.QuestionResponse;
import com.today.question.QuestionRepository;
import com.today.user.User;
import com.today.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
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

    private static final long EDIT_WINDOW_HOURS = 3;

    // ================= 월간 목록 =================
    @Transactional(readOnly = true)
    public List<MonthEntrySummary> month(Long userId, int year, int month) {
        Couple couple = coupleService.requireCouple(userId);
        YearMonth ym = YearMonth.of(year, month);
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
    @Transactional
    public DayDetail upsert(Long userId, LocalDate date, UpsertEntryRequest req) {
        Couple couple = coupleService.requireCouple(userId);
        User author = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(ErrorCode.USER_NOT_FOUND));

        DiaryDay day = dayRepository.findByCouple_IdAndDate(couple.getId(), date)
                .orElse(null);

        // DiaryDay 없으면 내가 첫 작성자 → mode/질문세트 확정
        if (day == null) {
            List<Long> qIds = req.mode() == DiaryMode.QUESTION_PICK
                    ? validateQuestionIds(req.questionIds()) : List.of();
            day = DiaryDay.builder()
                    .couple(couple)
                    .date(date)
                    .mode(req.mode())
                    .templateType(req.mode() == DiaryMode.TEMPLATE ? req.templateType() : null)
                    .questionIds(qIds)
                    .build();
            day = dayRepository.save(day);
        }
        // (있으면 기존 mode/질문세트를 따른다 — 요청의 mode/questionIds 무시)

        DiaryEntry entry = entryRepository.findByDay_IdAndAuthor_Id(day.getId(), userId).orElse(null);
        if (entry == null) {
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
            // 기존 답/사진 교체
            answerRepository.deleteByEntry_Id(entry.getId());
            photoRepository.deleteByEntry_Id(entry.getId());
            answerRepository.flush();
            photoRepository.flush();
        }

        // 답 저장
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
        // 사진 저장
        if (req.photoSeeds() != null) {
            for (String seed : req.photoSeeds()) {
                photoRepository.save(Photo.builder().entry(entry).colorSeed(seed).build());
            }
        }

        return detail(userId, date);
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
                .map(p -> new PhotoView(p.getId(), p.getColorSeed()))
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
