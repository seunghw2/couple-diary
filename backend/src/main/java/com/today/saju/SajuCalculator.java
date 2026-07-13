package com.today.saju;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;

/**
 * 만세력(사주팔자) 계산기 — 오프라인·결정론.
 *
 * <p>정확도 근거(검증됨):
 * <ul>
 *   <li>일주: {@code index = floorMod(toEpochDay + 17, 60)} (0=갑자). 1970-01-01=신사(17), 2000-01-01=무오(54)로 교차검증.
 *   <li>월간(월두법/오호둔): {@code (년간*2 + 월번호 + 1) % 10} (寅월=월번호 1).
 *   <li>시간(시두법/오서둔): {@code (일간*2 + 시지) % 10}.
 *   <li>월지·년경계: 24절기 중 12절(節)의 절입시각 = 태양 황경 15° 배수 교차. 천문 계산(Meeus 저정밀)으로 산출.
 * </ul>
 * 진태양시·서머타임 보정은 생략(재미 앱). 야자시(23~24시)는 자정 기준 일주 유지 규칙으로 고정.
 */
public final class SajuCalculator {

    private SajuCalculator() {}

    public static final ZoneId KST = ZoneId.of("Asia/Seoul");

    // 오행: 0목 1화 2토 3금 4수
    public static final String[] ELEMENT_KO = {"목", "화", "토", "금", "수"};
    public static final String[] ELEMENT_HANJA = {"木", "火", "土", "金", "水"};

    // 천간 10
    public static final String[] STEM_KO = {"갑", "을", "병", "정", "무", "기", "경", "신", "임", "계"};
    public static final String[] STEM_HANJA = {"甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"};
    public static final int[] STEM_ELEMENT = {0, 0, 1, 1, 2, 2, 3, 3, 4, 4};
    public static final boolean[] STEM_YANG = {true, false, true, false, true, false, true, false, true, false};

    // 지지 12
    public static final String[] BRANCH_KO = {"자", "축", "인", "묘", "진", "사", "오", "미", "신", "유", "술", "해"};
    public static final String[] BRANCH_HANJA = {"子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"};
    public static final int[] BRANCH_ELEMENT = {4, 2, 0, 0, 2, 1, 1, 2, 3, 3, 2, 4};
    public static final String[] BRANCH_ANIMAL = {"쥐", "소", "호랑이", "토끼", "용", "뱀", "말", "양", "원숭이", "닭", "개", "돼지"};

    /** 계산 결과(모든 값은 인덱스). hourStem/hourBranch는 생시 없으면 -1. */
    public record Saju(
            int yearStem, int yearBranch,
            int monthStem, int monthBranch,
            int dayStem, int dayBranch,
            int hourStem, int hourBranch,
            int[] elementCount // [목,화,토,금,수]
    ) {
        public boolean hasHour() { return hourStem >= 0; }
        /** 일간 인덱스(0~9) = 사주의 '나'. */
        public int dayMaster() { return dayStem; }
        /** 띠(년지) 인덱스(0~11). */
        public int zodiac() { return yearBranch; }
    }

    /**
     * 사주 계산.
     * @param birthDate 양력 생년월일
     * @param hour24    생시(0~23), 모르면 null → 시주 제외
     */
    public static Saju compute(LocalDate birthDate, Integer hour24) {
        boolean hasHour = hour24 != null;
        int hour = hasHour ? Math.floorMod(hour24, 24) : 12; // 시각 없으면 정오로 절기 판정

        LocalDateTime instant = birthDate.atTime(hour, 0);

        // ── 일주: 자정 기준(당일 일주) — 실제 한국 만세력 앱 다수 관행에 맞춤(23:40생도 당일 일주). ──
        long epochDay = birthDate.toEpochDay();
        int dayGz = Math.floorMod(epochDay + 17, 60);
        int dayStem = dayGz % 10;
        int dayBranch = dayGz % 12;

        // ── 태양 황경(절입 판정) ──
        double lambda = solarApparentLongitude(toJulianDay(instant));

        // ── 월지: 황경 → 12절 구간 ──
        int monthBranch = monthBranchFromLongitude(lambda); // 0~11 (0=子)

        // ── 년주: 입춘(황경 315°) 경계로 사주상의 해 결정 ──
        double lichunJd = solarTermJd(birthDate.getYear(), 315.0);
        int sajuYear = toJulianDay(instant) < lichunJd ? birthDate.getYear() - 1 : birthDate.getYear();
        int yearStem = Math.floorMod(sajuYear - 4, 10);
        int yearBranch = Math.floorMod(sajuYear - 4, 12);

        // ── 월간(월두법): 寅월=월번호1 ──
        int monthNumber = ((monthBranch - 2 + 12) % 12) + 1;
        int monthStem = Math.floorMod(yearStem * 2 + monthNumber + 1, 10);

        // ── 시주(시두법) ──
        int hourStem = -1, hourBranch = -1;
        if (hasHour) {
            hourBranch = ((hour + 1) / 2) % 12; // 子 23~00, 丑 01~02, …
            hourStem = Math.floorMod(dayStem * 2 + hourBranch, 10);
        }

        // ── 오행 분포 ──
        int[] ec = new int[5];
        add(ec, STEM_ELEMENT[yearStem]);
        add(ec, BRANCH_ELEMENT[yearBranch]);
        add(ec, STEM_ELEMENT[monthStem]);
        add(ec, BRANCH_ELEMENT[monthBranch]);
        add(ec, STEM_ELEMENT[dayStem]);
        add(ec, BRANCH_ELEMENT[dayBranch]);
        if (hasHour) {
            add(ec, STEM_ELEMENT[hourStem]);
            add(ec, BRANCH_ELEMENT[hourBranch]);
        }

        return new Saju(yearStem, yearBranch, monthStem, monthBranch, dayStem, dayBranch, hourStem, hourBranch, ec);
    }

