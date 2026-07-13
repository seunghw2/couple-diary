package com.today.saju;

import com.today.saju.SajuCalculator.Saju;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * 커플 궁합 계산 — 결정론. docs/saju/03-궁합-계산테이블과-템플릿문구.md 스펙 구현.
 * 톤: 부정어 0, 상극·충은 "밀당/자극 케미"로 순화, 낮아도 성장 프레임.
 */
public final class SajuCompatibility {

    private SajuCompatibility() {}

    // 오행: 0목1화2토3금4수 (SajuCalculator와 동일)
    private static final int[] SAMHAP_GROUP = {3, 2, 1, 0, 3, 2, 1, 0, 3, 2, 1, 0};
    private static final int[][] YUKHAP = {{0, 1}, {2, 11}, {3, 10}, {4, 9}, {5, 8}, {6, 7}};
    private static final int[][] GAN_CHUNG = {{0, 6}, {1, 7}, {2, 8}, {3, 9}};

    enum ElemRel { SAME, SHENG_FWD, SHENG_REV, KE_FWD, KE_REV }

    static ElemRel elemRel(int a, int b) {
        if (a == b) return ElemRel.SAME;
        if ((a + 1) % 5 == b) return ElemRel.SHENG_FWD;
        if ((b + 1) % 5 == a) return ElemRel.SHENG_REV;
        if ((a + 2) % 5 == b) return ElemRel.KE_FWD;
        return ElemRel.KE_REV;
    }

    static boolean isGanHap(int g1, int g2) { return Math.abs(g1 - g2) == 5; }
    static boolean isGanChung(int g1, int g2) {
        int lo = Math.min(g1, g2), hi = Math.max(g1, g2);
        for (int[] p : GAN_CHUNG) if (p[0] == lo && p[1] == hi) return true;
        return false;
    }
    static boolean isSamhap(int j1, int j2) { return j1 != j2 && SAMHAP_GROUP[j1] == SAMHAP_GROUP[j2]; }
    static boolean isYukhap(int j1, int j2) {
        int lo = Math.min(j1, j2), hi = Math.max(j1, j2);
        for (int[] p : YUKHAP) if (p[0] == lo && p[1] == hi) return true;
        return false;
    }
    static boolean isJiChung(int j1, int j2) { return Math.abs(j1 - j2) == 6; }

    // ── 오행 분포/상보/균형 ──
    private static double sangboScore(int[] dA, int[] dB) {
        int totalLack = 0, covered = 0;
        for (int e = 0; e < 5; e++) {
            if (dA[e] == 0) { totalLack++; if (dB[e] >= 2) covered++; }
            if (dB[e] == 0) { totalLack++; if (dA[e] >= 2) covered++; }
        }
        return totalLack == 0 ? 0.6 : (double) covered / totalLack;
    }

    private static double balanceScore(int[] combined) {
        double sum = 0; for (int c : combined) sum += c;
        if (sum == 0) return 0.5;
        double mean = sum / 5.0, variance = 0;
        for (int c : combined) variance += (c - mean) * (c - mean);
        variance /= 5.0;
        double maxVar = mean * mean * 4;
        double ratio = maxVar == 0 ? 0 : Math.min(1, Math.max(0, variance / maxVar));
        return 1 - ratio;
    }

    /** 두 사람 모든 글자 음양 합의 균형(1=조화). */
    private static double yinYangScore(Saju a, Saju b) {
        int[] r = {0, 0}; // sum, n
        accYinYang(a, r); accYinYang(b, r);
        if (r[1] == 0) return 0.5;
        return 1 - Math.abs(r[0]) / (double) r[1];
    }
    private static void accYinYang(Saju s, int[] r) {
        addYY(r, s.yearStem() % 2 == 0); addBranchYY(r, s.yearBranch());
        addYY(r, s.monthStem() % 2 == 0); addBranchYY(r, s.monthBranch());
        addYY(r, s.dayStem() % 2 == 0); addBranchYY(r, s.dayBranch());
        if (s.hasHour()) { addYY(r, s.hourStem() % 2 == 0); addBranchYY(r, s.hourBranch()); }
    }
    private static void addYY(int[] r, boolean yang) { r[0] += yang ? 1 : -1; r[1]++; }
    private static void addBranchYY(int[] r, int b) { r[0] += (b % 2 == 0) ? 1 : -1; r[1]++; }

