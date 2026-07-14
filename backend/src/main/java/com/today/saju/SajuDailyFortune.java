package com.today.saju;

import com.today.saju.SajuCalculator.Saju;
import com.today.saju.SajuCompatibility.ElemRel;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * 오늘의 운세 — 결정론. "내 일간 오행 ↔ 오늘 일진 오행"의 상생·상극으로 점수 산출.
 * 톤: 부정어 0, 낮아도 충전·성장 프레임. 점수는 60~99 긍정 밴드.
 */
public final class SajuDailyFortune {

    private SajuDailyFortune() {}

    public record Item(String key, String name, String icon, int score, String comment) {}
    public record Result(
            boolean hasBirthday,
            int totalScore, String totalLine,
            List<Item> items,
            String colorName, String colorHex,
            String luckyItem, String keyword, String luckyNumber,
            String coupleGood,
            String disclaimer
    ) {}

    /** elemRel(myEl, todayEl) 관점의 우호도(전부 60 이상 → 긍정 바닥). */
    private static int favor(ElemRel r) {
        return switch (r) {
            case SHENG_REV -> 92; // 오늘이 나를 생함: 기운 충전(최상)
            case SAME -> 80;      // 비화: 협력·편안
            case KE_FWD -> 74;    // 내가 오늘을 극: 주도·통제감
            case SHENG_FWD -> 72; // 내가 오늘을 생함: 베풂·표현
            case KE_REV -> 66;    // 오늘이 나를 극: 자극·성장(순화)
        };
    }

    private static int remap(double raw, double lo, double hi) {
        double norm = Math.min(1, Math.max(0, (raw - lo) / (hi - lo)));
        return (int) Math.round(60 + norm * 39);
    }

    private static int band(int score) { return score >= 78 ? 2 : (score >= 66 ? 1 : 0); }

    /** 항목별 결정론 지터 0~13. */
    private static int jit(long seed, long salt) { return (int) Math.floorMod(seed * salt + salt, 14); }

    private static String pick(String[] arr, long seed, long salt) {
        return arr[(int) Math.floorMod(seed + salt, arr.length)];
    }

    public static Result compute(int myStem, boolean hasBirthday, Saju today, LocalDate date) {
        int myEl = SajuCalculator.STEM_ELEMENT[myStem];
        int tStemEl = SajuCalculator.STEM_ELEMENT[today.dayStem()];
        int tBranchEl = SajuCalculator.BRANCH_ELEMENT[today.dayBranch()];
        ElemRel relStem = SajuCompatibility.elemRel(myEl, tStemEl);
        ElemRel relBranch = SajuCompatibility.elemRel(myEl, tBranchEl);

        double rawTotal = favor(relStem) * 0.6 + favor(relBranch) * 0.4;
        int total = remap(rawTotal, 60, 92);

        long ymd = date.getYear() * 10000L + date.getMonthValue() * 100L + date.getDayOfMonth();
        long seed = ymd * 100L + myStem * 10L + today.dayStem();

        int base = (int) Math.round(rawTotal);
        int boost = hasBirthday ? 18 : 9;   // 비생일(고정 일간)은 부스트 절반으로 인위적 편향 완화
        int bb = hasBirthday ? 6 : 3;

        // 항목별 결정론 지터(0~13) — 부스트 없는 항목도 매일·항목별로 다양하게 흩어지게.
        int love = remap(base - 6 + jit(seed, 101) + (relStem == ElemRel.SHENG_FWD ? boost : 0) + (relBranch == ElemRel.SHENG_FWD ? bb : 0), 62, 100);
        int money = remap(base - 6 + jit(seed, 103) + (relStem == ElemRel.KE_FWD ? boost : 0) + (relBranch == ElemRel.KE_FWD ? bb : 0), 62, 100);
        int vital = remap(base - 6 + jit(seed, 107) + ((relStem == ElemRel.SHENG_REV || relStem == ElemRel.SAME) ? boost : 0)
                + ((relBranch == ElemRel.SHENG_REV || relBranch == ElemRel.SAME) ? bb : 0), 62, 100);
        int luck = remap(base - 6 + jit(seed, 109) + (relStem == ElemRel.KE_REV ? boost : 0) + (relBranch == ElemRel.KE_REV ? bb : 0), 62, 100);

        List<Item> items = new ArrayList<>();
        items.add(new Item("LOVE", "애정운", "💕", love, pick(LOVE_T[band(love)], seed, 11)));
        items.add(new Item("MONEY", "재물운", "💰", money, pick(MONEY_T[band(money)], seed, 23)));
        items.add(new Item("VITAL", "활력운", "⚡", vital, pick(VITAL_T[band(vital)], seed, 37)));
        items.add(new Item("LUCK", "행운운", "🍀", luck, pick(LUCK_T[band(luck)], seed, 53)));

        String totalLine = pick(TOTAL_LINE[band(total)], seed, 91);

        // 행운색: 오늘 천간 오행 그룹에서 선택("오늘 기운과 어울리는 색").
        int ci = (int) Math.floorMod(seed, 2);
        String colorName = COLOR_NAME[tStemEl][ci];
        String colorHex = COLOR_HEX[tStemEl][ci];

        String luckyItem = pick(LUCKY_ITEM, seed, 61);
        String keyword = pick(KEYWORD, seed, 71);
        String luckyNumber = String.valueOf((int) Math.floorMod(seed * 7 + 3, 9) + 1);
        String coupleGood = pick(COUPLE_GOOD, seed, 83);

        return new Result(hasBirthday, total, totalLine, items,
                colorName, colorHex, luckyItem, keyword, luckyNumber, coupleGood, SajuTemplates.DISCLAIMER);
    }

