package com.today.saju;

import com.today.common.ApiException;
import com.today.common.ErrorCode;
import com.today.couple.Couple;
import com.today.couple.CoupleRepository;
import com.today.couple.CoupleService;
import com.today.notification.NotificationService;
import com.today.saju.SajuCalculator.Saju;
import com.today.saju.SajuDtos.*;
import com.today.user.User;
import com.today.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class SajuService {

    private final UserRepository userRepository;
    private final CoupleService coupleService;
    private final CoupleRepository coupleRepository;
    private final NotificationService notificationService;

    private static final String[] EL_NAME = {"목", "화", "토", "금", "수"};
    private static final String[] EL_EMOJI = {"🌳", "🔥", "⛰️", "⚙️", "💧"};
    private static final String DISCLAIMER = SajuTemplates.DISCLAIMER;

    private User require(Long userId) {
        return userRepository.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.USER_NOT_FOUND));
    }

    private static String ganji(int stem, int branch) {
        return SajuCalculator.STEM_KO[stem] + SajuCalculator.BRANCH_KO[branch];
    }

    // ───────── 개인 사주 ─────────
    @Transactional(readOnly = true)
    public PersonalResult me(Long userId) {
        User u = require(userId);
        return personalOf(u);
    }

    // ───────── 연인 사주 ─────────
    @Transactional(readOnly = true)
    public PersonalResult partner(Long userId) {
        User partner = partnerOrNull(userId);
        if (partner == null || partner.getBirthday() == null) return emptyPersonal();
        return personalOf(partner);
    }

    private PersonalResult emptyPersonal() {
        return new PersonalResult(false, null, null, null, null, null, null, null, null, List.of(), null,
                List.of(), List.of(), null, List.of(), List.of(), null, null, false, DISCLAIMER);
    }

    private PersonalResult personalOf(User u) {
        if (u.getBirthday() == null) return emptyPersonal();
        Saju s = SajuCalculator.compute(u.getBirthday(), u.getBirthTime());
        SajuTemplates.DayMaster dm = SajuTemplates.dayMaster(s.dayStem());

        List<String> pillars = new ArrayList<>();
        pillars.add(ganji(s.yearStem(), s.yearBranch()));
        pillars.add(ganji(s.monthStem(), s.monthBranch()));
        pillars.add(ganji(s.dayStem(), s.dayBranch()));
        if (s.hasHour()) pillars.add(ganji(s.hourStem(), s.hourBranch()));

        List<OhaengView> ohaeng = new ArrayList<>();
        int[] ec = s.elementCount();
        for (int e = 0; e < 5; e++) {
            int level = SajuTemplates.ohaengLevel(ec[e]);
            ohaeng.add(new OhaengView(e, EL_NAME[e], EL_EMOJI[e], ec[e], level, SajuTemplates.ohaengComment(e, level)));
        }

        LocalDate todayD = LocalDate.now(SajuCalculator.KST);
        var d = SajuTemplates.daily(s.dayStem(), todayD);
        var detD = SajuDailyFortune.compute(s.dayStem(), true, SajuCalculator.compute(todayD, null), todayD);
        DailyView daily = new DailyView(d.fortune(), d.colorName(), d.colorHex(), d.keyword(), d.coupleTip(), detD.totalLine());

        int el = SajuCalculator.STEM_ELEMENT[s.dayStem()];
        String dayKo = SajuCalculator.STEM_KO[s.dayStem()] + SajuCalculator.ELEMENT_KO[el];   // 예: 갑목
        String dayHanja = SajuCalculator.STEM_HANJA[s.dayStem()] + SajuCalculator.ELEMENT_HANJA[el]; // 예: 甲木

        String nick = u.getNickname();
        String subj = (nick == null || nick.isBlank()) ? "이 사람" : (nick.endsWith("님") ? nick : nick + "님");

        return new PersonalResult(true, nick,
                dm.name(), dm.emoji(), dayKo, dayHanja,
                dm.oneLine(), SajuTemplates.twist(s.dayStem()), dm.desc(), List.of(dm.keywords()), dm.growth(),
                List.of(SajuTemplates.strengths(s.dayStem())), List.of(SajuTemplates.growthPoints(s.dayStem())),
                SajuCalculator.BRANCH_ANIMAL[s.zodiac()],
                pillars, ohaeng, SajuTemplates.ohaengInsight(ec, subj), daily, s.hasHour(), DISCLAIMER);
    }

    // ───────── 오늘의 운세 ─────────
    @Transactional(readOnly = true)
    public DailyView daily(Long userId) {
        User u = require(userId);
        boolean has = u.getBirthday() != null;
        int dayStem = has ? SajuCalculator.compute(u.getBirthday(), u.getBirthTime()).dayStem() : 0;
        LocalDate today = LocalDate.now(SajuCalculator.KST);
        var d = SajuTemplates.daily(dayStem, today);
        var det = SajuDailyFortune.compute(dayStem, has, SajuCalculator.compute(today, null), today);
        return new DailyView(d.fortune(), d.colorName(), d.colorHex(), d.keyword(), d.coupleTip(), det.totalLine());
    }

    // ───────── 오늘의 운세(상세) ─────────
    @Transactional(readOnly = true)
    public SajuDailyFortune.Result dailyDetail(Long userId) {
        User u = require(userId);
        boolean has = u.getBirthday() != null;
        int myStem = has ? SajuCalculator.compute(u.getBirthday(), u.getBirthTime()).dayStem() : 0;
        LocalDate today = LocalDate.now(SajuCalculator.KST);
        return SajuDailyFortune.compute(myStem, has, SajuCalculator.compute(today, null), today);
    }

    // ───────── 생시 저장 ─────────
    @Transactional
    public void setBirthTime(Long userId, Integer hour) {
        if (hour != null && (hour < 0 || hour > 23)) throw new ApiException(ErrorCode.INVALID_INPUT);
        User u = require(userId);
        u.setBirthTime(hour);
    }

    // ───────── 허브 상태 ─────────
    @Transactional(readOnly = true)
    public HubStatus hub(Long userId) {
        User me = require(userId);
        User partner = partnerOrNull(userId);
        boolean partnerHasBd = partner != null && partner.getBirthday() != null;
        return new HubStatus(
                me.getBirthday() != null, partner != null, partnerHasBd,
                me.getNickname(), me.getBirthday() != null ? me.getBirthday().toString() : null, me.getBirthTime(),
                partner != null ? partner.getNickname() : null,
                partnerHasBd ? partner.getBirthday().toString() : null,
                partner != null ? partner.getBirthTime() : null,
                me.getBirthday() != null ? dayEmoji(me) : null,
                partnerHasBd ? dayEmoji(partner) : null);
    }

    /** 일간 이모지(허브 아바타용). */
    private String dayEmoji(User u) {
        int stem = SajuCalculator.compute(u.getBirthday(), u.getBirthTime()).dayStem();
        return SajuTemplates.dayMaster(stem).emoji();
    }

    // ───────── 커플 궁합 ─────────
    @Transactional(readOnly = true)
    public CoupleResult couple(Long userId) {
        User me = require(userId);
        User partner = partnerOrNull(userId);
        if (me.getBirthday() == null) return blocked("생일을 먼저 등록하면 궁합을 볼 수 있어요.", false);
        if (partner == null) return blocked("커플 연결 후 궁합을 볼 수 있어요.", false);
        if (partner.getBirthday() == null)
            return blocked(partner.getNickname() + "님이 아직 생일을 입력하지 않았어요. 요청해 볼까요?", true);

        Saju sa = SajuCalculator.compute(me.getBirthday(), me.getBirthTime());
        Saju sb = SajuCalculator.compute(partner.getBirthday(), partner.getBirthTime());
        SajuCompatibility.Result r = SajuCompatibility.compute(
                sa, sb, me.getBirthday(), partner.getBirthday(), me.getNickname(), partner.getNickname());

        List<CatView> cats = new ArrayList<>();
        for (var c : r.categories()) cats.add(new CatView(c.key(), c.name(), c.score(), c.grade(), c.comment(), c.behavior(), c.sajuNote()));

        SajuTemplates.DayMaster meDm = SajuTemplates.dayMaster(sa.dayStem());
        SajuTemplates.DayMaster pDm = SajuTemplates.dayMaster(sb.dayStem());

        return new CoupleResult(true, null, false, r.percent(), cats, r.totalComment(), r.badges(),
                r.relComment(), r.strongestKey(), r.weakestKey(),
                r.keywords(), r.summaryLines(),
                me.getNickname(), meDm.name(), meDm.emoji(),
                partner.getNickname(), pDm.name(), pDm.emoji(),
                r.tips(),
                r.hasHour(), DISCLAIMER);
    }

    private CoupleResult blocked(String reason, boolean canRequestBirthday) {
        return new CoupleResult(false, reason, canRequestBirthday, 0, List.of(), null, List.of(), null, null, null,
                List.of(), List.of(),
                null, null, null,
                null, null, null,
                List.of(), false, DISCLAIMER);
    }

    // ───────── 상대에게 생일 입력 요청 ─────────
    @Transactional
    public void requestBirthday(Long userId) {
        Couple couple = coupleService.requireCouple(userId);
        User me = memberOf(couple, userId);
        User partner = partnerOf(couple, userId);
        if (partner == null) throw new ApiException(ErrorCode.COUPLE_NOT_FOUND);
        notificationService.onSajuBirthdayRequest(me, partner);
    }

    // ───────── 배지 ─────────
    @Transactional(readOnly = true)
    public long unseenCount(Long userId) { return notificationService.countUnreadSaju(userId); }

    @Transactional
    public void markSeen(Long userId) { notificationService.markSajuSeen(userId); }

    // ── helpers ──
    private User partnerOrNull(Long userId) {
        return coupleRepository.findByMember(userId).map(c -> partnerOf(c, userId)).orElse(null);
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
}