    private static double distSimilarity(int[] dA, int[] dB) {
        double sA = 0, sB = 0; for (int e = 0; e < 5; e++) { sA += dA[e]; sB += dB[e]; }
        if (sA == 0 || sB == 0) return 0.5;
        double diff = 0;
        for (int e = 0; e < 5; e++) diff += Math.abs(dA[e] / sA - dB[e] / sB);
        return 1 - diff / 2;
    }

    private static boolean isOverloadControl(int eA, int eB, int[] combined) {
        ElemRel r = elemRel(eA, eB);
        if (r != ElemRel.KE_FWD && r != ElemRel.KE_REV) return false;
        int suppressed = (r == ElemRel.KE_FWD) ? eB : eA;
        double mean = 0; for (int c : combined) mean += c; mean /= 5.0;
        int maxE = 0; for (int e = 1; e < 5; e++) if (combined[e] > combined[maxE]) maxE = e;
        return combined[suppressed] >= Math.max(mean * 1.5, 1)
                && (suppressed == maxE || combined[suppressed] >= mean * 1.5);
    }

    private static int clamp(int v) { return Math.max(0, Math.min(100, v)); }
    private static int grade(int s) { return s >= 67 ? 2 : (s >= 34 ? 1 : 0); }

    // ── 결과 DTO ──
    public record CategoryScore(String key, String name, int score, int grade, String comment) {}
    public record Result(int percent, List<CategoryScore> categories, String totalComment,
                         List<String> badges, String relComment, String strongestKey, boolean hasHour) {}

    public static Result compute(Saju a, Saju b, LocalDate birthA, LocalDate birthB) {
        int dEA = SajuCalculator.STEM_ELEMENT[a.dayStem()], dEB = SajuCalculator.STEM_ELEMENT[b.dayStem()];
        int[] dA = a.elementCount(), dB = b.elementCount();
        int[] combined = new int[5];
        for (int e = 0; e < 5; e++) combined[e] = dA[e] + dB[e];

        double sangbo = sangboScore(dA, dB), balance = balanceScore(combined), yy = yinYangScore(a, b);
        double distSim = distSimilarity(dA, dB);
        ElemRel rel = elemRel(dEA, dEB);
        boolean shengDay = rel == ElemRel.SHENG_FWD || rel == ElemRel.SHENG_REV;
        boolean sameDay = rel == ElemRel.SAME;

        boolean ganHap = isGanHap(a.dayStem(), b.dayStem());
        boolean ganChung = isGanChung(a.dayStem(), b.dayStem());
        boolean samYear = isSamhap(a.yearBranch(), b.yearBranch()), yukYear = isYukhap(a.yearBranch(), b.yearBranch());
        boolean samMon = isSamhap(a.monthBranch(), b.monthBranch()), yukMon = isYukhap(a.monthBranch(), b.monthBranch()), chMon = isJiChung(a.monthBranch(), b.monthBranch());
        boolean samDay = isSamhap(a.dayBranch(), b.dayBranch()), yukDay = isYukhap(a.dayBranch(), b.dayBranch()), chDay = isJiChung(a.dayBranch(), b.dayBranch());
        boolean yinYangComplementDay = (a.dayStem() % 2) != (b.dayStem() % 2);
        boolean control = isOverloadControl(dEA, dEB, combined);

        int chemi = clamp(30 + (ganHap ? 40 : 0) + (samYear ? 25 : 0) + (yukYear ? 15 : 0)
                + (shengDay ? 15 : (sameDay ? 8 : 0)) + (yinYangComplementDay ? 10 : 0) - (ganChung ? 12 : 0));
        int talk = clamp(35 + (shengDay ? 30 : (sameDay ? 18 : 0)) + (samMon ? 18 : (yukMon ? 14 : 0))
                + (distSim >= 0.6 ? 20 : 0) - (chMon ? 18 : 0));
        int affection = clamp(32 + (yukDay ? 35 : 0) + (samDay ? 25 : 0) + (combined[1] >= 3 ? 15 : 0)
                + (yy >= 0.5 ? 15 : 0) - (chDay ? 15 : 0));
        int stability = clamp(30 + (yukDay ? 30 : 0) + (int) Math.round(30 * sangbo) + (int) Math.round(20 * balance)
                + (samDay ? 12 : 0) - (chDay ? 20 : 0));
        int growth = clamp(40 + (control ? 30 : 0) + (int) Math.round(25 * yy) + (int) Math.round(25 * sangbo)
                - (balance < 0.3 ? 15 : 0));

        double raw = chemi * 0.25 + talk * 0.20 + affection * 0.20 + stability * 0.20 + growth * 0.15;
        double norm = Math.min(1, Math.max(0, (raw - 30.0) / (90.0 - 30.0)));
        int percent = (int) Math.round(60 + norm * 39);

        long seed = seed(birthA, birthB);

        List<CategoryScore> cats = new ArrayList<>();
        cats.add(cat("CHEMI", "첫끌림", chemi, CHEMI_T, seed));
        cats.add(cat("TALK", "대화", talk, TALK_T, seed));
        cats.add(cat("AFFECTION", "애정", affection, AFFECTION_T, seed));
        cats.add(cat("STABILITY", "안정감", stability, STABILITY_T, seed));
        cats.add(cat("GROWTH", "성장", growth, GROWTH_T, seed));

        String strongest = "GROWTH"; int best = -1;
        for (CategoryScore c : cats) if (c.score() > best) { best = c.score(); strongest = c.key(); }

        String[] totalBucket = percent >= 95 ? TOTAL_95 : percent >= 85 ? TOTAL_85 : percent >= 75 ? TOTAL_75 : percent >= 65 ? TOTAL_65 : TOTAL_60;
        String totalComment = pick(totalBucket, seed, 91);

        String relComment;
        if (sangbo >= 0.5) relComment = pick(REL_SANGBO, seed, 41);
        else if (sameDay) relComment = pick(REL_SAME, seed, 41);
        else if (shengDay) relComment = pick(REL_SHENG, seed, 41);
        else relComment = pick(REL_KE, seed, 41);

        List<String> badges = new ArrayList<>();
        boolean samAny = samYear || samMon || samDay, yukAny = yukYear || yukMon || yukDay;
        int samCount = (samYear ? 1 : 0) + (samMon ? 1 : 0) + (samDay ? 1 : 0);
        boolean destiny = ganHap && (samAny || yukAny);
        if (destiny) badges.add(BADGE_DESTINY);
        if (samCount >= 2) badges.add(BADGE_TRIPLE_HAP);
        if (yy >= 0.9 && balance >= 0.7) badges.add(BADGE_PERFECT_YINYANG);
        if (sangbo >= 0.75) badges.add(BADGE_PUZZLE);
        if (ganHap && !destiny) badges.add(BADGE_GANHAP);
        if (badges.size() > 2) badges = badges.subList(0, 2);

        return new Result(percent, cats, totalComment, badges, relComment, strongest, a.hasHour() && b.hasHour());
    }

