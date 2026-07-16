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
    // 점수↔설명 온도 매칭: 상 70+, 중 45+, 하 그 외. (낮은 점수가 '중'에 머물지 않도록 컷 상향)
    private static int grade(int s) { return s >= 70 ? 2 : (s >= 45 ? 1 : 0); }

    // ── 결과 DTO ──
    public record CategoryScore(String key, String name, int score, int grade, String comment) {}
    public record Result(int percent, List<CategoryScore> categories, String totalComment,
                         List<String> badges, String relComment, String strongestKey, String weakestKey,
                         List<String> keywords, List<String> summaryLines, List<String> tips, boolean hasHour) {}

    public static Result compute(Saju a, Saju b, LocalDate birthA, LocalDate birthB, String nameA, String nameB) {
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

        // 이름 안전값(공백/널 → 중립 표현). 뒤에 "님"을 붙이므로 이미 "님"으로 끝나면 중복 제거.
        String nA = honBase(nameA, "한 분");
        String nB = honBase(nameB, "다른 분");

        // 관계 feature → 행동 시그니처(구체성). 카테고리마다 가장 강한 feature 하나만 얹는다.
        String behChemi = ganChung
                ? "생각이 부딪힐 땐 둘 다 물러서지 않아 스파크가 튀지만, 그만큼 서로에게 솔직한 사이예요."
                : yinYangComplementDay
                    ? (speedFast(a) ? nA : nB) + "님은 마음이 정해지면 바로 움직이고, " + (speedFast(a) ? nB : nA) + "님은 한 박자 살핀 뒤 확신이 서요. 서두름과 신중함이 서로를 채워줘요."
                    : ganHap ? "서로를 끌어당기는 힘이 유난히 강해, 눈이 먼저 서로를 알아본 사이예요." : null;
        String sigTalk = chMon
                ? "생활 리듬이 살짝 어긋나는 편이라, 함께 있는 시간대를 정해두면 훨씬 편해져요."
                : distSim < 0.35
                    ? "말은 잘 통한다 느끼지만 서운함은 오히려 늦게 꺼내는 조합이에요. '나는 지금'으로 바로 표현하면 안 쌓여요."
                    : distSim >= 0.6 ? "'나도 방금 그 생각!'이 자주 나올 만큼 결이 비슷해요. 가끔 서로 다른 시각을 일부러 꺼내보면 더 넓어져요." : null;
        String sigAff = combined[1] < 2
                ? "마음은 깊은데 '좋아해'를 말보다 행동으로 보여주는 편이라, 하루 한 번 말로 표현하면 더 안심돼요."
                : combined[1] >= 4
                    ? "좋고 싫음이 표정과 말에 바로 드러나 감정을 숨기기 어려운 사이예요. 표현이 풍부한 만큼 한 템포만 쉬면 완벽해요."
                    : (yukDay || samDay) ? "둘만 있을 때 유독 편안해지는 조합이라, 밖에서보다 단둘이 있을 때 진짜 모습이 나와요." : null;
        String sigStab = chDay
                ? (calmSide(a) ? nA : nB) + "님은 다툰 뒤 혼자 정리할 시간이 필요하고, " + (calmSide(a) ? nB : nA) + "님은 바로 풀고 싶어 하는 편이에요. 이 타이밍만 맞추면 회복이 빨라져요."
                : sangbo >= 0.5 ? "역할이 겹치지 않아, 한 분이 놓치는 걸 다른 분이 자연스럽게 챙기는 팀플레이형이에요." : null;
        String behGrowth = control
                ? (aBrake(rel) ? nB : nA) + "님이 달아오를 때 " + (aBrake(rel) ? nA : nB) + "님이 자연스럽게 브레이크가 되어줘요. 잔소리 같아도 균형을 잡아주는 거예요."
                : balance < 0.3 ? "비슷한 기운이 한쪽으로 모여 있어, 잘 맞을 땐 최고지만 지칠 땐 함께 지치기 쉬워요. 번갈아 기분을 끌어올려 주면 좋아요." : null;

        // 사주(오행) 근거를 설명에 실어 전문성을 더한다. 첫끌림=일간 오행 관계, 성장=오행 분포 상보.
        String sigChemi = joinSig(dayMasterElemClause(nA, dEA, nB, dEB), behChemi);
        String sigGrowth = joinSig(elemDistClause(nA, dA, nB, dB), behGrowth);

        List<CategoryScore> cats = new ArrayList<>();
        cats.add(cat("CHEMI", "첫끌림", chemi, CHEMI_T, seed, sigChemi));
        cats.add(cat("TALK", "대화", talk, TALK_T, seed, sigTalk));
        cats.add(cat("AFFECTION", "애정", affection, AFFECTION_T, seed, sigAff));
        cats.add(cat("STABILITY", "안정감", stability, STABILITY_T, seed, sigStab));
        cats.add(cat("GROWTH", "성장", growth, GROWTH_T, seed, sigGrowth));

        // 최고·최저 카테고리(스토리·한눈에 보기용).
        String strongest = cats.get(0).key(); int best = -1;
        String weakest = cats.get(0).key(); int worst = 101;
        for (CategoryScore c : cats) {
            if (c.score() > best) { best = c.score(); strongest = c.key(); }
            if (c.score() < worst) { worst = c.score(); weakest = c.key(); }
        }

        List<String> badges = new ArrayList<>();
        boolean samAny = samYear || samMon || samDay, yukAny = yukYear || yukMon || yukDay;
        int samCount = (samYear ? 1 : 0) + (samMon ? 1 : 0) + (samDay ? 1 : 0);
        boolean destiny = ganHap && (samAny || yukAny);
        if (destiny) badges.add(BADGE_DESTINY);
        if (samCount >= 2) badges.add(BADGE_TRIPLE_HAP);
        if (yy >= 0.9 && balance >= 0.7) badges.add(BADGE_PERFECT_YINYANG);
        if (sangbo >= 0.75) badges.add(BADGE_PUZZLE);
        if (ganHap && !destiny) badges.add(BADGE_GANHAP);
        if (badges.size() > 2) badges = new ArrayList<>(badges.subList(0, 2));

        // 총평: 최고 칭찬 + 최저 '차이'(성장 프레임)를 한 문장으로 엮는다. 격차 작으면 균형형.
        String totalComment = (best - worst < 12 || strongest.equals(weakest))
                ? clean(SajuUtil.pick(TOTAL_75, seed, 91))
                : bestClause(strongest) + " " + worstClause(weakest);

        // 대표 한줄(히어로): 가장 희귀·강한 signal 하나.
        String relComment;
        if (destiny) relComment = "말로 설명하기 어려운 끌림이 흐르는, 흔치 않은 인연이에요.";
        else if (chDay) relComment = "사소한 엇박도 금세 웃음으로 바꾸는, 회복이 빠른 커플이에요.";
        else if (sangbo >= 0.6) relComment = "한 명이 비면 한 명이 채우는, 손발 맞는 조합이에요.";
        else if (combined[1] < 2) relComment = "서로를 살뜰히 챙기는 마음이 깊어, 말 한마디만 더하면 완벽해지는 사이예요.";
        else if (sangbo >= 0.5) relComment = clean(SajuUtil.pick(REL_SANGBO, seed, 41));
        else if (sameDay) relComment = clean(SajuUtil.pick(REL_SAME, seed, 41));
        else if (shengDay) relComment = clean(SajuUtil.pick(REL_SHENG, seed, 41));
        else relComment = clean(SajuUtil.pick(REL_KE, seed, 41));

        // 딱 3줄 해석.
        List<String> summary = List.of(strongLine(strongest), weakLine(weakest), bridgeLine(percent));

        // 관계 키워드 2~3개.
        List<String> keywords = new ArrayList<>();
        keywords.add(kw(strongest));
        String relKw = sangbo >= 0.5 ? "보완" : sameDay ? "편안함" : shengDay ? "응원" : "밀당";
        if (!keywords.contains(relKw)) keywords.add(relKw);
        for (CategoryScore c : cats) {
            if (keywords.size() >= 3) break;
            String k = kw(c.key());
            if (!c.key().equals(strongest) && !keywords.contains(k)) { keywords.add(k); break; }
        }

        // 관계 꿀팁: 최저·차저 카테고리 처방 + 최고 카테고리 유지팁.
        String secondWeak = strongest; int second = 101;
        for (CategoryScore c : cats) {
            if (c.key().equals(weakest)) continue;
            if (c.score() < second) { second = c.score(); secondWeak = c.key(); }
        }
        List<String> tips = new ArrayList<>();
        tips.add(weakTip(weakest));
        if (!secondWeak.equals(strongest)) tips.add(weakTip(secondWeak));
        tips.add(strongTip(strongest));

        return new Result(percent, cats, totalComment, badges, relComment, strongest, weakest,
                keywords, summary, tips, a.hasHour() && b.hasHour());
    }

    private static CategoryScore cat(String key, String name, int score, String[][] templates, long seed, String sig) {
        int g = grade(score);
        String base = clean(SajuUtil.pick(templates[g], seed, key.hashCode()));
        String comment = (sig == null || sig.isBlank()) ? base : base + " " + sig;
        return new CategoryScore(key, name, score, g, comment);
    }

    // 방향 결정(결정론): 일간 양(짝수)=바로 움직이는 쪽, 일지 음(홀수)=혼자 정리하는 쪽, KE_FWD=a가 브레이크.
    /** 닉네임 뒤에 "님"을 붙이므로, 이미 "님"으로 끝나면 떼어 중복을 막는다. */
    private static String honBase(String name, String fallback) {
        if (name == null || name.isBlank()) return fallback;
        String n = name.strip();
        return n.endsWith("님") ? n.substring(0, n.length() - 1) : n;
    }
    /** 오행 근거 문장 + 행동 시그니처를 잇는다(둘 중 하나가 없어도 안전). */
    private static String joinSig(String elem, String beh) {
        if (elem == null || elem.isBlank()) return beh;
        return (beh == null || beh.isBlank()) ? elem : elem + " " + beh;
    }

    /** 두 사람 일간 오행의 관계를 전문 용어(상생·상극)로 설명. */
    private static String dayMasterElemClause(String nA, int eA, String nB, int eB) {
        String koA = SajuCalculator.ELEMENT_KO[eA], hjA = SajuCalculator.ELEMENT_HANJA[eA];
        String koB = SajuCalculator.ELEMENT_KO[eB], hjB = SajuCalculator.ELEMENT_HANJA[eB];
        String rel = switch (elemRel(eA, eB)) {
            case SAME -> "같은 " + koA + "(" + hjA + ") 기운을 나눠 가진 사이라, 결이 비슷해 편안하게 통해요.";
            case SHENG_FWD, SHENG_REV -> "두 기운이 서로를 살리는 상생(相生)의 결이라, 곁에 있을수록 자연스럽게 힘이 나요.";
            case KE_FWD, KE_REV -> "두 기운이 서로를 다듬는 상극(相剋)의 결이라, 톡톡 부딪히는 자극이 오히려 설렘이 돼요.";
        };
        return nA + "님의 일간은 " + koA + "(" + hjA + "), " + nB + "님은 " + koB + "(" + hjB + ") 기운이에요. " + rel;
    }

    /** 두 사람 오행 분포의 상보/공통을 전문 용어로 설명("~는 목이 많고 ~는 금이 적어서"). */
    private static String elemDistClause(String nA, int[] dA, String nB, int[] dB) {
        int aEl = -1, aVal = 0, bEl = -1, bVal = 0;
        for (int e = 0; e < 5; e++) {
            int d = dA[e] - dB[e];
            if (d > aVal) { aVal = d; aEl = e; }     // A가 더 넉넉한 오행
            if (-d > bVal) { bVal = -d; bEl = e; }   // B가 더 넉넉한 오행
        }
        if (aEl >= 0 && bEl >= 0 && aEl != bEl) {
            return "사주로 보면 " + nA + "님은 " + SajuCalculator.ELEMENT_KO[aEl] + "(" + SajuCalculator.ELEMENT_HANJA[aEl]
                    + ") 기운이 넉넉하고, " + nB + "님은 " + SajuCalculator.ELEMENT_KO[bEl] + "(" + SajuCalculator.ELEMENT_HANJA[bEl]
                    + ") 기운이 도드라져요. 서로가 지닌 기운으로 상대의 옅은 자리를 채워주는 상보(相補) 관계라, 함께일수록 균형이 잡혀요.";
        }
        int[] comb = new int[5]; int maxE = 0;
        for (int e = 0; e < 5; e++) { comb[e] = dA[e] + dB[e]; if (comb[e] > comb[maxE]) maxE = e; }
        return "사주로 보면 두 분 모두 " + SajuCalculator.ELEMENT_KO[maxE] + "(" + SajuCalculator.ELEMENT_HANJA[maxE]
                + ") 기운이 도드라져요. 닮은 기운이 강점이자 과제라, 번갈아 서로를 북돋아 주면 오래 단단해져요.";
    }

    private static boolean speedFast(Saju a) { return a.dayStem() % 2 == 0; }
    private static boolean calmSide(Saju a) { return a.dayBranch() % 2 == 1; }
    private static boolean aBrake(ElemRel rel) { return rel == ElemRel.KE_FWD; }

    // 본문 문구에서 이모지 제거(재미는 색·배지·아이콘이 담당). 배지·오늘운세는 대상 아님.
    static String clean(String s) {
        if (s == null) return null;
        StringBuilder sb = new StringBuilder();
        int i = 0;
        while (i < s.length()) {
            int cp = s.codePointAt(i);
            int cc = Character.charCount(cp);
            boolean emoji = cp >= 0x1F000
                    || (cp >= 0x2600 && cp <= 0x27BF)   // 기타기호·딩뱃(☯✨⚡⛰⚙♥ 등)
                    || (cp >= 0x2B00 && cp <= 0x2BFF)   // ⭐ 등
                    || cp == 0x2693 || cp == 0x2696 || cp == 0x231A || cp == 0xFE0F || cp == 0x200D;
            if (!emoji) sb.appendCodePoint(cp);
            i += cc;
        }
        return sb.toString().replaceAll("\\s+([.,!?…])", "$1").replaceAll("\\s{2,}", " ").trim();
    }

    // 총평 조각(최고 칭찬 / 최저 차이). 연결어미로 끝나 worstClause와 이어진다.
    private static String bestClause(String key) {
        return switch (key) {
            case "CHEMI" -> "첫눈부터 서로를 알아본 사이라";
            case "TALK" -> "말이 놀랄 만큼 잘 통하는데";
            case "AFFECTION" -> "애정 표현이 자연스럽게 흘러넘치는데";
            case "STABILITY" -> "곁에 있으면 마음이 놓이는 사이인데";
            default -> "함께일수록 각자 더 나아지는데";
        };
    }
    private static String worstClause(String key) {
        return switch (key) {
            case "CHEMI" -> "불꽃보다 온기로 천천히 데워지는 편이라, 지금부터가 진짜 시작이에요.";
            case "TALK" -> "쓰는 말의 온도는 조금 달라서, 자주 물어봐 줄수록 가까워져요.";
            case "AFFECTION" -> "애정을 표현하는 방식은 서로 달라서(한 분은 말로, 한 분은 행동으로), 한 번 더 표현해 주면 오래가요.";
            case "STABILITY" -> "생활 리듬은 아직 맞춰가는 중이라, 시간이 편이 되어줄 사이예요.";
            default -> "아직 채워갈 여백이 있어, 앞으로 함께 쓸 이야기가 많아요.";
        };
    }
    // 3줄 해석 조각.
    private static String strongLine(String key) {
        return switch (key) {
            case "CHEMI" -> "첫눈에 서로를 알아본 끌림이 있어요.";
            case "TALK" -> "말하지 않아도 통하는 순간이 많아요.";
            case "AFFECTION" -> "표현이 자연스럽고 애정이 넉넉해요.";
            case "STABILITY" -> "곁에 있으면 마음이 놓이는 사이예요.";
            default -> "함께할수록 각자 더 단단해져요.";
        };
    }
    private static String weakLine(String key) {
        return switch (key) {
            case "CHEMI" -> "다만 불꽃보다 온기로 천천히 데워지는 편이에요.";
            case "TALK" -> "다만 말의 온도는 서로 조금 달라요.";
            case "AFFECTION" -> "다만 사랑을 표현하는 방식은 서로 달라요.";
            case "STABILITY" -> "다만 생활 리듬은 아직 맞춰가는 중이에요.";
            default -> "다만 지금은 서로를 알아가는 시작점이에요.";
        };
    }
    private static String bridgeLine(int percent) {
        if (percent >= 85) return "이미 잘 맞는 두 분, 지금처럼이면 충분해요.";
        if (percent >= 70) return "한 걸음씩 맞춰가면 오래갈 조합이에요.";
        return "서로의 다름을 채워갈수록 단단해질 사이예요.";
    }
    private static String kw(String key) {
        return switch (key) {
            case "CHEMI" -> "설렘";
            case "TALK" -> "대화";
            case "AFFECTION" -> "애정";
            case "STABILITY" -> "편안함";
            default -> "성장";
        };
    }
    // 약점 카테고리 행동 처방(왜+뭘).
    private static String weakTip(String key) {
        return switch (key) {
            case "CHEMI" -> "가끔 계획 없는 즉흥 데이트를 넣어보세요. 익숙함에 설렘 한 스푼이 필요한 조합이에요.";
            case "TALK" -> "서운할 땐 '너는 왜'보다 '나는 지금 ~해'로 시작해 보세요. 말의 온도가 다른 두 분에겐 이 한 끗이 커요.";
            case "AFFECTION" -> "하루 한 번 마음을 말로 확인해 보세요. 행동으론 잘 챙기는 두 분이라, 표현만 더하면 놓칠 일이 없어요.";
            case "STABILITY" -> "다툰 뒤 '몇 시간 뒤 다시 얘기하자'를 미리 약속해 두세요. 푸는 속도가 다른 조합엔 타이밍 룰이 명약이에요.";
            default -> "서로 다른 점 하나를 '고칠 것'이 아니라 '배울 것'으로 적어보세요. 다름이 자원이 되는 조합이에요.";
        };
    }
    private static String strongTip(String key) {
        return switch (key) {
            case "CHEMI" -> "첫끌림이 강한 게 이 커플의 무기예요. 설렜던 순간을 종종 함께 떠올려 보세요.";
            case "TALK" -> "말이 잘 통하는 게 최대 무기예요. 힘든 얘기일수록 미루지 말고 그 강점을 쓰세요.";
            case "AFFECTION" -> "표현이 자연스러운 게 큰 복이에요. 지금처럼 마음을 아끼지 마세요.";
            case "STABILITY" -> "곁에서 주는 안정감이 이 커플의 뿌리예요. 그 편안함을 서로 자주 말해주세요.";
            default -> "함께 성장하는 힘이 강점이에요. 새로운 도전을 두려워 말고 같이 해보세요.";
        };
    }

    private static long seed(LocalDate a, LocalDate b) {
        long ya = SajuUtil.ymd(a), yb = SajuUtil.ymd(b);
        long lo = Math.min(ya, yb), hi = Math.max(ya, yb);
        return lo * 100000000L + hi;
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
    private static final String[] TOTAL_75 = {
        "참 잘 어울리는 두 분이에요. 서로의 좋은 점을 알아봐 주고 다독여주는 다정한 사이라, 함께 있으면 마음이 따뜻해져요. 지금처럼 서로를 바라봐 주면 사이가 더 깊어질 거예요. 🌷",
        "따뜻한 케미가 은은하게 흐르는 두 분이에요. 기운이 서로를 부드럽게 받쳐줘, 함께하는 시간이 편안하게 쌓여가요. 지금처럼 아껴주면 더 애틋해질 인연이랍니다. 💗"};
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
