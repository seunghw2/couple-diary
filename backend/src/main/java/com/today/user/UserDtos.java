package com.today.user;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

import java.time.LocalDate;

public class UserDtos {

    public record DevLoginRequest(
            @NotBlank @Email String email,
            @NotBlank String nickname
    ) {}

    public record AuthResponse(String accessToken, UserSummary user) {}

    public record UpdateMeRequest(
            String nickname,
            String avatarColor,
            LocalDate birthday
    ) {}

    /** 기본 유저 요약(파트너 표시 등에 재사용). */
    public record UserSummary(
            Long id,
            String email,
            String nickname,
            String avatarColor,
            LocalDate birthday,
            String inviteCode
    ) {
        public static UserSummary of(User u) {
            return new UserSummary(u.getId(), u.getEmail(), u.getNickname(),
                    u.getAvatarColor(), u.getBirthday(), u.getInviteCode());
        }
    }

    /** GET /api/me — 커플 연결 여부/파트너 요약 포함. */
    public record MeResponse(
            UserSummary user,
            boolean coupled,
            Long coupleId,
            PartnerSummary partner
    ) {}

    public record PartnerSummary(
            Long id,
            String nickname,
            String avatarColor
    ) {
        public static PartnerSummary of(User u) {
            return new PartnerSummary(u.getId(), u.getNickname(), u.getAvatarColor());
        }
    }
}
