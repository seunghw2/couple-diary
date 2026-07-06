package com.today.question;

import com.today.common.ApiException;
import com.today.common.ErrorCode;
import com.today.couple.Couple;
import com.today.couple.CoupleRepository;
import com.today.question.DailyQuestionDtos.*;
import com.today.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DateTimeException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * 오늘의 질문(Daily Question) 로직. 모두 KST 기준.
 *
 * <p>하루 흐름: 도착시각(arrivalTime) 전엔 BEFORE_ARRIVAL → 도착 후 풀에서 2개 배정(NEEDS_CHOICE)
 * → 한 명이 선택(NEEDS_ANSWER) → 각자 답을 봉인 → 둘 다 봉인되면 OPENED(양쪽 공개, 하트 반응 가능).</p>
 */
@Service
@RequiredArgsConstructor
public class QuestionService {

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private static final DateTimeFormatter HM = DateTimeFormatter.ofPattern("HH:mm");
    /** 새 질문 배정 시 회피할 최근 사용 일수(best-effort). */
    private static final int RECENT_AVOID_DAYS = 30;

    private final CoupleRepository coupleRepository;
    private final DailyQuestionRepository dailyQuestionRepository;
    private final QuestionAnswerRepository answerRepository;
    private final QuestionReactionRepository reactionRepository;
    private final QuestionSettingRepository settingRepository;
    private final QuestionPoolRepository poolRepository;

    // ===================== today =====================

    @Transactional
    public TodayResponse today(Long userId) {
        Couple couple = coupleRepository.findByMember(userId).orElse(null);
        if (couple == null) {
            return TodayResponse.notCoupled();
        }
        User me = memberOf(couple, userId);
        User partner = partnerOf(couple, userId);
        LocalDate today = LocalDate.now(KST);
        LocalTime now = LocalTime.now(KST);

        QuestionSetting setting = requireSetting(couple);
        String arrival = setting.getArrivalTime().format(HM);

        int streak = computeStreak(couple.getId(), today);
        Boolean missedYesterday = computeMissedYesterday(couple.getId(), today);

        List<DailyQuestion> todays = dailyQuestionRepository.findByCouple_IdAndDate(couple.getId(), today);

        // 아직 배정 전
        if (todays.isEmpty()) {
            if (now.isBefore(setting.getArrivalTime())) {
                return base(today, "BEFORE_ARRIVAL", arrival, streak, missedYesterday).build();
            }
            todays = assignToday(couple, today);
        }

        // 선택된 질문 찾기
        DailyQuestion chosen = todays.stream().filter(DailyQuestion::isChosen).findFirst().orElse(null);

        if (chosen == null) {
            // NEEDS_CHOICE — 후보 2개 노출
            List<Choice> choices = todays.stream()
                    .sorted((a, b) -> Integer.compare(a.getSlot(), b.getSlot()))
                    .map(dq -> new Choice(dq.getQuestion().getId(), dq.getQuestion().getText(), dq.getSlot()))
                    .toList();
            return base(today, "NEEDS_CHOICE", arrival, streak, missedYesterday)
                    .choices(choices)
                    .build();
        }

        // 선택 이후 상태
        boolean chosenByMe = chosen.getChosenBy() != null && chosen.getChosenBy().getId().equals(userId);
        Person chosenByPerson = chosen.getChosenBy() == null ? null
                : new Person(chosen.getChosenBy().getId(), chosen.getChosenBy().getNickname());
        QuestionView qv = new QuestionView(chosen.getQuestion().getId(), chosen.getQuestion().getText());

        QuestionAnswer myAns = answerRepository
                .findByDailyQuestion_IdAndAuthor_Id(chosen.getId(), userId).orElse(null);
        QuestionAnswer partnerAns = partner == null ? null : answerRepository
                .findByDailyQuestion_IdAndAuthor_Id(chosen.getId(), partner.getId()).orElse(null);

        boolean mySealed = myAns != null && myAns.getSealedAt() != null;
        boolean partnerSealed = partnerAns != null && partnerAns.getSealedAt() != null;

        var builder = base(today, null, arrival, streak, missedYesterday)
                .question(qv)
                .chosenBy(chosenByPerson)
                .chosenByMe(chosenByMe);

        if (!mySealed) {
            return builder.state("NEEDS_ANSWER").build();
        }

        // 내 답은 항상 text 노출
        AnswerView myView = new AnswerView(myAns.getId(), myAns.getText(), true, null, null);

        if (!partnerSealed) {
            return builder.state("WAITING_PARTNER")
                    .myAnswer(myView)
                    .partnerSealed(false)
                    .build();
        }

        // OPENED — 양쪽 공개 + 반응 정보
        boolean myAnsReactedByPartner = partner != null
                && reactionRepository.existsByAnswer_IdAndUser_Id(myAns.getId(), partner.getId());
        boolean myAnsReactedByMe = reactionRepository.existsByAnswer_IdAndUser_Id(myAns.getId(), userId);
        AnswerView myOpened = new AnswerView(myAns.getId(), myAns.getText(), true,
                myAnsReactedByPartner, myAnsReactedByMe);

        boolean pAnsReactedByPartner = partner != null
                && reactionRepository.existsByAnswer_IdAndUser_Id(partnerAns.getId(), partner.getId());
        boolean pAnsReactedByMe = reactionRepository.existsByAnswer_IdAndUser_Id(partnerAns.getId(), userId);
        AnswerView partnerView = new AnswerView(partnerAns.getId(), partnerAns.getText(), true,
                pAnsReactedByPartner, pAnsReactedByMe);

        return builder.state("OPENED")
                .myAnswer(myOpened)
                .partnerAnswer(partnerView)
                .partnerSealed(true)
                .build();
    }

