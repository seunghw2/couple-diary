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
        {"서로 다른 오행의 기운이 만나 톡톡 부딪히는 두 분이에요. 처음엔 낯선 매력이 오히려 눈길을 끌어, 알아갈수록 새로운 면을 발견하는 재미가 커요. 다른 결을 맞춰갈수록 끌림이 더 깊어질 사이랍니다. 🧭",
         "첫 느낌은 조금 낯설어도, 그래서 더 궁금해지는 사이예요. 상반된 기운은 서로에게 없는 걸 비춰주기 마련이라, 마주할수록 '이 사람 뭐지?' 싶은 설렘이 생겨요. 함께 채워갈 여백이 많은 커플이에요. 🌱",
         "정반대의 기운에서 시작한 만남이에요. 닮은 점보다 다른 점이 많아 보여도, 그 차이가 곧 발견할 매력이 그만큼 많다는 뜻이랍니다. 다름을 즐길수록 케미가 살아나는 두 분이에요. 🎁"},
        {"은은하게 스며드는 매력을 지닌 두 분이에요. 서로의 기운이 부드럽게 통해서, 첫눈에 불이 붙기보다 볼수록 자연스럽게 좋아지는 슬로우 케미랍니다. 시간이 편이 되어주는 사이예요. 🌤️",
         "첫눈에 반한 건 아니어도, 곁에 두고 알아갈수록 스며드는 재미가 있어요. 두 사람의 기운이 서로를 크게 밀어내지 않아, 함께 있는 시간이 편안하게 쌓여가요. 잔잔하지만 오래갈 끌림이에요. 🍀",
         "천천히 데워지는 두 분의 케미예요. 급하게 타오르지 않는 만큼 은근하고 안정적으로 이어져, 지금부터가 진짜 시작이랍니다. 서로에게 맞춰갈수록 온도가 올라가는 사이예요. 🔥"},
        {"처음 본 순간부터 '이 사람이다' 싶으셨죠? 두 분의 기운이 서로를 강하게 끌어당겨, 자석처럼 붙는 케미를 지녔어요. 눈빛과 분위기가 먼저 통하는, 흔치 않은 첫끌림이랍니다. ⚡",
         "첫인상부터 심장이 두근거린 두 분이에요. 상생하듯 서로의 기운을 북돋는 조합이라, 함께 있으면 자연스럽게 설렘이 차올라요. 눈이 먼저 서로를 알아본 인연이에요. 💓",
         "설렘 지수 만점의 커플이에요. 두 사람의 기운이 조화롭게 어우러져, 곁에 있으면 공기마저 반짝이는 특별함이 흘러요. 처음의 두근거림이 오래 이어질 사이랍니다. ✨"},
    };
    private static final String[][] TALK_T = {
        {"대화 스타일이 서로 조금 달라요. 한 사람이 앞서 말하면 다른 사람은 담아두는 결이라, '오늘 뭐 했어?' 한마디가 더 소중해지는 두 분이에요. 자주 물어봐 줄수록 마음이 오가는 사이랍니다. 📞",
         "표현 방식이 서로 달라서, 처음엔 말이 스칠 때도 있어요. 하지만 다른 언어를 배우듯 서로를 알아갈수록 훨씬 가까워지는 성장형 커플이에요. 자주 나눌수록 통하는 폭이 넓어져요. 💌",
         "쓰는 말의 온도가 다른 만큼, 서로를 배워가는 재미가 큰 두 분이에요. 다름은 곧 새로 알아갈 이야기가 많다는 뜻이랍니다. 오늘 한마디부터 다정하게 건네보세요. 🕊️"},
        {"대화가 제법 잘 통하는 두 분이에요. 기운이 서로를 밀어내지 않아 가끔 어긋나도 금방 맞춰가고, 대화 끝에는 웃음이 남는 사이랍니다. 조금 더 귀 기울이면 훨씬 깊어질 커플이에요. 🗨️",
         "말이 잘 맞는 순간이 많은 두 분이에요. 서로의 기운이 자연스레 흐름을 이어줘, 대화가 편안하게 오가요. 상대의 말끝을 조금 더 들어주면 마음까지 통하는 사이가 돼요. 👂",
         "말투는 서로 다르지만, 그 차이가 오히려 대화를 풍성하게 만드는 두 분이에요. 한 사람이 던지면 다른 사람이 새로운 결로 받아줘서, 이야기가 지루할 틈이 없답니다. 🌈"},
        {"말하지 않아도 통하는 사이예요. 두 분의 기운이 같은 결로 흘러, 눈빛만 봐도 마음을 아는 커플이랍니다. 짧은 한마디에도 서로의 뜻이 고스란히 전해지는 소통력을 지녔어요. 💬",
         "대화가 술술 이어지는 두 분이에요. 서로의 기운이 잘 맞아 화제가 끊이지 않고, 밤새 이야기해도 시간 가는 줄 모르죠. 함께 나누는 대화 자체가 즐거움인 커플이에요. 🌙",
         "생각의 결이 비슷해서 '어, 나도!'가 자주 나오는 두 분이에요. 서로의 기운이 닮아 공감이 빠르고, 말이 오갈수록 마음이 포개지는 찰떡 소통 커플이랍니다. 🎯"},
    };
    private static final String[][] AFFECTION_T = {
        {"표현이 조금 서툴러도 마음은 누구보다 진한 두 분이에요. 애정의 언어가 서로 달라 겉으로 덜 드러날 뿐, 한 번의 '좋아해'가 큰 힘이 되는 사이랍니다. 자주 확인해 줄수록 애틋해져요. 💞",
         "가끔 이유 없이 삐지는 귀여운 츤데레 포인트가 있는 두 분이에요. 사실 그건 상대를 그만큼 신경 쓴다는 애정의 증거랍니다. 마음을 솔직하게 말로 얹으면 더 사랑스러워져요. 😤❤️",
         "사랑을 표현하는 언어가 서로 달라요. 한 사람은 말로, 다른 사람은 행동으로 마음을 전하는 결이라, 자주 확인하며 맞춰갈수록 더 애틋해지는 커플이에요. 표현을 아끼지 마세요. 🌱"},
        {"은은하게 애정을 표현하는 두 분이에요. 화려하진 않아도 작은 다정함이 차곡차곡 쌓여 큰 사랑이 되는 사이랍니다. 서로를 향한 마음이 잔잔하게 흐르는 따뜻한 커플이에요. 🌼",
         "표현은 담백해도 마음은 깊은 두 분이에요. 서로의 기운이 편안하게 통해 굳이 요란하지 않아도 애정이 느껴져요. 가끔 마음을 솔직하게 꺼내 놓으면 사랑이 더 선명해져요. 💗",
         "서로를 아끼는 마음이 은은하게 느껴지는 두 분이에요. 곁에 있는 것만으로 편안함을 주는 사이라, 여기에 다정한 표현을 조금 더 얹으면 금상첨화랍니다. ✨"},
        {"애정이 자연스럽게 흘러넘치는 두 분이에요. 서로의 기운이 온기를 북돋는 조합이라, 표현에 진심이 가득 담겨요. 사랑한다는 마음이 말과 행동에 고스란히 묻어나는 커플이랍니다. ❤️",
         "사랑한다는 말이 아깝지 않은 두 분이에요. 다정함이 몸에 배어 있어 서로를 챙기는 게 자연스럽고, 곁에 있는 순간마다 애정이 오가요. 보기만 해도 흐뭇한 커플이에요. 🥰",
         "곁에 있는 것만으로 따뜻해지는 두 분이에요. 서로의 기운이 포근하게 어우러져, 애정 표현이 물 흐르듯 자연스럽답니다. 사랑을 나누는 데 있어 만렙인 커플이에요. 🌷"},
    };
    private static final String[][] STABILITY_T = {
        {"서로 다른 세계에서 온 듯한 두 분이에요. 기운의 결이 다른 만큼 처음엔 리듬이 어긋날 수 있지만, 맞춰가는 그 과정이 오히려 사이를 특별하게 만들어요. 함께 쌓아갈 안정감이 큰 성장형 커플이랍니다. 🌱",
         "아직 서로의 리듬을 맞춰가는 중인 두 분이에요. 지금은 균형을 찾아가는 시기라, 작은 약속을 하나씩 지켜갈수록 안정감이 눈에 띄게 자라날 거예요. 시간이 든든한 편이 되어줄 사이랍니다. 🧩",
         "서로 다른 속도로 걷는 두 분이지만, 손을 잡고 보폭을 맞추면 어디든 함께 갈 수 있어요. 다른 기운이 만난 만큼 배려가 쌓일수록 단단해지는 커플이랍니다. 천천히 함께 걸어가 보세요. 👣"},
        {"차분하게 서로를 지켜주는 두 분이에요. 기운이 크게 부딪히지 않아 곁에 있으면 편안하고, 함께한 시간만큼 사이가 더 단단해져요. 조용하지만 믿음직한 안정감을 지닌 커플이랍니다. 🧱",
         "안정감이 무럭무럭 자라나는 중인 두 분이에요. 서로의 기운이 부드럽게 받쳐줘서, 작은 약속을 지켜갈수록 관계가 든든해져요. 편안함과 신뢰가 나란히 커가는 커플이에요. 🤝",
         "편안함과 설렘 사이에서 균형을 잘 잡아가는 두 분이에요. 서로의 기운이 조화롭게 어우러져, 안심되면서도 지루하지 않은 좋은 페이스를 유지하고 있답니다. ⚖️"},
        {"함께 있으면 마음이 절로 편안해지는 두 분이에요. 서로의 기운이 든든하게 받쳐주는 조합이라, 곁에 있는 것만으로 안심이 되는 사이랍니다. 오래오래 함께할 뿌리 깊은 커플이에요. 🏡",
         "곁에 있으면 세상 다 가진 듯 안심되는 두 분이에요. 두 사람의 기운이 서로를 굳건히 지탱해줘, 흔들림 없는 안정감이 흘러요. 뿌리 깊은 나무처럼 든든한 커플이랍니다. 🌳",
         "요란하지 않아도 속이 단단한 두 분이에요. 서로의 기운이 안정적으로 맞물려, 시간이 지날수록 사이가 더 깊어져요. 세월이 편이 되어주는 믿음직한 커플이랍니다. ⚓"},
    };
    private static final String[][] GROWTH_T = {
        {"채워갈 여백이 많다는 건 함께 클 여지가 그만큼 크다는 뜻이에요. 서로의 기운이 아직 낯설어도, 부족한 부분을 함께 메워가는 과정이 두 분을 더 단단하게 만들어요. 성장할 일만 남은 커플이랍니다. 🌱",
         "서로 다른 결을 맞춰가는 노력형 커플이에요. 다른 기운이 만난 만큼 부딪힘도 있겠지만, 그 과정 자체가 사랑을 더 깊고 단단하게 다져줘요. 함께 넘는 언덕마다 사이가 좋아질 거예요. 💪",
         "지금은 서로를 알아가는 시작점에 선 두 분이에요. 다른 기운을 하나씩 맞춰갈 때마다 새로운 매력이 발견되고, 그만큼 관계가 특별해져요. 앞으로 써갈 이야기가 기대되는 커플이랍니다. ✨"},
        {"서로 배우고 채워가는 두 분이에요. 기운이 부드럽게 통하면서도 각자 다른 강점이 있어, 함께하는 만큼 나란히 자라나요. 서로에게 좋은 자극이 되어주는 커플이랍니다. 🌱",
         "밸런스를 맞춰가는 재미가 있는 두 분이에요. 한 사람의 넘치는 부분을 다른 사람이 다독여주며 조금씩 서로를 닮아가요. 함께할수록 균형이 잡히는 성장형 커플이에요. 🔄",
         "다른 점을 강점으로 바꿔가는 두 분이에요. 서로의 기운이 부족한 곳을 채워주는 조합이라, 만날수록 각자 더 나은 사람이 돼요. 성장 잠재력이 큰 커플이랍니다. 📈"},
        {"서로의 부족한 부분을 딱 채워주는 퍼즐 같은 두 분이에요. 한 사람의 기운이 비는 자리를 다른 사람이 정확히 메워줘, 함께라 비로소 완성되는 사이랍니다. 곁에 있어 더 든든한 커플이에요. 🧩",
         "한쪽이 넘칠 때 다른 쪽이 잡아주는 완벽한 밸런스를 지닌 두 분이에요. 서로의 기운이 균형을 이뤄, 함께하면 자연스럽게 안정과 성장이 동시에 따라와요. 서로를 키워주는 커플이랍니다. 🌿",
         "서로에게 더없이 좋은 자극이 되는 두 분이에요. 다른 기운이 만나 균형을 이루며, 만날수록 각자 더 나은 사람이 되어가요. 함께 성장하는 이상적인 커플이랍니다. 🚀"},
    };
    private static final String[] TOTAL_95 = {
        "이건 뭐… 하늘이 정해준 짝 아닌가요? 두 분의 기운이 서로를 끌어당기고 채워주는, 좀처럼 만나기 힘든 인연이에요. 이렇게 귀한 인연, 오래오래 아껴주세요! 💍",
        "만나기 어려운 찰떡 궁합의 두 분이에요. 오행의 결이 조화롭게 어우러져 함께 있는 것만으로 서로가 서로에게 선물 같은 존재랍니다. 지금의 이 마음을 소중히 지켜가면 좋겠어요. 🎁"};
    private static final String[] TOTAL_85 = {
        "손발이 척척 맞는 환상의 짝꿍이에요. 서로의 기운이 자연스럽게 통해서, 함께라면 무엇을 해도 즐거운 두 분이랍니다. 지금처럼 서로를 아껴가면 사이가 더 깊어질 거예요. 💞",
        "곁에 있는 게 참 자연스러운 두 분이에요. 두 사람의 기운이 편안하게 맞물려, 서로에게 마음 놓고 기댈 수 있는 안식처가 되어줘요. 오래도록 든든할 좋은 인연이랍니다. 🏝️"};
    private static final String[] TOTAL_75 = {
        "참 잘 어울리는 두 분이에요. 서로의 좋은 점을 알아봐 주고 다독여주는 다정한 사이라, 함께 있으면 마음이 따뜻해져요. 지금처럼 서로를 바라봐 주면 사이가 더 깊어질 거예요. 🌷",
        "따뜻한 케미가 은은하게 흐르는 두 분이에요. 기운이 서로를 부드럽게 받쳐줘, 함께하는 시간이 편안하게 쌓여가요. 지금처럼 아껴주면 더 애틋해질 인연이랍니다. 💗"};
    private static final String[] TOTAL_65 = {
        "서로 다른 매력으로 균형을 이루는 두 분이에요. 기운의 결이 달라 오히려 서로에게 없는 걸 채워주는 사이라, 함께 만들어갈 이야기가 기대돼요. 다름을 즐길수록 빛나는 커플이랍니다. 🌈",
        "알아갈수록 잘 맞는 부분이 하나씩 늘어나는 두 분이에요. 지금도 서로를 향해 한 걸음씩 다가가는 중이라, 시간이 편이 되어주는 성장형 커플이에요. 오늘도 한 뼘 가까워졌어요. 👣"};
    private static final String[] TOTAL_60 = {
        "궁합은 숫자보다 함께 쌓아가는 마음이 만들어가는 거예요. 서로 다른 기운이 만난 만큼 채워갈 여백도 크고, 그건 곧 함께 클 여지가 많다는 뜻이랍니다. 하나씩 맞춰가는 재미가 있는 성장형 커플이에요. 화이팅! 💪",
        "서로 다른 두 세계가 만나 새로운 이야기를 써가는 중인 두 분이에요. 다른 기운이 부딪히며 서로를 알아갈수록 사이가 단단해져요. 채워갈수록 더 빛나는, 앞날이 기대되는 커플이랍니다. ✨"};

    /** 커플이 더 잘 지내기 위한 따뜻한 조언 한 줄 (오행·기운 살짝 언급). */
    public static final String[] TIPS = {
        "서로의 다른 점을 고치려 하기보다 있는 그대로 반겨주면, 두 분의 기운이 더 부드럽게 어우러져요. 🌿",
        "고마웠던 순간을 자주 말로 표현해 보세요. 다정한 한마디가 서로의 온기를 데워주는 불씨가 돼요. 🔥",
        "가끔은 함께 물가나 바다처럼 탁 트인 곳을 걸어보세요. 잔잔한 물의 기운이 마음을 편안하게 풀어줘요. 🌊",
        "서로의 하루를 5분만 천천히 들어주는 습관이 안정감이라는 든든한 뿌리를 키워줘요. 🌳",
        "의견이 부딪힐 땐 이기려 하기보다 한 박자 쉬어가 보세요. 잠깐의 여유가 두 기운의 균형을 잡아줘요. ⚖️",
        "작은 약속을 지켜가는 일이 쌓이면, 두 분 사이에 흔들리지 않는 신뢰의 대지가 만들어져요. ⛰️",
        "함께 새로운 걸 시도해 보세요. 나무의 기운처럼 뻗어나가는 경험이 관계에 생기를 더해줘요. 🌱",
        "표현이 서툰 쪽의 마음을 넉넉히 기다려 주면, 은은한 촛불 같은 애정이 더 환하게 켜져요. 🕯️",
        "서로의 강점을 칭찬해 주세요. 인정받는 순간 상대의 좋은 기운이 한층 밝게 빛나요. ✨",
        "가끔은 아무 계획 없이 함께 쉬어가는 시간을 가져보세요. 비워둔 여백에서 마음이 더 가까워져요. 🍃",
        "화가 날 땐 '지금 이 마음' 하나만 솔직하게 전해보세요. 담아두기보다 흘려보내면 기운이 맑아져요. 💧",
        "서로에게 없는 걸 채워주는 걸 부담이 아닌 선물로 여겨보세요. 그게 두 분을 완성하는 퍼즐이랍니다. 🧩",
    };
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
