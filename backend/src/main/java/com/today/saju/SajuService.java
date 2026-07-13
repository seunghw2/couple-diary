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

    private PersonalResult personalOf(User u) {
        if (u.getBirthday() == null) {
            return new PersonalResult(false, null, null, null, null, null, null, List.of(), null,
                    null, List.of(), List.of(), null, false, DISCLAIMER);
        }
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

        var d = SajuTemplates.daily(s.dayStem(), LocalDate.now(SajuCalculator.KST));
        DailyView daily = new DailyView(d.fortune(), d.colorName(), d.colorHex(), d.keyword(), d.coupleTip());

        int el = SajuCalculator.STEM_ELEMENT[s.dayStem()];
        String dayKo = SajuCalculator.STEM_KO[s.dayStem()] + SajuCalculator.ELEMENT_KO[el];   // 예: 갑목
        String dayHanja = SajuCalculator.STEM_HANJA[s.dayStem()] + SajuCalculator.ELEMENT_HANJA[el]; // 예: 甲木

        return new PersonalResult(true,
                dm.name(), dm.emoji(), dayKo, dayHanja,
                dm.oneLine(), dm.desc(), List.of(dm.keywords()), dm.growth(),
                SajuCalculator.BRANCH_ANIMAL[s.zodiac()],
                pillars, ohaeng, daily, s.hasHour(), DISCLAIMER);
    }

    // ───────── 오늘의 운세 ─────────
    @Transactional(readOnly = true)
    public DailyView daily(Long userId) {
        User u = require(userId);
        int dayStem = u.getBirthday() == null ? 0
                : SajuCalculator.compute(u.getBirthday(), u.getBirthTime()).dayStem();
        var d = SajuTemplates.daily(dayStem, LocalDate.now(SajuCalculator.KST));
        return new DailyView(d.fortune(), d.colorName(), d.colorHex(), d.keyword(), d.coupleTip());
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
        return new HubStatus(me.getBirthday() != null, partner != null,
                partner != null && partner.getBirthday() != null, me.getBirthTime());
    }

    // ───────── 커플 궁합 ─────────
    @Transactional(readOnly = true)
    public CoupleResult couple(Long userId) {
        User me = require(userId);
        User partner = partnerOrNull(userId);
        if (me.getBirthday() == null) return blocked("생일을 먼저 등록하면 궁합을 볼 수 있어요.");
        if (partner == null) return blocked("커플 연결 후 궁합을 볼 수 있어요.");
        if (partner.getBirthday() == null)
            return blocked(partner.getNickname() + "님이 아직 생일을 입력하지 않았어요. 요청해 볼까요?");

        Saju sa = SajuCalculator.compute(me.getBirthday(), me.getBirthTime());
        Saju sb = SajuCalculator.compute(partner.getBirthday(), partner.getBirthTime());
        SajuCompatibility.Result r = SajuCompatibility.compute(sa, sb, me.getBirthday(), partner.getBirthday());

        List<CatView> cats = new ArrayList<>();
        for (var c : r.categories()) cats.add(new CatView(c.key(), c.name(), c.score(), c.grade(), c.comment()));

        SajuTemplates.DayMaster meDm = SajuTemplates.dayMaster(sa.dayStem());
        SajuTemplates.DayMaster pDm = SajuTemplates.dayMaster(sb.dayStem());

        return new CoupleResult(true, null, r.percent(), cats, r.totalComment(), r.badges(),
                r.relComment(), r.strongestKey(),
                meDm.name(), meDm.emoji(),
                partner.getNickname(), pDm.name(), pDm.emoji(),
                r.hasHour(), DISCLAIMER);
    }

    private CoupleResult blocked(String reason) {
        return new CoupleResult(false, reason, 0, List.of(), null, List.of(), null, null,
                null, null, null, null, null, false, DISCLAIMER);
    }

    // ───────── 상대에게 생일 입력 요청 ─────────
    @Transactional
    public void requestBirthday(Long userId) {
        Couple couple = coupleService.requireCouple(userId);
        User me = memberOf(couple, userId);
        User partner = partnerOf(couple, userId);
        if (partner == null) throw new ApiException(ErrorCode.INVALID_INPUT);
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