    // ===================== choose =====================

    @Transactional
    public TodayResponse choose(Long userId, Long questionId) {
        Couple couple = coupleRepository.findByMember(userId)
                .orElseThrow(() -> new ApiException(ErrorCode.COUPLE_NOT_FOUND));
        User me = memberOf(couple, userId);
        LocalDate today = LocalDate.now(KST);

        List<DailyQuestion> todays = dailyQuestionRepository.findByCouple_IdAndDate(couple.getId(), today);
        if (todays.isEmpty()) {
            // 아직 배정 전인데 선택 시도 — 잘못된 입력
            throw new ApiException(ErrorCode.INVALID_INPUT);
        }

        // 이미 선택돼 있으면 관용적으로 today 반환
        boolean alreadyChosen = todays.stream().anyMatch(DailyQuestion::isChosen);
        if (alreadyChosen) {
            return today(userId);
        }

        DailyQuestion target = todays.stream()
                .filter(dq -> dq.getQuestion().getId().equals(questionId))
                .findFirst()
                .orElseThrow(() -> new ApiException(ErrorCode.INVALID_INPUT));

        target.setChosen(true);
        target.setChosenBy(me);
        // TODO: 상대에게 "질문이 선택됐어요" 알림

        return today(userId);
    }

    // ===================== answer =====================

    @Transactional
    public TodayResponse answer(Long userId, String rawText) {
        Couple couple = coupleRepository.findByMember(userId)
                .orElseThrow(() -> new ApiException(ErrorCode.COUPLE_NOT_FOUND));
        User me = memberOf(couple, userId);
        LocalDate today = LocalDate.now(KST);

        DailyQuestion chosen = dailyQuestionRepository
                .findByCouple_IdAndDateAndChosenTrue(couple.getId(), today)
                .orElseThrow(() -> new ApiException(ErrorCode.INVALID_INPUT));

        String text = rawText == null ? "" : rawText.trim();
        if (text.isEmpty() || text.length() > 2000) {
            throw new ApiException(ErrorCode.INVALID_INPUT);
        }

        QuestionAnswer existing = answerRepository
                .findByDailyQuestion_IdAndAuthor_Id(chosen.getId(), userId).orElse(null);
        if (existing != null && existing.getSealedAt() != null) {
            // 이미 봉인됨 — 재제출 불가
            throw new ApiException(ErrorCode.INVALID_INPUT);
        }

        if (existing != null) {
            existing.setText(text);
            existing.setSealedAt(LocalDateTime.now());
        } else {
            answerRepository.save(QuestionAnswer.builder()
                    .dailyQuestion(chosen)
                    .author(me)
                    .text(text)
                    .sealedAt(LocalDateTime.now())
                    .build());
        }
        // TODO: 상대에게 "답이 도착했어요" 알림 (양쪽 봉인 시 OPENED 알림)

        return today(userId);
    }

    // ===================== react =====================

