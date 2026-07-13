package com.today.saju;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 만세력 계산 검증 — 실제 한국 만세력(사주보까/플러스만세력 등)과 교차확인한 골든 벡터.
 * 일주 앵커: ytliu 2019-01-27=갑자 + 1949-10-01=갑자 (상호검증). OFFSET=17.
 */
class SajuCalculatorTest {

    private static String ganji(int stem, int branch) {
        return SajuCalculator.STEM_KO[stem] + SajuCalculator.BRANCH_KO[branch];
    }

    private static String dayGanji(LocalDate d) {
        var s = SajuCalculator.compute(d, null);
        return ganji(s.dayStem(), s.dayBranch());
    }

    @Test
    void 일주_10케이스() {
        assertEquals("무오", dayGanji(LocalDate.of(2000, 1, 1)));
        assertEquals("계묘", dayGanji(LocalDate.of(2020, 1, 1)));
        assertEquals("갑자", dayGanji(LocalDate.of(2024, 1, 1)));
        assertEquals("무술", dayGanji(LocalDate.of(2024, 2, 4)));
        assertEquals("경진", dayGanji(LocalDate.of(1990, 5, 15)));
        assertEquals("계미", dayGanji(LocalDate.of(1995, 8, 20)));
        assertEquals("경신", dayGanji(LocalDate.of(1988, 12, 31)));
        assertEquals("정축", dayGanji(LocalDate.of(2001, 9, 11)));
        assertEquals("경술", dayGanji(LocalDate.of(2023, 6, 21)));
        assertEquals("병인", dayGanji(LocalDate.of(1984, 2, 2)));
    }

    @Test
    void 완전한_사주_3케이스() {
        // 1990-05-15 09:30 → 경오 / 신사 / 경진 / 신사
        var a = SajuCalculator.compute(LocalDate.of(1990, 5, 15), 9);
        assertEquals("경오", ganji(a.yearStem(), a.yearBranch()), "년주");
        assertEquals("신사", ganji(a.monthStem(), a.monthBranch()), "월주");
        assertEquals("경진", ganji(a.dayStem(), a.dayBranch()), "일주");
        assertEquals("신사", ganji(a.hourStem(), a.hourBranch()), "시주");

        // 2000-11-03 23:40 → 경진 / 병술 / 을축 / 병자 (자정기준 당일 일주)
        var b = SajuCalculator.compute(LocalDate.of(2000, 11, 3), 23);
        assertEquals("경진", ganji(b.yearStem(), b.yearBranch()), "년주");
        assertEquals("병술", ganji(b.monthStem(), b.monthBranch()), "월주");
        assertEquals("을축", ganji(b.dayStem(), b.dayBranch()), "일주");
        assertEquals("병자", ganji(b.hourStem(), b.hourBranch()), "시주");

        // 1985-02-03 14:00 → 갑자(입춘 전!) / 정축 / 계유 / 기미
        var c = SajuCalculator.compute(LocalDate.of(1985, 2, 3), 14);
        assertEquals("갑자", ganji(c.yearStem(), c.yearBranch()), "년주(입춘 전)");
        assertEquals("정축", ganji(c.monthStem(), c.monthBranch()), "월주");
        assertEquals("계유", ganji(c.dayStem(), c.dayBranch()), "일주");
        assertEquals("기미", ganji(c.hourStem(), c.hourBranch()), "시주");
    }

    @Test
    void 절기_입춘_2024_시각검증() {
        // 2024 입춘 = 2/4 17:27 KST. solarTermJd(2024,315)를 KST로 변환해 ±10분 확인.
        double jd = SajuCalculator.solarTermJd(2024, 315.0);
        long epochSec = Math.round((jd - 2440587.5) * 86400.0);
        LocalDateTime kst = LocalDateTime.ofEpochSecond(epochSec, 0, ZoneOffset.ofHours(9));
        assertEquals(2024, kst.getYear());
        assertEquals(2, kst.getMonthValue());
        assertEquals(4, kst.getDayOfMonth());
        int minutes = kst.getHour() * 60 + kst.getMinute();
        assertTrue(Math.abs(minutes - (17 * 60 + 27)) <= 10,
                "입춘 시각 오차 10분 이내여야 함, 계산=" + kst);
    }

    @Test
    void 입춘_경계_당일_년주전환() {
        // 1985 입춘 2/4 06:12. 2/4 05:00(전) → 갑자년, 2/4 08:00(후) → 을축년.
        var before = SajuCalculator.compute(LocalDate.of(1985, 2, 4), 5);
        var after = SajuCalculator.compute(LocalDate.of(1985, 2, 4), 8);
        assertEquals("갑자", ganji(before.yearStem(), before.yearBranch()));
        assertEquals("을축", ganji(after.yearStem(), after.yearBranch()));
    }
}
