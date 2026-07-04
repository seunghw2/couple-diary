package com.today.couple;

import com.today.user.UserDtos.PartnerSummary;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

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
}