    @Transactional
    public void react(Long userId, Long answerId) {
        Couple couple = coupleRepository.findByMember(userId)
                .orElseThrow(() -> new ApiException(ErrorCode.COUPLE_NOT_FOUND));

        QuestionAnswer answer = answerRepository.findById(answerId)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND));

        // 그 답이 내 커플 것인지 확인
        DailyQuestion dq = answer.getDailyQuestion();
        if (!dq.getCouple().getId().equals(couple.getId())) {
            throw new ApiException(ErrorCode.FORBIDDEN);
        }
        // OPENED(양쪽 봉인)일 때만
        if (!dq.isChosen() || !bothSealed(dq)) {
            throw new ApiException(ErrorCode.FORBIDDEN);
        }
        // 내 답에는 하트 못 함(상대 답에만)
        if (answer.getAuthor().getId().equals(userId)) {
            throw new ApiException(ErrorCode.FORBIDDEN);
        }

        Optional<QuestionReaction> existing = reactionRepository
                .findByAnswer_IdAndUser_Id(answerId, userId);
        if (existing.isPresent()) {
            reactionRepository.deleteByAnswer_IdAndUser_Id(answerId, userId);
        } else {
            User me = memberOf(couple, userId);
            try {
                reactionRepository.save(QuestionReaction.builder()
                        .answer(answer).user(me).build());
            } catch (DataIntegrityViolationException e) {
                // 동시 토글 경합: 이미 생성됨 — 무시
            }
        }
    }

    // ===================== archive =====================

    @Transactional(readOnly = true)
    public ArchiveResponse archive(Long userId, String cursor, int limit) {
        Couple couple = coupleRepository.findByMember(userId)
                .orElseThrow(() -> new ApiException(ErrorCode.COUPLE_NOT_FOUND));
        LocalDate today = LocalDate.now(KST);

        int pageSize = Math.max(1, Math.min(limit, 50));
        LocalDate cursorDate = parseCursor(cursor);

        List<DailyQuestion> all = dailyQuestionRepository
                .findByCouple_IdAndChosenTrueAndDateLessThanOrderByDateDesc(couple.getId(), today);

        // 커서 이후(더 과거)만
        List<DailyQuestion> filtered = all.stream()
                .filter(dq -> cursorDate == null || dq.getDate().isBefore(cursorDate))
                .toList();

        List<DailyQuestion> page = filtered.stream().limit(pageSize).toList();
        String nextCursor = filtered.size() > pageSize
                ? page.get(page.size() - 1).getDate().toString()
                : null;

        List<ArchiveItem> items = page.stream()
                .map(dq -> new ArchiveItem(
                        dq.getDate().toString(),
                        dq.getQuestion().getText(),
                        bothSealed(dq),
                        dq.getChosenBy() == null ? null : dq.getChosenBy().getNickname()))
                .toList();

        int totalOpened = (int) all.stream().filter(this::bothSealed).count();
        int streak = computeStreak(couple.getId(), today);
        String milestone = milestoneLabel(totalOpened);

        return new ArchiveResponse(items, nextCursor, totalOpened, streak, milestone);
    }

    @Transactional(readOnly = true)
    public ArchiveDetailResponse archiveDetail(Long userId, LocalDate date) {
        Couple couple = coupleRepository.findByMember(userId)
                .orElseThrow(() -> new ApiException(ErrorCode.COUPLE_NOT_FOUND));
        User partner = partnerOf(couple, userId);

        DailyQuestion dq = dailyQuestionRepository
                .findByCouple_IdAndDateAndChosenTrue(couple.getId(), date)
                .orElseThrow(() -> new ApiException(ErrorCode.QUESTION_NOT_FOUND));

        boolean opened = bothSealed(dq);
        Person chosenBy = dq.getChosenBy() == null ? null
                : new Person(dq.getChosenBy().getId(), dq.getChosenBy().getNickname());

        QuestionAnswer myAns = answerRepository
                .findByDailyQuestion_IdAndAuthor_Id(dq.getId(), userId).orElse(null);
        QuestionAnswer partnerAns = partner == null ? null : answerRepository
                .findByDailyQuestion_IdAndAuthor_Id(dq.getId(), partner.getId()).orElse(null);

        // 내 답은 항상, 상대 답은 opened일 때만 text
        AnswerView myView = toArchiveAnswerView(myAns, true);
        AnswerView partnerView = toArchiveAnswerView(partnerAns, opened);

        return new ArchiveDetailResponse(
                date.toString(),
                dq.getQuestion().getText(),
                chosenBy,
                opened,
                myView,
                partnerView,
                partner == null ? null : partner.getNickname());
    }

    private AnswerView toArchiveAnswerView(QuestionAnswer ans, boolean revealText) {
        if (ans == null) return null;
        boolean sealed = ans.getSealedAt() != null;
        String text = revealText ? ans.getText() : null;
        return new AnswerView(ans.getId(), text, sealed, null, null);
    }

    // ===================== settings =====================

    @Transactional
    public SettingsResponse getSettings(Long userId) {
        Couple couple = coupleRepository.findByMember(userId)
                .orElseThrow(() -> new ApiException(ErrorCode.COUPLE_NOT_FOUND));
        return toSettingsResponse(requireSetting(couple));
    }

    @Transactional
    public SettingsResponse updateSettings(Long userId, boolean notifyOn, String arrivalTime,
                                           boolean showStreak, boolean milestoneOn) {
        Couple couple = coupleRepository.findByMember(userId)
                .orElseThrow(() -> new ApiException(ErrorCode.COUPLE_NOT_FOUND));
        QuestionSetting setting = requireSetting(couple);

        LocalTime parsed = parseTime(arrivalTime);
        setting.setNotifyOn(notifyOn);
        setting.setArrivalTime(parsed);
        setting.setShowStreak(showStreak);
        setting.setMilestoneOn(milestoneOn);
        return toSettingsResponse(setting);
    }

    private SettingsResponse toSettingsResponse(QuestionSetting s) {
        return new SettingsResponse(
                s.isNotifyOn(),
                s.getArrivalTime().format(HM),
                s.isShowStreak(),
                s.isMilestoneOn());
    }

    // ===================== 내부 헬퍼 =====================

    private QuestionSetting requireSetting(Couple couple) {
        return settingRepository.findByCouple_Id(couple.getId())
                .orElseGet(() -> {
                    try {
                        return settingRepository.save(QuestionSetting.builder().couple(couple).build());
                    } catch (DataIntegrityViolationException e) {
                        // 동시 생성 경합
                        return settingRepository.findByCouple_Id(couple.getId())
                                .orElseThrow(() -> new ApiException(ErrorCode.INVALID_INPUT));
                    }
                });
    }

    /** 오늘 질문 후보 2개(slot 1,2)를 풀에서 배정. 최근 사용 질문 회피는 best-effort. */
    private List<DailyQuestion> assignToday(Couple couple, LocalDate today) {
        List<QuestionPool> active = poolRepository.findByActiveTrue();
        if (active.size() < 2) {
            // 풀 부족 — 정상 배정 불가
            throw new ApiException(ErrorCode.QUESTION_NOT_FOUND);
        }

        // 최근 사용한 질문 id 수집(회피 대상)
        Set<Long> recent = new HashSet<>();
        LocalDate since = today.minusDays(RECENT_AVOID_DAYS);
        for (DailyQuestion dq : dailyQuestionRepository
                .findByCouple_IdAndChosenTrueAndDateLessThanOrderByDateDesc(couple.getId(), today)) {
            if (!dq.getDate().isBefore(since)) {
                recent.add(dq.getQuestion().getId());
            }
        }

        List<QuestionPool> pool = new ArrayList<>(active);
        Collections.shuffle(pool);
        // 최근 안 쓴 것 우선, 부족하면 나머지로 채움
        List<QuestionPool> preferred = new ArrayList<>();
        List<QuestionPool> fallback = new ArrayList<>();
        for (QuestionPool q : pool) {
            (recent.contains(q.getId()) ? fallback : preferred).add(q);
        }
        List<QuestionPool> ordered = new ArrayList<>(preferred);
        ordered.addAll(fallback);
        List<QuestionPool> picked = ordered.subList(0, 2);

        try {
            DailyQuestion s1 = dailyQuestionRepository.save(DailyQuestion.builder()
                    .couple(couple).date(today).question(picked.get(0)).slot(1).build());
            DailyQuestion s2 = dailyQuestionRepository.save(DailyQuestion.builder()
                    .couple(couple).date(today).question(picked.get(1)).slot(2).build());
            return List.of(s1, s2);
        } catch (DataIntegrityViolationException e) {
            // 동시 배정 경합: 이미 생성됨 — 재조회
            return dailyQuestionRepository.findByCouple_IdAndDate(couple.getId(), today);
        }
    }

    /** 연속 오픈일수: 오늘(또는 어제)부터 과거로 연속으로 opened된 날 수. */
    private int computeStreak(Long coupleId, LocalDate today) {
        List<DailyQuestion> chosenDesc = dailyQuestionRepository
                .findByCouple_IdAndChosenTrueAndDateLessThanOrderByDateDesc(coupleId, today.plusDays(1));
        // 날짜→opened 매핑
        Set<LocalDate> openedDays = new HashSet<>();
        for (DailyQuestion dq : chosenDesc) {
            if (bothSealed(dq)) openedDays.add(dq.getDate());
        }
        if (openedDays.isEmpty()) return 0;

        // 오늘이 opened면 오늘부터, 아니면 어제부터 연속 카운트
        LocalDate cursor = openedDays.contains(today) ? today : today.minusDays(1);
        int streak = 0;
        while (openedDays.contains(cursor)) {
            streak++;
            cursor = cursor.minusDays(1);
        }
        return streak;
    }

    /** 어제 질문이 선택됐지만 아직 미오픈이면 true. */
    private Boolean computeMissedYesterday(Long coupleId, LocalDate today) {
        LocalDate yesterday = today.minusDays(1);
        return dailyQuestionRepository
                .findByCouple_IdAndDateAndChosenTrue(coupleId, yesterday)
                .map(dq -> !bothSealed(dq))
                .orElse(false);
    }

    private boolean bothSealed(DailyQuestion dq) {
        List<QuestionAnswer> answers = answerRepository.findByDailyQuestion_Id(dq.getId());
        long sealed = answers.stream().filter(a -> a.getSealedAt() != null).count();
        return sealed >= 2;
    }

    private String milestoneLabel(int totalOpened) {
        if (totalOpened > 0 && totalOpened % 100 == 0) {
            return totalOpened + "번째 편지";
        }
        return null;
    }

    private TodayResponseBuilder base(LocalDate date, String state, String arrival,
                                      int streak, Boolean missedYesterday) {
        return new TodayResponseBuilder()
                .date(date.toString())
                .state(state)
                .arrivalTime(arrival)
                .streak(streak)
                .missedYesterday(missedYesterday);
    }

    private LocalDate parseCursor(String cursor) {
        if (cursor == null || cursor.isBlank()) return null;
        try {
            return LocalDate.parse(cursor.trim());
        } catch (DateTimeException e) {
            throw new ApiException(ErrorCode.INVALID_INPUT);
        }
    }

    private LocalTime parseTime(String hhmm) {
        if (hhmm == null || hhmm.isBlank()) throw new ApiException(ErrorCode.INVALID_INPUT);
        try {
            return LocalTime.parse(hhmm.trim(), HM);
        } catch (DateTimeException e) {
            throw new ApiException(ErrorCode.INVALID_INPUT);
        }
    }

    private User memberOf(Couple c, Long userId) {
        if (c.getUser1().getId().equals(userId)) return c.getUser1();
        if (c.getUser2().getId().equals(userId)) return c.getUser2();
        throw new ApiException(ErrorCode.FORBIDDEN);
    }

    private User partnerOf(Couple c, Long userId) {
        if (c.getUser1().getId().equals(userId)) return c.getUser2();
        if (c.getUser2().getId().equals(userId)) return c.getUser1();
        return null;
    }

    /** TodayResponse용 경량 빌더(레코드라 lombok 불가). */
    private static final class TodayResponseBuilder {
        private String date;
        private String state;
        private String arrivalTime;
        private List<Choice> choices;
        private QuestionView question;
        private Person chosenBy;
        private Boolean chosenByMe;
        private AnswerView myAnswer;
        private AnswerView partnerAnswer;
        private Boolean partnerSealed;
        private int streak;
        private Boolean missedYesterday;

        TodayResponseBuilder date(String v) { this.date = v; return this; }
        TodayResponseBuilder state(String v) { this.state = v; return this; }
        TodayResponseBuilder arrivalTime(String v) { this.arrivalTime = v; return this; }
        TodayResponseBuilder choices(List<Choice> v) { this.choices = v; return this; }
        TodayResponseBuilder question(QuestionView v) { this.question = v; return this; }
        TodayResponseBuilder chosenBy(Person v) { this.chosenBy = v; return this; }
        TodayResponseBuilder chosenByMe(Boolean v) { this.chosenByMe = v; return this; }
        TodayResponseBuilder myAnswer(AnswerView v) { this.myAnswer = v; return this; }
        TodayResponseBuilder partnerAnswer(AnswerView v) { this.partnerAnswer = v; return this; }
        TodayResponseBuilder partnerSealed(Boolean v) { this.partnerSealed = v; return this; }
        TodayResponseBuilder streak(int v) { this.streak = v; return this; }
        TodayResponseBuilder missedYesterday(Boolean v) { this.missedYesterday = v; return this; }

        TodayResponse build() {
            return new TodayResponse(date, state, arrivalTime, true, choices, question,
                    chosenBy, chosenByMe, myAnswer, partnerAnswer, partnerSealed, streak, missedYesterday);
        }
    }
}
