package com.today.saju;

import java.time.LocalDate;

/** saju 패키지 공용 순수 헬퍼(결정론). 기존 인라인 공식 그대로 — 동작 불변. */
final class SajuUtil {

    private SajuUtil() {}

    /** 생년월일 → y*10000+m*100+d. */
    static long ymd(LocalDate d) {
        return d.getYear() * 10000L + d.getMonthValue() * 100L + d.getDayOfMonth();
    }

    /** floorMod 인덱싱 픽. */
    static String pick(String[] arr, long seed, long salt) {
        return arr[(int) Math.floorMod(seed + salt, arr.length)];
    }

    /** raw를 [lo,hi]로 정규화 후 60~99로 리매핑. */
    static int remap(double raw, double lo, double hi) {
        double norm = Math.min(1, Math.max(0, (raw - lo) / (hi - lo)));
        return (int) Math.round(60 + norm * 39);
    }
}