    private static CategoryScore cat(String key, String name, int score, String[][] templates, long seed) {
        int g = grade(score);
        String comment = pick(templates[g], seed, key.hashCode());
        return new CategoryScore(key, name, score, g, comment);
    }

    private static long seed(LocalDate a, LocalDate b) {
        long ya = a.getYear() * 10000L + a.getMonthValue() * 100L + a.getDayOfMonth();
        long yb = b.getYear() * 10000L + b.getMonthValue() * 100L + b.getDayOfMonth();
        long lo = Math.min(ya, yb), hi = Math.max(ya, yb);
        return lo * 100000000L + hi;
    }

    private static String pick(String[] arr, long seed, long salt) {
        return arr[(int) Math.floorMod(seed + salt, arr.length)];
    }

    // ───────── 문구 (docs/saju/03) ─────────
    private static final String[][] CHEMI_T = {
        {"서로 다른 매력이 부딪히는 순간! 알아가는 재미가 넘치는 두 분이에요. 🧭",
         "처음엔 낯설어도, 그래서 더 궁금해지는 사이. 설렘을 함께 채워가면 좋아요. 🌱",
         "정반대에서 시작한 만남! 다른 점이 많을수록 발견할 매력도 많은 커플이에요. 🎁"},
        {"은근하게 스며드는 매력의 두 분! 볼수록 더 좋아지는 슬로우 케미예요. 🌤️",
         "첫눈에 반한 건 아니어도, 알아갈수록 빠져드는 재미가 있어요. 🍀",
         "천천히 데워지는 두 분의 케미, 지금부터가 진짜 시작이에요. 🔥"},
        {"처음 본 순간부터 '이 사람이다' 싶으셨죠? 자석처럼 끌리는 케미예요. ⚡",
         "첫인상부터 심장이 두근! 눈이 먼저 알아본 두 분이에요. 💓",
         "설렘 지수 만점! 함께 있으면 공기마저 반짝이는 커플이에요. ✨"},
    };
    private static final String[][] TALK_T = {
        {"대화 스타일이 조금 달라요! 그래서 '오늘 뭐 했어?' 한마디가 더 소중한 두 분이에요. 📞",
         "표현 방식이 서로 달라서, 마음을 자주 나눌수록 더 가까워지는 성장형 커플이에요. 💌",
         "언어가 다른 만큼 서로를 배워가는 재미가 커요. 오늘 한마디부터 건네보세요. 🕊️"},
        {"대화가 잘 통하는 편! 가끔 어긋나도 금방 맞춰가는 두 분이에요. 🗨️",
         "말이 잘 맞는 순간이 많아요. 조금씩 더 귀 기울이면 훨씬 깊어질 사이예요. 👂",
         "서로의 말투가 다르지만 그게 오히려 대화를 풍성하게 만들어요. 🌈"},
        {"말하지 않아도 통하는 사이. 눈빛만 봐도 아는 커플이에요. 💬",
         "대화가 술술 이어지는 두 분! 밤새 이야기해도 시간 가는 줄 모르죠. 🌙",
         "생각의 결이 비슷해서 '어 나도!'가 자주 나오는 찰떡 소통 커플이에요. 🎯"},
    };
    private static final String[][] AFFECTION_T = {
        {"표현이 서툴러도 마음은 누구보다 진한 두 분! 한 번의 '좋아해'가 큰 힘이 돼요. 💞",
         "가끔 이유 없이 삐지는 귀여운 츤데레 포인트가 있어요. 사실 그게 애정의 증거랍니다. 😤❤️",
         "사랑을 표현하는 언어가 서로 달라요. 자주 확인하며 채워가면 더 애틋해지는 커플이에요. 🌱"},
        {"은은하게 애정을 표현하는 두 분! 작은 다정함이 쌓여 큰 사랑이 돼요. 🌼",
         "표현은 담백해도 마음은 깊은 커플이에요. 가끔 더 솔직해지면 완벽! 💗",
         "서로를 아끼는 마음이 느껴지는 두 분, 표현을 조금 더 얹으면 금상첨화예요. ✨"},
        {"애정이 자연스럽게 흘러넘치는 두 분! 표현에 진심이 가득해요. ❤️",
         "사랑한다는 말이 아깝지 않은 커플. 서로에게 다정함이 몸에 뱄어요. 🥰",
         "곁에 있는 것만으로 따뜻해지는 두 분, 애정 표현 만렙이에요. 🌷"},
    };
    private static final String[][] STABILITY_T = {
        {"서로 다른 세계에서 온 두 사람! 맞춰가는 만큼 더 특별해지는 성장형 커플이에요. 🌱",
         "아직 리듬을 맞춰가는 중이에요. 함께 쌓아갈 안정감이 앞으로 더 커질 두 분! 🧩",
         "다른 속도로 걷는 두 분이지만, 손잡고 보폭을 맞추면 어디든 갈 수 있어요. 👣"},
        {"차분하게 서로를 지켜주는 두 분! 함께한 시간만큼 더 단단해질 거예요. 🧱",
         "안정감이 자라나는 중인 커플이에요. 작은 약속을 지켜갈수록 더 든든해져요. 🤝",
         "편안함과 설렘 사이의 균형을 잡아가는 두 분, 좋은 페이스예요. ⚖️"},
        {"함께 있으면 마음이 편안해지는 사이. 오래오래 갈 든든한 커플이에요. 🏡",
         "곁에 있으면 세상 다 가진 듯 안심되는 두 분, 뿌리 깊은 나무 같아요. 🌳",
         "요란하지 않아도 단단한 사이. 시간이 지날수록 더 깊어질 커플이에요. ⚓"},
    };
    private static final String[][] GROWTH_T = {
        {"채워갈 여백이 많다는 건 함께 클 여지가 크다는 뜻! 성장할 일만 남은 두 분이에요. 🌱",
         "서로 다른 결을 맞춰가는 노력형 커플. 그 과정 자체가 사랑을 단단하게 만들어요. 💪",
         "지금은 서로를 알아가는 시작점! 하나씩 맞춰갈 때마다 더 특별해지는 커플이에요. ✨"},
        {"서로 배우고 채워가는 두 분! 함께하는 만큼 나란히 자라나는 커플이에요. 🌱",
         "밸런스를 맞춰가는 재미가 있는 사이. 조금씩 서로를 닮아가고 있어요. 🔄",
         "다른 점을 강점으로 바꿔가는 두 분, 성장 잠재력이 큰 커플이에요. 📈"},
        {"서로의 부족한 부분을 딱 채워주는 퍼즐 같은 커플. 함께라 더 완벽해요. 🧩",
         "한쪽이 넘칠 때 다른 쪽이 잡아주는 완벽한 밸런스! 함께 성장하는 두 분이에요. 🌿",
         "서로에게 좋은 자극이 되는 사이. 만날수록 더 나은 사람이 되는 커플이에요. 🚀"},
    };
    private static final String[] TOTAL_95 = {
        "이건 뭐… 하늘이 정해준 짝 아닌가요? 이 인연, 꼭 아껴주세요! 💍",
        "만나기 어려운 찰떡 궁합! 서로가 서로에게 선물 같은 두 분이에요. 🎁"};
    private static final String[] TOTAL_85 = {
        "손발이 척척 맞는 환상의 짝꿍! 함께라면 무엇이든 즐거운 두 분이에요. 💞",
        "곁에 있는 게 참 자연스러운 커플. 서로에게 편안한 안식처 같아요. 🏝️"};
    private static final String[] TOTAL_75 = {
        "잘 어울리는 두 분! 서로의 좋은 점을 알아봐 주는 다정한 커플이에요. 🌷",
        "따뜻한 케미가 흐르는 사이. 지금처럼 아껴주면 더 깊어질 인연이에요. 💗"};
    private static final String[] TOTAL_65 = {
        "서로 다른 매력으로 균형을 이루는 두 분! 함께 만들어갈 이야기가 기대돼요. 🌈",
        "알아갈수록 잘 맞는 부분이 늘어나는 커플. 오늘도 한 걸음 가까워졌어요. 👣"};
    private static final String[] TOTAL_60 = {
        "궁합은 숫자보다 노력! 함께 만들어가는 재미가 있는 성장형 커플이에요. 화이팅! 💪",
        "서로 다른 두 세계가 만나 새로운 이야기를 써가는 중! 채워갈수록 빛나는 두 분이에요. ✨"};
    private static final String[] REL_SAME = {
        "닮은꼴 두 분! 취향도 리듬도 비슷해서 편안하게 통하는 사이예요. 👯",
        "같은 결을 가진 커플. 말 안 해도 마음이 맞아떨어질 때가 많아요. 🪞",
        "비슷한 에너지의 두 분, 함께 있으면 자연스럽게 편안해져요. ☁️"};
    private static final String[] REL_SHENG = {
        "한쪽이 다른 쪽을 북돋아 주는 관계! 함께 있으면 서로가 더 빛나는 두 분이에요. 🌟",
        "서로에게 에너지를 채워주는 사이. 곁에 있을수록 힘이 나는 커플이에요. 🔋",
        "자연스럽게 서로를 키워주는 관계예요. 응원이 오가는 따뜻한 두 분! 🌻"};
    private static final String[] REL_KE = {
        "톡톡 튀는 밀당 케미의 두 분! 서로에게 좋은 자극이 되는 사이예요. ✨",
        "다른 기운이 만나 스파크가 튀는 커플. 그 긴장감이 오히려 설렘이 돼요. ⚡",
        "서로를 살짝 자극하며 균형을 잡아가는 두 분, 함께라 더 단단해져요. 🎇"};
    private static final String[] REL_SANGBO = {
        "내게 없는 걸 상대가 가진 두 분! 서로의 빈칸을 채워주는 찰떡 조합이에요. 🧩",
        "부족한 부분을 딱 메워주는 관계. 함께라 비로소 완성되는 커플이에요. 🤲",
        "서로의 결핍을 채워주는 따뜻한 궁합. 곁에 있어 더 든든한 두 분이에요. 🫶"};
    private static final String BADGE_DESTINY = "⭐ 운명적 커플 인증! 천간합과 지지의 합이 동시에 겹치는, 흔치 않은 인연이에요.";
    private static final String BADGE_TRIPLE_HAP = "🍀 삼합 겹경사! 여러 자리에서 죽이 척척 맞는 찰떡 조합이에요.";
    private static final String BADGE_PERFECT_YINYANG = "☯️ 음양 완벽 조화! 서로의 반대편을 정확히 채워주는 균형의 커플이에요.";
    private static final String BADGE_PUZZLE = "🧩 퍼즐 커플 인증! 서로의 빈 조각을 딱 맞춰주는 보완의 달인들이에요.";
    private static final String BADGE_GANHAP = "💞 천생연분 끌림! 두 사람 사이에 자연스러운 이끌림이 흐르는 커플이에요.";
}