    // ───────── 문구 (전부 긍정·응원 톤, 낮아도 충전·성장) ─────────
    // [0 하(충전) / 1 중(안정) / 2 상(확신)]
    private static final String[][] TOTAL_LINE = {
        {
            "오늘은 나를 조금 더 아껴주기 좋은, 충전의 날이에요.",
            "천천히 숨 고르며 나를 돌보면 마음이 한결 가벼워져요.",
            "무리하지 않고 쉬어가는 여유가 오늘의 선물이 되는 날이에요.",
            "오늘의 노력은 눈에 보이지 않아도 차곡차곡 쌓이고 있어요.",
            "서두르기보다 한 박자 쉬어가면 좋은 흐름이 찾아와요.",
            "좋아하는 것으로 하루를 채워보기 좋은 날이에요.",
        },
        {
            "서두르지 않고 천천히 갈수록 좋은 하루예요.",
            "잔잔한 하루 속에 소소한 행복이 곳곳에 숨어 있어요.",
            "오늘은 나답게 흘러가면 마음이 편안해지는 날이에요.",
            "마음의 여유가 오늘의 가장 든든한 힘이 되어줘요.",
            "평소처럼 꾸준히 가면 좋은 자리에 도착하는 날이에요.",
            "편안한 마음으로 오늘을 즐기기 좋은 하루예요.",
        },
        {
            "오늘은 마음먹은 일이 술술 풀리는, 흐름 좋은 날이에요.",
            "기분 좋은 소식이 반갑게 찾아올 것 같은 하루예요.",
            "오늘의 작은 용기가 큰 기쁨으로 돌아오는 날이에요.",
            "하고 싶던 일에 한 걸음 내디디기 딱 좋은 날이에요.",
            "곳곳에서 나를 응원하는 기운이 모이는 날이에요.",
            "자신 있게 나아가면 원하는 자리에 닿는 날이에요.",
        },
    };
    private static final String[][] LOVE_T = {
        {
            "오늘은 서로에게 여백을 주기 좋은 날이에요. 각자의 시간도 사랑이랍니다.",
            "표현이 서툰 날이라면 짧은 메시지 하나로 마음을 전해보세요.",
            "조금 무뚝뚝해지는 날이지만, 그만큼 편해졌다는 뜻이기도 해요.",
        },
        {
            "평소처럼 곁을 지켜주는 것만으로 마음이 전해지는 날이에요.",
            "잔잔한 대화 속에서 서로의 온기를 느끼기 좋은 하루예요.",
            "상대의 이야기를 조금 더 들어주면 사이가 포근해져요.",
        },
        {
            "오늘은 서로의 마음이 유난히 잘 맞닿는 날이에요. 표현을 아끼지 마세요.",
            "작은 다정함 하나가 큰 설렘으로 돌아오는 하루예요.",
            "오늘 건넨 따뜻한 한마디가 둘 사이를 더 가깝게 만들어요.",
        },
    };
    private static final String[][] MONEY_T = {
        {
            "오늘은 지갑을 잠시 쉬게 해주기 좋은 날이에요. 아낀 만큼 내일이 넉넉해져요.",
            "충동보다 한 박자 쉬어 고르면 더 좋은 선택을 하게 돼요.",
            "오늘 아껴둔 여유가 다음 기회의 씨앗이 되어줘요.",
        },
        {
            "평소 페이스대로 관리하면 안정적인 하루예요.",
            "필요한 곳에 알맞게 쓰면 마음이 든든해지는 날이에요.",
            "큰 변화보다 꾸준함이 빛나는, 실속 있는 날이에요.",
        },
        {
            "오늘은 뜻밖의 이득이나 반가운 득템이 있을 수 있는 날이에요.",
            "쓴 만큼 값진, 기분 좋은 소비를 하게 되는 하루예요.",
            "작은 기회가 실속 있는 결실로 이어지기 좋은 날이에요.",
        },
    };
    private static final String[][] VITAL_T = {
        {
            "오늘은 푹 쉬어주는 게 가장 좋은 보약인 날이에요.",
            "천천히 숨 고르며 나를 아끼면 활력이 다시 차올라요.",
            "바쁜 일은 잠시 내려두고 충전에 집중하기 좋은 하루예요.",
        },
        {
            "무리하지 않고 나만의 리듬으로 가면 편안한 하루예요.",
            "가벼운 산책이나 스트레칭으로 기분을 산뜻하게 채워보세요.",
            "평온한 컨디션 속에서 나를 돌보기 좋은 날이에요.",
        },
        {
            "몸도 마음도 가볍게 차오르는, 에너지 넘치는 하루예요.",
            "오늘은 하고 싶던 활동을 시작하기 딱 좋은 컨디션이에요.",
            "기분 좋은 활력이 주변까지 환하게 물들이는 날이에요.",
        },
    };
    private static final String[][] LUCK_T = {
        {
            "오늘은 서두르기보다 기다림이 행운을 부르는 날이에요.",
            "지금 준비해둔 것이 곧 좋은 타이밍으로 이어질 거예요.",
            "조급함을 내려놓으면 뜻밖의 여유가 찾아오는 하루예요.",
        },
        {
            "평범해 보이는 하루 속에 작은 행운이 숨어 있는 날이에요.",
            "오늘은 직감을 믿어보면 기분 좋은 선택을 하게 돼요.",
            "눈여겨보면 곳곳에서 소소한 기회가 반짝이는 날이에요.",
        },
        {
            "오늘은 뜻밖의 좋은 기회가 문을 두드리는 날이에요.",
            "우연한 만남이나 소식이 반가운 행운으로 이어져요.",
            "작은 시도가 기분 좋은 발견으로 돌아오는 하루예요.",
        },
    };