    private static void add(int[] ec, int el) { ec[el]++; }

    /** 황경(도) → 월지 인덱스(0=子). 입춘 315°부터 寅. */
    static int monthBranchFromLongitude(double lon) {
        // 각 절의 시작 황경과 월지: 입춘315→寅(2), 경칩345→卯(3), 청명15→辰(4), 입하45→巳(5),
        // 망종75→午(6), 소서105→未(7), 입추135→申(8), 백로165→酉(9), 한로195→戌(10),
        // 입동225→亥(11), 대설255→子(0), 소한285→丑(1).
        double l = ((lon % 360) + 360) % 360;
        // 황경을 '입춘 기준(315°=0)'으로 회전시켜 30°씩 나누면 월 순서(寅=0)가 나온다.
        double shifted = ((l - 315) % 360 + 360) % 360;
        int monthOrder = (int) Math.floor(shifted / 30.0); // 0=寅 … 11=丑
        int branch = (monthOrder + 2) % 12; // 寅=2
        return branch;
    }

    // ───────────────────────── 천문 계산 ─────────────────────────

    /** KST LocalDateTime → 율리우스일(UT 기준, 근사). */
    static double toJulianDay(LocalDateTime kst) {
        long epochSec = kst.toEpochSecond(ZoneOffset.ofHours(9)); // KST=UTC+9
        return epochSec / 86400.0 + 2440587.5;
    }

    /** 태양의 겉보기 황경(도, 0~360). Jean Meeus 저정밀. 입력 jd는 UT, 내부에서 ΔT로 TT 변환. */
    static double solarApparentLongitude(double jd) {
        double jde = jd + 69.0 / 86400.0; // ΔT ≈ 69초(2000~2020년대) — UT→TT 근사, 절입시각 ~1분 편향 제거
        double T = (jde - 2451545.0) / 36525.0;
        double L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
        double M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
        double Mr = Math.toRadians(mod360(M));
        double C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(Mr)
                + (0.019993 - 0.000101 * T) * Math.sin(2 * Mr)
                + 0.000289 * Math.sin(3 * Mr);
        double trueLong = L0 + C;
        double omega = 125.04 - 1934.136 * T;
        double apparent = trueLong - 0.00569 - 0.00478 * Math.sin(Math.toRadians(omega));
        return mod360(apparent);
    }

    /** 지정 연도에 태양 황경이 target(도)이 되는 순간의 율리우스일. Newton 반복. */
    static double solarTermJd(int year, double targetLong) {
        // 근사 시작일: 황경 0°(춘분)≈3/20 기준으로 target에 해당하는 대략 일자.
        // 입춘(315°)이면 대략 2/4. 간단히 연초부터 target/0.9856일 뒤로 시작.
        double dayOfYearGuess = ((targetLong - 280.0 + 360) % 360) / 0.98565 + 1; // 대략
        double jd = jdOfYearStart(year) + dayOfYearGuess;
        for (int i = 0; i < 10; i++) {
            double lon = solarApparentLongitude(jd);
            double diff = targetLong - lon;
            while (diff > 180) diff -= 360;
            while (diff < -180) diff += 360;
            jd += diff / 0.98565;
            if (Math.abs(diff) < 1e-6) break;
        }
        return jd;
    }

    private static double jdOfYearStart(int year) {
        LocalDateTime start = LocalDate.of(year, 1, 1).atStartOfDay();
        return toJulianDay(start);
    }

    private static double mod360(double x) {
        double r = x % 360.0;
        return r < 0 ? r + 360 : r;
    }
}
