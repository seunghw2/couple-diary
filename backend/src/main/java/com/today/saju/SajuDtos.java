package com.today.saju;

import java.util.List;

public class SajuDtos {

    /** 오행 한 칸(막대용). level 0부족/1적당/2강함. */
    public record OhaengView(int elem, String name, String emoji, int count, int level, String comment) {}

    public record DailyView(String fortune, String colorName, String colorHex, String keyword, String coupleTip) {}

    /** 개인 사주 결과. */
    public record PersonalResult(
            boolean hasBirthday,
            String dayMasterName, String dayMasterEmoji, String dayMasterKo, String dayMasterHanja,
            String oneLine, String desc, List<String> keywords, String growth,
            String zodiac,
            List<String> pillars,        // [년주, 월주, 일주, (시주)]
            List<OhaengView> ohaeng,
            DailyView daily,
            boolean hasHour,
            String disclaimer
    ) {}

    /** 궁합 카테고리 한 줄. */
    public record CatView(String key, String name, int score, int grade, String comment) {}

    /** 커플 궁합 결과(계산 불가면 canCompute=false + reason). */
    public record CoupleResult(
            boolean canCompute,
            String blockReason,
            int percent,
            List<CatView> categories,
            String totalComment,
            List<String> badges,
            String relComment,
            String strongestKey,
            String meName, String meEmoji,
            String partnerNickname, String partnerName, String partnerEmoji,
            boolean hasHour,
            String disclaimer
    ) {}

    /** 허브 상태(카드 라벨용). */
    public record HubStatus(
            boolean hasMyBirthday,
            boolean hasPartner,
            boolean hasPartnerBirthday,
            Integer myBirthTime
    ) {}

    public record BirthTimeRequest(Integer hour) {}

    public record UnseenView(long count) {}
}