    // 오행별 행운색(0목1화2토3금4수)
    private static final String[][] COLOR_NAME = {
        {"싱그러운 초록", "맑은 연두"},
        {"따뜻한 빨강", "다정한 분홍"},
        {"포근한 노랑", "은은한 베이지"},
        {"깔끔한 흰색", "세련된 실버"},
        {"시원한 파랑", "깊은 남색"},
    };
    private static final String[][] COLOR_HEX = {
        {"#4CAF50", "#8BC34A"},
        {"#F44336", "#FF80AB"},
        {"#FFC107", "#D7CCC8"},
        {"#FAFAFA", "#B0BEC5"},
        {"#2196F3", "#3F51B5"},
    };

    private static final String[] LUCKY_ITEM = {
        "작은 화분이나 초록 식물", "손목시계나 팔찌", "향이 좋은 핸드크림", "좋아하는 향의 립밤",
        "포근한 니트나 무릎담요", "가벼운 에코백", "반짝이는 액세서리", "새로 산 양말",
        "따뜻한 텀블러", "손수건이나 스카프", "귀여운 키링", "오늘 산 꽃 한 송이",
        "편한 운동화", "밝은색 모자", "노트와 좋아하는 펜",
    };
    private static final String[] KEYWORD = {
        "설렘", "여유", "용기", "다정함", "새로움", "집중", "감사", "휴식", "도전", "위로",
        "소통", "균형", "행운", "웃음", "정리", "응원", "몰입", "발견", "따뜻함", "설계",
    };
    private static final String[] COUPLE_GOOD = {
        "같이 새로운 카페나 골목을 산책해보는 거 어때요?",
        "둘이 같은 노래를 들으며 걸어보는 거 어때요?",
        "함께 간단한 요리를 만들어 먹어보는 거 어때요?",
        "같이 사진 한 장을 남겨 오늘을 기록해보는 거 어때요?",
        "서로에게 어울리는 작은 선물을 골라주는 거 어때요?",
        "'요즘 가장 행복했던 순간'을 서로 이야기해보는 거 어때요?",
        "처음 만났던 날을 함께 떠올려보는 거 어때요?",
        "'앞으로 같이 해보고 싶은 것'을 하나씩 말해보는 거 어때요?",
        "서로에게 요즘 고마운 점을 하나씩 말해주는 거 어때요?",
        "오늘 하루 좋았던 일 세 가지를 나눠보는 거 어때요?",
        "오늘은 서로가 좋아하는 음식을 먼저 챙겨보는 거 어때요?",
        "짧은 손편지나 메시지로 마음을 전해보는 거 어때요?",
    };
}
