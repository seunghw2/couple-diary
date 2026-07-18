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
    private final PlaceNicknameRepository placeNicknameRepository;
    private final CommentRepository commentRepository;
    private final com.today.upload.PhotoUrlSigner photoUrlSigner;
    private final com.today.upload.PhotoFileStore photoFileStore;
    private final DiaryDayFactory dayFactory;
    private final NotificationService notificationService;

    private static final long EDIT_WINDOW_HOURS = 24;
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
            if (entries.isEmpty()) continue; // 양쪽 다 글이 없는 빈 날(고아/삭제 잔여)은 달력에서 숨김
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
                    List.of(), null, null, List.of(), null, List.of(), List.of());
        }
        DiaryDay day = dayOpt.get();
        List<DiaryEntry> entries = entryRepository.findByDay_Id(day.getId());

        DiaryEntry mine = entries.stream()
                .filter(e -> e.getAuthor().getId().equals(userId)).findFirst().orElse(null);
        DiaryEntry partner = entries.stream()
                .filter(e -> !e.getAuthor().getId().equals(userId)).findFirst().orElse(null);

        DayStatus status = statusOf(mine != null, partner != null);

        // 질문은 개인별 — 내가 고른 질문을 돌려준다(아직 안 썼으면 빈 목록 → 새로 고르기).
        List<QuestionResponse> questions = resolveQuestions(
                day.getMode(), mine != null ? mine.getQuestionIds() : List.of());

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

        String repPhoto = day.getRepPhotoUrl() != null && !day.getRepPhotoUrl().isBlank()
                ? photoUrlSigner.signRelative(day.getRepPhotoUrl()) : null;
        return new DayDetail(date.toString(), status, day.getMode(), day.getTemplateType(),
                questions, myView, partnerView, comments, repPhoto, toPointViews(day.getPlaces()),
                mergedPhotos(entries));
    }

    // 상세 화면에서 공유 사진만 추가/삭제(일기 수정창과 무관). 내 일기가 있어야 사진을 붙일 수 있다.
    @Transactional
    public DayDetail updateDayPhotos(Long userId, LocalDate date, List<String> photoUrls) {
        Couple couple = coupleService.requireCouple(userId);
        DiaryDay day = dayRepository.findByCouple_IdAndDate(couple.getId(), date)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND));
        DiaryEntry mine = entryRepository.findByDay_IdAndAuthor_Id(day.getId(), userId)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND));
        reconcileSharedPhotos(day, mine, photoUrls);
        return detail(userId, date);
    }

    // 사진을 커플 공용 세트로 재조정. 인자가 "유지할 전체 목록"이다.
    // 그날 사진(두 entry 통합) 중 목록에 없는 건 삭제(파일 포함), 새 url은 내 entry에 추가.
    private void reconcileSharedPhotos(DiaryDay day, DiaryEntry myEntry, List<String> photoUrls) {
        if (photoUrls == null) return;
        java.util.LinkedHashSet<String> submitted = new java.util.LinkedHashSet<>();
        for (String u : photoUrls) {
            if (u == null || u.isBlank()) continue;
            int qi = u.indexOf('?');
            submitted.add(qi >= 0 ? u.substring(0, qi) : u);
        }
        List<Long> entryIds = entryRepository.findByDay_Id(day.getId()).stream().map(DiaryEntry::getId).toList();
        Set<String> existing = new HashSet<>();
        List<String> removed = new ArrayList<>();
        for (Photo p : photoRepository.findByEntry_IdIn(entryIds)) {
            if (p.getUrl() == null || p.getUrl().isBlank()) continue;
            if (submitted.contains(p.getUrl())) {
                existing.add(p.getUrl());
            } else {
                removed.add(p.getUrl());
                photoRepository.delete(p);
            }
        }
        for (String bare : submitted) {
            if (!existing.contains(bare)) {
                photoRepository.save(Photo.builder().entry(myEntry).url(bare).build());
            }
        }
        photoRepository.flush();
        if (!removed.isEmpty()) {
            photoFileStore.deleteByUrls(removed);
            if (day.getRepPhotoUrl() != null && removed.contains(day.getRepPhotoUrl())) {
                day.setRepPhotoUrl(null);
                dayRepository.save(day);
            }
        }
    }

    // 커플 공용 사진: 두 사람 entry의 업로드 사진을 합쳐 중복(url) 제거 후 서명. 잠금과 무관하게 항상 노출.
    private List<PhotoView> mergedPhotos(List<DiaryEntry> entries) {
        List<Long> ids = entries.stream().map(DiaryEntry::getId).toList();
        if (ids.isEmpty()) return List.of();
        List<PhotoView> out = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (Photo p : photoRepository.findByEntry_IdIn(ids)) {
            if (p.getUrl() == null || p.getUrl().isBlank()) continue;
            if (!seen.add(p.getUrl())) continue;
            out.add(new PhotoView(p.getId(), p.getColorSeed(), photoUrlSigner.signRelative(p.getUrl())));
        }
        return out;
    }

    // ================= 이전 장소 추천 =================
    @Transactional(readOnly = true)
    public LocationsResponse recentLocations(Long userId) {
        Couple couple = coupleService.requireCouple(userId);
        var page = org.springframework.data.domain.PageRequest.of(0, 20);
        List<String> locations = entryRepository.findDistinctLocationsByCouple(couple.getId(), page);
        List<DiaryDtos.LocationCount> counts = entryRepository
                .findLocationCountsByCouple(couple.getId(), page).stream()
                .map(p -> buildLocationCount(couple.getId(), p.getName(), p.getCount()))
                .toList();
        List<DiaryDtos.PlaceNicknameView> nicknames = placeNicknameRepository
                .findByCouple_Id(couple.getId()).stream()
                .map(pn -> new DiaryDtos.PlaceNicknameView(pn.getName(), pn.getNickname()))
                .toList();
        return new LocationsResponse(locations, counts, nicknames);
    }

    // ================= 장소 별명 upsert / clear =================
    // nickname이 blank면 별명 삭제(clear), 아니면 upsert.
    @Transactional
    public void setNickname(Long userId, String name, String nickname) {
        if (name == null || name.isBlank()) {
            throw new ApiException(ErrorCode.INVALID_INPUT);
        }
        Couple couple = coupleService.requireCouple(userId);
        String cleanName = name.trim();
        PlaceNickname existing = placeNicknameRepository
                .findByCouple_IdAndName(couple.getId(), cleanName).orElse(null);

        if (nickname == null || nickname.isBlank()) {
            if (existing != null) placeNicknameRepository.delete(existing);
            return;
        }
        String cleanNick = nickname.trim();
        if (existing != null) {
            existing.setNickname(cleanNick);
        } else {
            placeNicknameRepository.save(PlaceNickname.builder()
                    .couple(couple).name(cleanName).nickname(cleanNick).build());
        }
    }

    // 커플 공유 장소 저장 + 집계(지도/장소) 호환을 위해 그날 모든 entry.locations에 미러링.
    private void applySharedPlaces(DiaryDay day, UpsertEntryRequest req) {
        if (req.places() == null) return;
        List<LocationPoint> pts = new ArrayList<>();
        for (DiaryDtos.LocationPointInput p : req.places()) {
            if (p == null || p.name() == null || p.name().isBlank()) continue;
            pts.add(new LocationPoint(p.name().trim(), p.lat(), p.lng(), p.category()));
        }
        day.applyPlaces(pts);
        dayRepository.save(day);

        List<String> names = day.getPlaces().stream().map(LocationPoint::getName).toList();
        for (DiaryEntry e : entryRepository.findByDay_Id(day.getId())) {
            e.applyLocations(names);
            e.applyLocationPoints(new ArrayList<>(day.getPlaces()));
        }
    }

    private List<DiaryDtos.LocationPointView> toPointViews(List<LocationPoint> pts) {
        List<DiaryDtos.LocationPointView> out = new ArrayList<>();
        for (LocationPoint p : pts) {
            out.add(new DiaryDtos.LocationPointView(p.getName(), p.getLat(), p.getLng(), p.getCategory()));
        }
        return out;
    }

    // 지도 목록용: 한 장소의 대표 사진(가장 최근 방문일의 사진) + 최근 방문일.
    private DiaryDtos.LocationCount buildLocationCount(Long coupleId, String name, long count) {
        List<DiaryEntry> entries = entryRepository.findByCoupleAndLocation(coupleId, name);
        if (entries.isEmpty()) {
            return new DiaryDtos.LocationCount(name, count, null, null);
        }
        DiaryDay recentDay = entries.get(0).getDay(); // date desc → 첫 항목이 최근
        String recentDate = recentDay.getDate().toString();
        String thumb;
        if (recentDay.getRepPhotoUrl() != null && !recentDay.getRepPhotoUrl().isBlank()) {
            thumb = photoUrlSigner.signRelative(recentDay.getRepPhotoUrl()); // 최근 일기의 대표 사진
        } else {
            // 대표 미지정 → 최근 방문일부터 첫 사진으로 폴백
            List<Long> ids = entries.stream().map(DiaryEntry::getId).toList();
            Map<Long, List<Photo>> byEntry = photoRepository.findByEntry_IdIn(ids).stream()
                    .collect(Collectors.groupingBy(p -> p.getEntry().getId()));
            thumb = null;
            outer:
            for (DiaryEntry e : entries) {
                for (Photo p : byEntry.getOrDefault(e.getId(), List.of())) {
                    if (p.getUrl() != null && !p.getUrl().isBlank()) {
                        thumb = photoUrlSigner.signRelative(p.getUrl());
                        break outer;
                    }
                }
            }
        }
        return new DiaryDtos.LocationCount(name, count, thumb, recentDate);
    }

    // ================= 장소 상세(그 장소에 쌓인 기록) =================
    @Transactional(readOnly = true)
    public PlaceDetailResponse placeDetail(Long userId, String name) {
        if (name == null || name.isBlank()) {
            throw new ApiException(ErrorCode.INVALID_INPUT);
        }
        Couple couple = coupleService.requireCouple(userId);
        String cleanName = name.trim();

        String nickname = placeNicknameRepository
                .findByCouple_IdAndName(couple.getId(), cleanName)
                .map(PlaceNickname::getNickname).orElse(null);

        // 이 장소를 포함하는 모든 entry (day.date desc)
        List<DiaryEntry> entries = entryRepository.findByCoupleAndLocation(couple.getId(), cleanName);
        if (entries.isEmpty()) {
            return new PlaceDetailResponse(cleanName, nickname, 0, List.of());
        }

        // 사진/답 배치 로딩
        List<Long> entryIds = entries.stream().map(DiaryEntry::getId).toList();
        Map<Long, List<Photo>> photosByEntry = photoRepository.findByEntry_IdIn(entryIds).stream()
                .collect(Collectors.groupingBy(p -> p.getEntry().getId()));
        Map<Long, List<EntryAnswer>> answersByEntry = new HashMap<>();
        for (Long eid : entryIds) {
            answersByEntry.put(eid, answerRepository.findByEntry_Id(eid));
        }

        // 날짜별로 묶어 집계 (한 날짜 = 한 항목)
        // entries는 이미 date desc; LinkedHashMap로 순서 보존.
        Map<LocalDate, List<DiaryEntry>> byDate = new LinkedHashMap<>();
        for (DiaryEntry e : entries) {
            byDate.computeIfAbsent(e.getDay().getDate(), k -> new ArrayList<>()).add(e);
        }

        List<PlaceDetailEntry> out = new ArrayList<>();
        for (Map.Entry<LocalDate, List<DiaryEntry>> ent : byDate.entrySet()) {
            LocalDate date = ent.getKey();
            List<DiaryEntry> dayEntries = ent.getValue();

            boolean mine = dayEntries.stream().anyMatch(e -> e.getAuthor().getId().equals(userId));
            boolean partner = dayEntries.stream().anyMatch(e -> !e.getAuthor().getId().equals(userId));

            // 그 날짜의 대표 사진(커플 공유) 우선, 없으면 첫 사진 폴백.
            String thumbUrl = null;
            DiaryDay theDay = dayEntries.get(0).getDay();
            if (theDay.getRepPhotoUrl() != null && !theDay.getRepPhotoUrl().isBlank()) {
                thumbUrl = photoUrlSigner.signRelative(theDay.getRepPhotoUrl());
            } else {
                for (DiaryEntry e : dayEntries) {
                    for (Photo p : photosByEntry.getOrDefault(e.getId(), List.of())) {
                        if (p.getUrl() != null && !p.getUrl().isBlank()) { thumbUrl = photoUrlSigner.signRelative(p.getUrl()); break; }
                    }
                    if (thumbUrl != null) break;
                }
            }

            String snippet = null;
            for (DiaryEntry e : dayEntries) {
                for (EntryAnswer a : answersByEntry.getOrDefault(e.getId(), List.of())) {
                    if (a.getText() != null && !a.getText().isBlank()) {
                        snippet = trimSnippet(a.getText());
                        break;
                    }
                }
                if (snippet != null) break;
            }

            out.add(new PlaceDetailEntry(date.toString(), thumbUrl, snippet, mine, partner));
        }

        return new PlaceDetailResponse(cleanName, nickname, out.size(), out);
    }

    private static final int SNIPPET_LEN = 40;

    private String trimSnippet(String text) {
        String t = text.trim();
        return t.length() <= SNIPPET_LEN ? t : t.substring(0, SNIPPET_LEN) + "...";
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
        // (mode는 첫 작성자가 정한 걸 따르되, 질문 선택은 각자 개별이다)

        DiaryEntry entry = entryRepository.findByDay_IdAndAuthor_Id(day.getId(), userId).orElse(null);
        boolean isNew = entry == null;

        // 이 사람이 고른 질문(개인별). 답 입력의 질문 범위도 이걸로 검증.
        List<Long> myQuestionIds = resolveMyQuestionIds(day, entry, req);
        validateAnswersAgainstQuestionIds(day.getMode(), myQuestionIds, req.answers());
        if (isNew) {
            entry = DiaryEntry.builder()
                    .day(day).author(author)
                    .rating(req.rating()).mood(req.mood())
                    .build();
            applyLocations(entry, req);
            entry.applyQuestionIds(myQuestionIds);
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
            applyLocations(entry, req);
            entry.applyQuestionIds(myQuestionIds);
            // 부분 수정 지원: null = 변경 안 함(삭제 스킵), 빈 배열 = 전체 삭제
            if (req.answers() != null) {
                answerRepository.deleteByEntry_Id(entry.getId());
                answerRepository.flush();
            }
            // 사진(url)은 커플 공용 → 아래 reconcileSharedPhotos에서 통합 처리. 여기선 seed(폴백)만.
            if (req.photoSeeds() != null) {
                photoRepository.deleteByEntry_IdAndUrlIsNull(entry.getId());
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
        // 사진(url)은 커플 공용 목록으로 재조정: 요청 세트에 없는 그날 사진(누구 것이든)은 삭제,
        // 새 url은 내 entry에 추가. → 한 명이 올리면 둘 다 보고, 둘 다 삭제 가능.
        reconcileSharedPhotos(day, entry, req.photoUrls());

        // 그날 대표 사진(커플 공유). 서명 쿼리(?exp=..&sig=..)는 떼고 bare 경로만 저장.
        if (req.repPhotoUrl() != null) {
            String rep = req.repPhotoUrl().trim();
            if (rep.isEmpty()) {
                day.setRepPhotoUrl(null);
            } else {
                int qi = rep.indexOf('?');
                day.setRepPhotoUrl(qi >= 0 ? rep.substring(0, qi) : rep);
            }
            dayRepository.save(day);
        }

        // 커플 공유 장소 목록(작성 화면 '다녀온 장소'). 요청에 있으면 day에 저장하고 각 entry에 미러링.
        applySharedPlaces(day, req);

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

    // 장소 저장 규칙: locations가 오면 그걸 사용(+locationName=첫 장소).
    // locations null이고 locationName만 오면 locations=[locationName].
    // 둘 다 null이면 변경 안 함. 빈 배열이면 전체 삭제.
    private void applyLocations(DiaryEntry entry, UpsertEntryRequest req) {
        if (req.locations() != null) {
            entry.applyLocations(req.locations());
        } else if (req.locationName() != null) {
            entry.applyLocations(List.of(req.locationName()));
        }
        // 좌표 메타(지도에서 콕 찍기). locationPoints가 오면 통째로 교체(하위호환: 안 오면 유지).
        if (req.locationPoints() != null) {
            entry.applyLocationPoints(req.locationPoints().stream()
                    .map(pt -> new LocationPoint(pt.name(), pt.lat(), pt.lng(), pt.category()))
                    .toList());
        }
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

        // 이 일기의 사진 파일도 디스크에서 정리(고아 방지). 그날 대표사진이 여기였으면 해제.
        List<String> photoUrls = photoRepository.findByEntry_Id(entry.getId()).stream()
                .map(Photo::getUrl).filter(u -> u != null).toList();
        answerRepository.deleteByEntry_Id(entry.getId());
        photoRepository.deleteByEntry_Id(entry.getId());
        entryRepository.delete(entry);
        entryRepository.flush();
        photoFileStore.deleteByUrls(photoUrls);
        if (day.getRepPhotoUrl() != null && photoUrls.contains(day.getRepPhotoUrl())) {
            day.setRepPhotoUrl(null);
            dayRepository.save(day);
        }

        // 양쪽 entry가 모두 없으면 DiaryDay(및 댓글)도 삭제
        if (entryRepository.findByDay_Id(day.getId()).isEmpty()) {
            commentRepository.deleteByDay_Id(day.getId());
            dayRepository.delete(day);
        }
    }

    // ================= 일기 날짜 이동 =================
    // 내 커플의 date DiaryDay 전체(양쪽 entry·answers·photos·댓글)를 targetDate로 이동.
    // 엔트리 등은 day를 참조하므로 DiaryDay.date만 바꾸면 함께 따라감.
    @Transactional
    public DayDetail moveDay(Long userId, LocalDate date, LocalDate targetDate) {
        if (targetDate == null) {
            throw new ApiException(ErrorCode.INVALID_INPUT);
        }
        // 미래(Asia/Seoul 기준) 이동 금지
        if (targetDate.isAfter(LocalDate.now(KST))) {
            throw new ApiException(ErrorCode.INVALID_INPUT);
        }
        Couple couple = coupleService.requireCouple(userId);  // 커플 스코프 검증

        DiaryDay day = dayRepository.findByCouple_IdAndDate(couple.getId(), date)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND));

        // 제자리 이동은 그대로 반환
        if (!date.equals(targetDate)) {
            // 대상 날짜에 이미 DiaryDay가 있으면 충돌
            if (dayRepository.findByCouple_IdAndDate(couple.getId(), targetDate).isPresent()) {
                throw new ApiException(ErrorCode.DAY_ALREADY_EXISTS);
            }
            day.setDate(targetDate);
            dayRepository.flush();  // uk_day_couple_date 위반 시 조기 감지
        }
        return detail(userId, targetDate);
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

    // 이 사람이 이번에 쓸 질문 id 목록(개인별). QUESTION_PICK 모드에서만 의미.
    // 요청에 있으면 검증해 사용, 없으면 기존 내 선택 유지, 그것도 없으면 day 기본(하위호환).
    private List<Long> resolveMyQuestionIds(DiaryDay day, DiaryEntry existing, UpsertEntryRequest req) {
        if (day.getMode() != DiaryMode.QUESTION_PICK) return List.of();
        if (req.questionIds() != null && !req.questionIds().isEmpty()) {
            if (req.questionIds().size() > MAX_PICK_QUESTIONS) {
                throw new ApiException(ErrorCode.INVALID_INPUT);
            }
            return validateQuestionIds(req.questionIds());
        }
        if (existing != null && !existing.getQuestionIds().isEmpty()) {
            return new ArrayList<>(existing.getQuestionIds());
        }
        return new ArrayList<>(day.getQuestionIds());
    }

    // QUESTION_PICK: answer.questionId는 이 사람이 고른 질문 안에 있어야 함
    // TEMPLATE: questionId 있는 답 거부(promptKey만 허용)
    private void validateAnswersAgainstQuestionIds(DiaryMode mode, List<Long> myQuestionIds, List<AnswerInput> answers) {
        if (answers == null || answers.isEmpty()) return;
        if (mode == DiaryMode.QUESTION_PICK) {
            Set<Long> allowed = new HashSet<>(myQuestionIds);
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

    // 개인별 질문 선택을 QuestionResponse로 해석(순서 유지). QUESTION_PICK가 아니거나 비면 빈 목록.
    private List<QuestionResponse> resolveQuestions(DiaryMode mode, List<Long> ids) {
        if (mode != DiaryMode.QUESTION_PICK || ids == null || ids.isEmpty()) {
            return List.of();
        }
        Map<Long, Question> byId = questionRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(Question::getId, q -> q));
        List<QuestionResponse> out = new ArrayList<>();
        for (Long id : ids) {
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
                .map(p -> new PhotoView(p.getId(), p.getColorSeed(), photoUrlSigner.signRelative(p.getUrl())))
                .toList();
        boolean editable = e.getEditableAfter() == null || LocalDateTime.now().isBefore(e.getEditableAfter());
        List<String> locations = new ArrayList<>(e.getLocations());
        List<DiaryDtos.LocationPointView> points = e.getLocationPoints().stream()
                .map(pt -> new DiaryDtos.LocationPointView(pt.getName(), pt.getLat(), pt.getLng(), pt.getCategory()))
                .toList();
        return new EntryView(e.getId(), e.getAuthor().getId(), e.getRating(), e.getMood(),
                e.getLocationName(), locations, points, answers, photos, e.getCreatedAt(), e.getEditableAfter(), editable);
    }

    private CommentView toCommentView(Comment c) {
        return new CommentView(c.getId(), c.getAuthor().getId(),
                c.getAuthor().getNickname(), c.getText(), c.getCreatedAt());
    }
}
