package com.today.saju;

import com.today.saju.SajuCalculator.Saju;

import java.util.List;

/**
 * 십성(十星) 간이 분석 — 일간을 기준으로 나머지 일곱 글자의 기운을 다섯 묶음으로 세어
 * 우세한 기질 하나를 뽑는다. (재미/성향 참고용, 지장간·용신 등은 생략한 간이 버전)
 *
 * <p>묶음(오행 관계로만 결정, 음양은 정/편 세분에만 쓰이므로 그룹 단위에선 불필요):
 * 0 비겁(같은 오행) · 1 식상(일간이 생) · 2 재성(일간이 극) · 3 관성(일간을 극) · 4 인성(일간을 생).
 */
public final class SajuTenGods {

    private SajuTenGods() {}

    /** 우세 기질 결과. */
    public record Result(String name, String emoji, List<String> keywords, String desc) {}

    private static final String[] NAME = {
            "주관이 뚜렷한 기질", "표현이 풍부한 기질", "현실 감각이 밝은 기질",
            "책임감이 단단한 기질", "생각이 깊은 기질"
    };
    private static final String[] EMOJI = {"🚩", "🎨", "💰", "🛡️", "📚"};
    private static final String[][] KEYWORDS = {
            {"주체성", "자존심", "독립심", "추진력"},
            {"표현력", "창의력", "활동성", "재능"},
            {"현실감각", "계획성", "성실함", "실행력"},
            {"책임감", "절제력", "원칙", "끈기"},
            {"학구열", "사고력", "배려심", "안정감"},
    };
    private static final String[] DESC = {
            "내 색이 분명하고 남에게 잘 휘둘리지 않아요. 스스로 정한 길을 뚝심 있게 걸어가는 힘이 있어요.",
            "생각과 감정을 밖으로 잘 꺼내는 사람이에요. 재능과 끼로 주변을 즐겁게 만드는 표현력이 있어요.",
            "목표를 현실로 만드는 데 강해요. 실속을 챙기고 하나씩 차근차근 이뤄가는 타입이에요.",
            "맡은 일은 끝까지 해내는 사람이에요. 원칙과 신뢰로 주변의 믿음을 얻는 든든함이 있어요.",
            "배우고 받아들이는 힘이 큰 사람이에요. 한 발 물러서 넓게 보고 사람을 품는 깊이가 있어요.",
    };

    /** 일간 오행(dayEl) 대비 대상 오행(tEl)이 속하는 묶음 인덱스(0~4). */
    static int groupIndex(int dayEl, int tEl) {
        if (tEl == dayEl) return 0;              // 비겁: 같은 오행
        if ((dayEl + 1) % 5 == tEl) return 1;    // 식상: 일간이 生
        if ((dayEl + 2) % 5 == tEl) return 2;    // 재성: 일간이 剋
        if ((tEl + 2) % 5 == dayEl) return 3;    // 관성: 대상이 일간을 剋
        return 4;                                 // 인성: 대상이 일간을 生
    }

    public static Result analyze(Saju s) {
        int dayEl = SajuCalculator.STEM_ELEMENT[s.dayStem()];
        int[] cnt = new int[5];
        cnt[groupIndex(dayEl, SajuCalculator.STEM_ELEMENT[s.yearStem()])]++;
        cnt[groupIndex(dayEl, SajuCalculator.BRANCH_ELEMENT[s.yearBranch()])]++;
        cnt[groupIndex(dayEl, SajuCalculator.STEM_ELEMENT[s.monthStem()])]++;
        cnt[groupIndex(dayEl, SajuCalculator.BRANCH_ELEMENT[s.monthBranch()])]++;
        cnt[groupIndex(dayEl, SajuCalculator.BRANCH_ELEMENT[s.dayBranch()])]++;
        if (s.hasHour()) {
            cnt[groupIndex(dayEl, SajuCalculator.STEM_ELEMENT[s.hourStem()])]++;
            cnt[groupIndex(dayEl, SajuCalculator.BRANCH_ELEMENT[s.hourBranch()])]++;
        }

        int maxCnt = 0;
        for (int g = 0; g < 5; g++) maxCnt = Math.max(maxCnt, cnt[g]);

        // 동점이면 계절을 쥔 월지(세력 최대) 소속 묶음을 우선.
        int monthGroup = groupIndex(dayEl, SajuCalculator.BRANCH_ELEMENT[s.monthBranch()]);
        int best;
        if (cnt[monthGroup] == maxCnt) {
            best = monthGroup;
        } else {
            best = 0;
            for (int g = 0; g < 5; g++) if (cnt[g] == maxCnt) { best = g; break; }
        }

        return new Result(NAME[best], EMOJI[best], List.of(KEYWORDS[best]), DESC[best]);
    }
}
