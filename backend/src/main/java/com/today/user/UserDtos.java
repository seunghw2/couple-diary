package com.today.user;

import jakarta.validation.constraints.NotBlank;

import java.time.LocalDate;

public class UserDtos {

    /** 닉네임만 필수. email은 옵셔널(없으면 닉네임 기반으로 서버가 결정적 생성). */
    public record DevLoginRequest(
            String email,
            @NotBlank String nickname
    ) {}

    /** 카카오 인가 코드 로그인. 프론트가 받은 authorization code + 교환에 쓴 redirectUri. */
    public record KakaoLoginRequest(
            @NotBlank String code,
            @NotBlank String redirectUri
    ) {}

    /**
     * Apple 로그인. 프론트(expo-apple-authentication)가 받은 identityToken(JWT)을 넘긴다.
     * fullName은 Apple이 최초 로그인 1회만 제공하므로 옵셔널(닉네임 초기값).
     */
    public record AppleLoginRequest(
            @NotBlank String identityToken,
            String authorizationCode,   // 선택 — refresh_token 발급/저장용(계정 삭제 시 revoke 대비)
            String fullName
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
            PartnerSummary partner,
            boolean admin
    ) {}

    public record PartnerSummary(
            Long id,
            String nickname,
            String avatarColor,
            LocalDate birthday
    ) {
        public static PartnerSummary of(User u) {
            return new PartnerSummary(u.getId(), u.getNickname(), u.getAvatarColor(), u.getBirthday());
        }
    }
}
