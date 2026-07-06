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
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.MonthDay;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ThreadLocalRandom;

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
    private static final int RECENT_AVOID_DAYS = 45;
    /** 컨텍스트 트리거 임박 판정 창(D-3 ~ D0). */
    private static final int CONTEXT_WINDOW_DAYS = 3;
    /** 서로 다른 커플 신고가 이 수 이상이면 자동 비활성. */
    private static final int REPORT_DEACTIVATE_THRESHOLD = 3;

    /** 전역 목표 톤 비율(1:3:1) — best-effort 보정용. */
    private static final Map<String, Double> GLOBAL_TONE = Map.of(
            "deep", 0.2, "light", 0.6, "fun", 0.2);

    private final CoupleRepository coupleRepository;
    private final DailyQuestionRepository dailyQuestionRepository;
    private final QuestionAnswerRepository answerRepository;
    private final QuestionReactionRepository reactionRepository;
    private final QuestionSettingRepository settingRepository;
    private final QuestionPoolRepository poolRepository;
    private final QuestionReportRepository reportRepository;
    private final com.today.notification.NotificationService notificationService;

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
                    .map(dq -> new Choice(dq.getQuestion().getId(), dq.displayText(), dq.getSlot()))
                    .toList();
            return base(today, "NEEDS_CHOICE", arrival, streak, missedYesterday)
                    .choices(choices)
                    .build();
        }

        // 선택 이후 상태
        boolean chosenByMe = chosen.getChosenBy() != null && chosen.getChosenBy().getId().equals(userId);
        Person chosenByPerson = chosen.getChosenBy() == null ? null
                : new Person(chosen.getChosenBy().getId(), chosen.getChosenBy().getNickname());
        QuestionView qv = new QuestionView(chosen.getQuestion().getId(), chosen.displayText());

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
        notificationService.onQuestionChosen(me, partnerOf(couple, userId), today);

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
        // 상대 답장 봉인 여부로 열림/대기 알림 분기.
        User partner = partnerOf(couple, userId);
        boolean partnerSealed = partner != null && answerRepository
                .findByDailyQuestion_IdAndAuthor_Id(chosen.getId(), partner.getId())
                .map(a -> a.getSealedAt() != null).orElse(false);
        if (partnerSealed) {
            notificationService.onQuestionOpened(me, partner, today);
        } else {
            notificationService.onQuestionAnswered(me, partner, today);
        }

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

    // ===================== report =====================

    /**
     * '별로예요' 신고. 내 커플로 report upsert(중복 무시). 신고 후 서로 다른 커플 신고수를
     * pool.reportedCount에 반영하고, 임계({@value #REPORT_DEACTIVATE_THRESHOLD}) 이상이면 active=false.
     */
    @Transactional
    public void report(Long userId, Long questionId) {
        Couple couple = coupleRepository.findByMember(userId)
                .orElseThrow(() -> new ApiException(ErrorCode.COUPLE_NOT_FOUND));
        QuestionPool question = poolRepository.findById(questionId)
                .orElseThrow(() -> new ApiException(ErrorCode.QUESTION_NOT_FOUND));

        if (!reportRepository.existsByQuestion_IdAndCouple_Id(questionId, couple.getId())) {
            try {
                reportRepository.save(QuestionReport.builder()
                        .question(question).couple(couple).build());
            } catch (DataIntegrityViolationException e) {
                // 동시 신고 경합: 이미 생성됨 — 무시
            }
        }

        long distinctCouples = reportRepository.countByQuestion_Id(questionId);
        question.setReportedCount((int) distinctCouples);
        if (distinctCouples >= REPORT_DEACTIVATE_THRESHOLD) {
            question.setActive(false);
        }
    }

    // ===================== 스케줄러용 (도착시간·자정 마감) =====================

    /** 도착시간이 지난 커플에게 오늘의 질문을 배정하고 도착 알림 생성(중복 방지). 스케줄러가 주기 호출. */
    @Transactional
    public void runArrivalNotifications() {
        LocalDate today = LocalDate.now(KST);
        LocalTime now = LocalTime.now(KST);
        for (QuestionSetting s : settingRepository.findAll()) {
            if (!s.isNotifyOn()) continue;
            if (now.isBefore(s.getArrivalTime())) continue;
            Couple couple = s.getCouple();
            if (couple == null) continue;
            List<DailyQuestion> todays = dailyQuestionRepository.findByCouple_IdAndDate(couple.getId(), today);
            if (todays.isEmpty()) {
                todays = assignToday(couple, today);
            }
            if (todays.isEmpty()) continue;
            notificationService.onQuestionArrived(couple.getUser1(), couple.getUser2(), today);
        }
    }

    /** 자정: 어제 선택했지만 열리지 못한 편지가 있는 커플에게 '지나간 편지' 알림. 스케줄러가 하루 1회. */
    @Transactional
    public void runMissedNotifications() {
        LocalDate yesterday = LocalDate.now(KST).minusDays(1);
        for (QuestionSetting s : settingRepository.findAll()) {
            if (!s.isNotifyOn()) continue;
            Couple couple = s.getCouple();
            if (couple == null) continue;
            DailyQuestion chosen = dailyQuestionRepository
                    .findByCouple_IdAndDateAndChosenTrue(couple.getId(), yesterday).orElse(null);
            if (chosen != null && !bothSealed(chosen)) {
                notificationService.onQuestionMissed(couple.getUser1(), couple.getUser2(), yesterday);
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
                        dq.displayText(),
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
                dq.displayText(),
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

    /**
     * 오늘 질문 후보 2개(slot 1,2)를 풀에서 배정(문서 25 §3·§4·§6).
     * <p>slot1: 컨텍스트 트리거가 활성이면 해당 트리거의 템플릿 질문(placeholder 치환)으로.
     * 나머지 slot: 비템플릿 활성 풀에서 요일 리듬 목표 톤 분포로 가중 랜덤. 최근 45일 회피,
     * 2개는 tone·theme가 서로 다르게. 풀 부족 시 회피/제약 완화.</p>
     */
    private List<DailyQuestion> assignToday(Couple couple, LocalDate today) {
        List<QuestionPool> nonTemplate = poolRepository.findByActiveTrueAndIsTemplateFalse();
        if (nonTemplate.isEmpty()) {
            throw new ApiException(ErrorCode.QUESTION_NOT_FOUND);
        }

        // 최근 사용 질문(회피 대상)
        Set<Long> recent = new HashSet<>();
        LocalDate since = today.minusDays(RECENT_AVOID_DAYS);
        for (DailyQuestion dq : dailyQuestionRepository
                .findByCouple_IdAndChosenTrueAndDateLessThanOrderByDateDesc(couple.getId(), today)) {
            if (!dq.getDate().isBefore(since)) {
                recent.add(dq.getQuestion().getId());
            }
        }

        List<PickedQuestion> picks = new ArrayList<>();
        Set<Long> usedIds = new HashSet<>();

        // slot1: 컨텍스트 트리거 우선
        ContextSignal signal = computeContext(couple, today);
        if (signal != null) {
            PickedQuestion ctx = pickTemplate(signal, couple, today);
            if (ctx != null) {
                picks.add(ctx);
                usedIds.add(ctx.pool.getId());
            }
        }

        // 나머지 슬롯: 요일 리듬 목표 톤 분포로 가중 랜덤
        Map<String, Double> targetTone = rhythmTone(today.getDayOfWeek());
        while (picks.size() < 2) {
            PickedQuestion prev = picks.isEmpty() ? null : picks.get(picks.size() - 1);
            PickedQuestion next = pickWeighted(nonTemplate, targetTone, recent, usedIds, prev);
            if (next == null) break;
            picks.add(next);
            usedIds.add(next.pool.getId());
        }

        // 여전히 2개 미만이면 제약 완화(중복 회피만 유지)
        if (picks.size() < 2) {
            List<QuestionPool> shuffled = new ArrayList<>(nonTemplate);
            Collections.shuffle(shuffled);
            for (QuestionPool q : shuffled) {
                if (picks.size() >= 2) break;
                if (usedIds.contains(q.getId())) continue;
                picks.add(new PickedQuestion(q, null));
                usedIds.add(q.getId());
            }
        }
        if (picks.size() < 2) {
            throw new ApiException(ErrorCode.QUESTION_NOT_FOUND);
        }

        try {
            DailyQuestion s1 = dailyQuestionRepository.save(DailyQuestion.builder()
                    .couple(couple).date(today).question(picks.get(0).pool)
                    .renderedText(picks.get(0).renderedText).slot(1).build());
            DailyQuestion s2 = dailyQuestionRepository.save(DailyQuestion.builder()
                    .couple(couple).date(today).question(picks.get(1).pool)
                    .renderedText(picks.get(1).renderedText).slot(2).build());
            // 배정된 pool usedCount++
            picks.get(0).pool.setUsedCount(picks.get(0).pool.getUsedCount() + 1);
            picks.get(1).pool.setUsedCount(picks.get(1).pool.getUsedCount() + 1);
            return List.of(s1, s2);
        } catch (DataIntegrityViolationException e) {
            // 동시 배정 경합: 이미 생성됨 — 재조회
            return dailyQuestionRepository.findByCouple_IdAndDate(couple.getId(), today);
        }
    }

    /** 배정 후보(풀 + 렌더 문장). renderedText null이면 원문 사용. */
    private record PickedQuestion(QuestionPool pool, String renderedText) {}

    /** 계산된 컨텍스트 신호(트리거 종류 + placeholder 치환값). */
    /** unit: 기념일 트리거에서 "year"(N주년) / "day"(N일) 구분. 그 외 null. */
    private record ContextSignal(String trigger, Integer n, String partnerNickname, String unit) {}

    /**
     * 요일 리듬 목표 톤 분포(문서 25 §3). 전역 1:3:1 쪽으로 약한 보정.
     */
    private Map<String, Double> rhythmTone(DayOfWeek dow) {
        Map<String, Double> base;
        switch (dow) {
            case FRIDAY -> base = Map.of("light", 0.5, "deep", 0.3, "fun", 0.2);
            case SATURDAY, SUNDAY -> base = Map.of("deep", 0.5, "light", 0.35, "fun", 0.15);
            default -> base = Map.of("light", 0.7, "fun", 0.2, "deep", 0.1); // 월~목
        }
        // 전역 1:3:1로 약한 보정(70% 리듬 + 30% 전역).
        Map<String, Double> blended = new LinkedHashMap<>();
        for (String tone : List.of("deep", "light", "fun")) {
            double v = 0.7 * base.getOrDefault(tone, 0.0) + 0.3 * GLOBAL_TONE.getOrDefault(tone, 0.0);
            blended.put(tone, v);
        }
        return blended;
    }

    /**
     * 목표 톤 분포로 가중 랜덤 pick. 최근/중복/이전 pick의 tone·theme 회피.
     * 후보가 없으면 제약을 단계적으로 완화(회피 무시).
     */
    private PickedQuestion pickWeighted(List<QuestionPool> pool, Map<String, Double> targetTone,
                                        Set<Long> recent, Set<Long> usedIds, PickedQuestion prev) {
        String prevTone = prev == null ? null : prev.pool.getTone();
        String prevTheme = prev == null ? null : prev.pool.getTheme();

        // 1차: 최근 회피 + tone/theme 다르게
        QuestionPool p = weightedPick(pool, targetTone, usedIds, recent, prevTone, prevTheme);
        // 2차: 최근 회피 완화(tone/theme 제약만)
        if (p == null) p = weightedPick(pool, targetTone, usedIds, Set.of(), prevTone, prevTheme);
        // 3차: tone/theme 제약도 완화(중복만 회피)
        if (p == null) p = weightedPick(pool, targetTone, usedIds, Set.of(), null, null);
        return p == null ? null : new PickedQuestion(p, null);
    }

    private QuestionPool weightedPick(List<QuestionPool> pool, Map<String, Double> targetTone,
                                      Set<Long> usedIds, Set<Long> avoid,
                                      String differentTone, String differentTheme) {
        List<QuestionPool> candidates = new ArrayList<>();
        List<Double> weights = new ArrayList<>();
        double total = 0.0;
        for (QuestionPool q : pool) {
            if (usedIds.contains(q.getId())) continue;
            if (avoid.contains(q.getId())) continue;
            if (differentTone != null && differentTone.equals(q.getTone())) continue;
            if (differentTheme != null && q.getTheme() != null && differentTheme.equals(q.getTheme())) continue;
            double w = targetTone.getOrDefault(q.getTone() == null ? "light" : q.getTone(), 0.05);
            if (w <= 0) w = 0.05; // 목표에 없는 톤도 소량 확률
            candidates.add(q);
            weights.add(w);
            total += w;
        }
        if (candidates.isEmpty()) return null;
        double r = ThreadLocalRandom.current().nextDouble(total);
        double acc = 0.0;
        for (int i = 0; i < candidates.size(); i++) {
            acc += weights.get(i);
            if (r < acc) return candidates.get(i);
        }
        return candidates.get(candidates.size() - 1);
    }

    /**
     * 커플의 객관 신호로 컨텍스트 트리거 계산(문서 25 §4).
     * 우선순위: 기념일·생일 > streak(마일스톤) > season. 여럿이면 하나만.
     * 일기 본문·기분은 절대 사용하지 않는다.
     */
    private ContextSignal computeContext(Couple couple, LocalDate today) {
        // 1) 기념일(N주년 / 100·200·… 일수) D-3~D0
        LocalDate anniv = couple.getAnniversaryDate();
        if (anniv != null && !anniv.isAfter(today)) {
            // N주년
            for (int upcoming = 0; upcoming <= CONTEXT_WINDOW_DAYS; upcoming++) {
                LocalDate probe = today.plusDays(upcoming);
                long years = probe.getYear() - anniv.getYear();
                if (years >= 1 && anniv.plusYears(years).isEqual(probe)) {
                    return new ContextSignal("anniversary", (int) years, partnerNickname(couple, null), "year");
                }
            }
            // 100·200·300… 일수
            long daysTogether = ChronoUnit.DAYS.between(anniv, today);
            for (int upcoming = 0; upcoming <= CONTEXT_WINDOW_DAYS; upcoming++) {
                long d = daysTogether + upcoming;
                if (d > 0 && d % 100 == 0) {
                    return new ContextSignal("anniversary", (int) d, null, "day");
                }
            }
        }

        // 2) 생일(두 사람) D-3~D0
        Integer bdayDays = birthdayWithinWindow(couple, today);
        if (bdayDays != null) {
            return new ContextSignal("birthday", bdayDays,
                    birthdayPartnerNickname(couple, today), null);
        }

        // 3) streak 마일스톤(오픈 7·30·100번째)
        int totalOpened = (int) dailyQuestionRepository
                .findByCouple_IdAndChosenTrueAndDateLessThanOrderByDateDesc(couple.getId(), today.plusDays(1))
                .stream().filter(this::bothSealed).count();
        if (totalOpened == 7 || totalOpened == 30 || totalOpened == 100) {
            return new ContextSignal("streak", totalOpened, null, null);
        }
        // 첫 편지 / 오랜만 복귀
        if (totalOpened == 0) {
            boolean everOpened = dailyQuestionRepository
                    .findByCouple_IdAndChosenTrueAndDateLessThanOrderByDateDesc(couple.getId(), today.plusDays(1))
                    .stream().anyMatch(this::bothSealed);
            if (!everOpened) {
                return new ContextSignal("firstletter", null, null, null);
            }
        }

        // 4) season(계절/명절) — 대략적 월 기반
        String season = seasonTrigger(today);
        if (season != null) {
            return new ContextSignal("season", null, null, null);
        }
        return null;
    }

    /** 두 사람 중 생일이 D-3~D0인 사람이 있으면 남은 일수(0~3), 없으면 null. */
    private Integer birthdayWithinWindow(Couple couple, LocalDate today) {
        Integer a = daysUntilBirthday(couple.getUser1().getBirthday(), today);
        Integer b = daysUntilBirthday(couple.getUser2().getBirthday(), today);
        if (a != null && b != null) return Math.min(a, b);
        return a != null ? a : b;
    }

    private String birthdayPartnerNickname(Couple couple, LocalDate today) {
        Integer a = daysUntilBirthday(couple.getUser1().getBirthday(), today);
        Integer b = daysUntilBirthday(couple.getUser2().getBirthday(), today);
        if (a != null && (b == null || a <= b)) return couple.getUser1().getNickname();
        if (b != null) return couple.getUser2().getNickname();
        return null;
    }

    /** 생일까지 남은 일수(올해 기준, 0~CONTEXT_WINDOW_DAYS 이내면 반환). 윤년 2/29는 안전 처리. */
    private Integer daysUntilBirthday(LocalDate birthday, LocalDate today) {
        if (birthday == null) return null;
        MonthDay md = MonthDay.of(birthday.getMonthValue(),
                birthday.getDayOfMonth() == 29 && birthday.getMonthValue() == 2 ? 28 : birthday.getDayOfMonth());
        LocalDate next = md.atYear(today.getYear());
        if (next.isBefore(today)) next = md.atYear(today.getYear() + 1);
        long d = ChronoUnit.DAYS.between(today, next);
        return d <= CONTEXT_WINDOW_DAYS ? (int) d : null;
    }

    private String seasonTrigger(LocalDate today) {
        int m = today.getMonthValue();
        if (m == 12) return "season";   // 연말/크리스마스
        if (m == 7 || m == 8) return "season"; // 여름
        return null;
    }

    private String partnerNickname(Couple couple, Long meId) {
        // 기념일 등 특정 상대가 없는 경우 대표로 user1 닉네임 사용(치환 안전용).
        return couple.getUser1().getNickname();
    }

    /** 트리거에 맞는 템플릿 질문 하나를 골라 placeholder 치환. 없으면 null. */
    private PickedQuestion pickTemplate(ContextSignal signal, Couple couple, LocalDate today) {
        List<QuestionPool> templates = poolRepository
                .findByActiveTrueAndIsTemplateTrueAndContextTrigger(signal.trigger());
        if (templates.isEmpty()) return null;
        // 기념일은 '주년(N주년)'과 '일수(N일)' 템플릿이 섞여 있어, 신호 단위에 맞는 것만 사용.
        // (예: 1주년 신호에 "{N}일이라니…" 템플릿이 걸려 "1일이라니"가 나오는 것 방지)
        if ("year".equals(signal.unit())) {
            List<QuestionPool> yr = templates.stream().filter(t -> t.getText().contains("주년")).toList();
            if (!yr.isEmpty()) templates = yr;
        } else if ("day".equals(signal.unit())) {
            List<QuestionPool> dy = templates.stream()
                    .filter(t -> t.getText().contains("일") && !t.getText().contains("주년")).toList();
            if (!dy.isEmpty()) templates = dy;
        }
        QuestionPool chosen = templates.get(ThreadLocalRandom.current().nextInt(templates.size()));
        String rendered = render(chosen.getText(), signal);
        return new PickedQuestion(chosen, rendered);
    }

    /** placeholder 치환: {N}=일수/주년수, {상대}=상대 닉네임. */
    private String render(String template, ContextSignal signal) {
        String out = template;
        if (signal.n() != null) out = out.replace("{N}", String.valueOf(signal.n()));
        if (signal.partnerNickname() != null) out = out.replace("{상대}", signal.partnerNickname());
        return out;
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
