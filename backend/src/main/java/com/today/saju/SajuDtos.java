package com.today.saju;

import java.util.List;

public class SajuDtos {

    /** 오행 한 칸(막대용). level 0부족/1적당/2강함. */
    public record OhaengView(int elem, String name, String emoji, int count, int level, String comment) {}

    public record DailyView(String fortune, String colorName, String colorHex, String keyword, String coupleTip, String totalLine) {}

    /** 개인 사주 결과. */
    public record PersonalResult(
            boolean hasBirthday,
            String ownerName,   // 이 사주의 주인 닉네임(제목·해설 주어용)
            String dayMasterName, String dayMasterEmoji, String dayMasterKo, String dayMasterHanja,
            String oneLine, String twist, String desc, List<String> keywords, String growth,
            List<String> strengths, List<String> growthPoints,
            String zodiac,
            List<String> pillars,        // [년주, 월주, 일주, (시주)]
            List<OhaengView> ohaeng,
            String ohaengInsight,        // 강한·부족한 기운 근거 + 보완법
            DailyView daily,
            boolean hasHour,
            String disclaimer
    ) {}

    /** 궁합 카테고리 한 줄. */
    public record CatView(String key, String name, int score, int grade, String comment, String behavior, String sajuNote) {}

    /** 커플 궁합 결과(계산 불가면 canCompute=false + reason). */
    public record CoupleResult(
            boolean canCompute,
            String blockReason,
            boolean canRequestBirthday,
            int percent,
            List<CatView> categories,
            String totalComment,
            List<String> badges,
            String relComment,
            String strongestKey, String weakestKey,
            List<String> keywords, List<String> summaryLines,
            String meNickname, String meTypeName, String meEmoji,
            String partnerNickname, String partnerTypeName, String partnerEmoji,
            List<String> tips,
            boolean hasHour,
            String disclaimer
    ) {}

    /** 허브 상태 + 커플 정보 카드용(나·연인 이름·생일·생시). */
    public record HubStatus(
            boolean hasMyBirthday,
            boolean hasPartner,
            boolean hasPartnerBirthday,
            String myName, String myBirthday, Integer myBirthTime,
            String partnerName, String partnerBirthday, Integer partnerBirthTime,
            String myEmoji, String partnerEmoji   // 각자 일간 이모지(생일 없으면 null)
    ) {}

    public record BirthTimeRequest(Integer hour) {}

    public record UnseenView(long count) {}
}
