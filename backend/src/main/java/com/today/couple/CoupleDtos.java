package com.today.couple;

import com.today.user.UserDtos.PartnerSummary;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.util.List;

public class CoupleDtos {

    public record InviteResponse(String inviteCode) {}

    public record ConnectRequest(@NotBlank String inviteCode) {}

    public record AnniversaryRequest(@NotNull LocalDate anniversaryDate) {}

    public record CoupleResponse(
            Long id,
            PartnerSummary user1,
            PartnerSummary user2,
            LocalDate anniversaryDate,
            Long ddayCount
    ) {}

    // ---- 기념일 목록 ----
    public record AnniversaryItem(
            String label,
            LocalDate date,
            long dday          // 오늘(Asia/Seoul) 기준 D-n (다가오면 양수)
    ) {}

    public record AnniversaryListResponse(List<AnniversaryItem> items) {}
}
