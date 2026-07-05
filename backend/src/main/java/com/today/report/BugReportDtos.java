package com.today.report;

import java.time.LocalDateTime;
import java.util.List;

public class BugReportDtos {

    /** 리포트 작성 요청. bugText/wishText 둘 다 비면 서비스에서 400. imageUrls 최대 3장. */
    public record CreateBugReportRequest(
            String bugText,
            String wishText,
            List<String> imageUrls
    ) {}

    public record BugReportResponse(
            Long id,
            String reporterNickname,
            String bugText,
            String wishText,
            List<String> imageUrls,
            LocalDateTime createdAt
    ) {
        public static BugReportResponse of(BugReport r) {
            return new BugReportResponse(
                    r.getId(),
                    r.getReporter().getNickname(),
                    r.getBugText(),
                    r.getWishText(),
                    List.copyOf(r.getImageUrls()),
                    r.getCreatedAt());
        }
    }

    public record BugReportListResponse(List<BugReportResponse> items) {}
}
