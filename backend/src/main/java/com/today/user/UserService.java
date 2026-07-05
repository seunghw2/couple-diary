package com.today.user;

import com.today.auth.JwtTokenProvider;
import com.today.auth.KakaoClient;
import com.today.auth.KakaoClient.KakaoUser;
import com.today.common.ApiException;
import com.today.common.ErrorCode;
import com.today.common.InviteCodes;
import com.today.couple.Couple;
import com.today.couple.CoupleRepository;
import com.today.user.UserDtos.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final CoupleRepository coupleRepository;
    private final JwtTokenProvider jwtTokenProvider;
    private final KakaoClient kakaoClient;

    private static final String[] AVATAR_COLORS =
            {"#FF6B6B", "#4ECDC4", "#FFD93D", "#6C5CE7", "#FF8CC8", "#38B000"};

    @Transactional
    public AuthResponse devLogin(DevLoginRequest req) {
        // email이 없거나 빈 값이면 닉네임 기반 결정적 email 생성 → 같은 닉네임=같은 유저.
        String email = (req.email() == null || req.email().isBlank())
                ? emailFor(req.nickname())
                : req.email().trim();
        User user = userRepository.findByEmail(email)
                .orElseGet(() -> createUser(email, req.nickname(), null));
        String token = jwtTokenProvider.createAccessToken(user.getId());
        return new AuthResponse(token, UserSummary.of(user));
    }

    /**
     * 카카오 인가 코드 로그인. code→카카오 토큰→사용자정보 조회 후 kakaoId로 upsert.
     * dev-login과 동일하게 우리 JWT access token을 발급한다.
     */
    @Transactional
    public AuthResponse kakaoLogin(KakaoLoginRequest req) {
        String kakaoAccessToken = kakaoClient.exchangeToken(req.code(), req.redirectUri());
        KakaoUser kakaoUser = kakaoClient.fetchUser(kakaoAccessToken);

        User user = userRepository.findByKakaoId(kakaoUser.kakaoId())
                .orElseGet(() -> createKakaoUser(kakaoUser));
        String token = jwtTokenProvider.createAccessToken(user.getId());
        return new AuthResponse(token, UserSummary.of(user));
    }

    private User createKakaoUser(KakaoUser kakaoUser) {
        // email은 스키마상 NOT NULL & unique → 카카오가 이메일 미제공/동의거부 시 결정적 대체값 사용.
        String email = (kakaoUser.email() != null && !kakaoUser.email().isBlank())
                ? kakaoUser.email().trim()
                : "kakao_" + kakaoUser.kakaoId() + "@today.local";
        // 이메일이 이미 dev-login 등으로 존재하면 충돌을 피하려 카카오 결정적 이메일로 강제.
        if (userRepository.findByEmail(email).isPresent()) {
            email = "kakao_" + kakaoUser.kakaoId() + "@today.local";
        }
        String nickname = (kakaoUser.nickname() != null && !kakaoUser.nickname().isBlank())
                ? kakaoUser.nickname().trim()
                : "카카오친구";
        String color = AVATAR_COLORS[Math.abs(kakaoUser.kakaoId().hashCode()) % AVATAR_COLORS.length];
        User user = User.builder()
                .email(email)
                .nickname(nickname)
                .avatarColor(color)
                .kakaoId(kakaoUser.kakaoId())
                .inviteCode(uniqueInviteCode())
                .build();
        return userRepository.save(user);
    }

    /** 닉네임 기반 결정적 email. 기존 unique(email) 스키마 재사용. */
    private String emailFor(String nickname) {
        return nickname.trim() + "@today.local";
    }

    private User createUser(String email, String nickname, String kakaoId) {
        String color = AVATAR_COLORS[Math.abs(email.hashCode()) % AVATAR_COLORS.length];
        User user = User.builder()
                .email(email)
                .nickname(nickname)
                .avatarColor(color)
                .kakaoId(kakaoId)
                .inviteCode(uniqueInviteCode())
                .build();
        return userRepository.save(user);
    }

    private String uniqueInviteCode() {
        String code;
        do {
            code = InviteCodes.generate();
        } while (userRepository.existsByInviteCode(code));
        return code;
    }

    @Transactional(readOnly = true)
    public MeResponse me(Long userId) {
        User user = getUser(userId);
        return coupleRepository.findByMember(userId)
                .map(c -> {
                    User partner = partnerOf(c, userId);
                    return new MeResponse(UserSummary.of(user), true, c.getId(),
                            partner == null ? null : PartnerSummary.of(partner));
                })
                .orElseGet(() -> new MeResponse(UserSummary.of(user), false, null, null));
    }

    @Transactional
    public UserSummary updateMe(Long userId, UpdateMeRequest req) {
        User user = getUser(userId);
        if (req.nickname() != null) user.setNickname(req.nickname());
        if (req.avatarColor() != null) user.setAvatarColor(req.avatarColor());
        if (req.birthday() != null) user.setBirthday(req.birthday());
        return UserSummary.of(user);
    }

    public User getUser(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(ErrorCode.USER_NOT_FOUND));
    }

    private User partnerOf(Couple c, Long userId) {
        if (c.getUser1().getId().equals(userId)) return c.getUser2();
        if (c.getUser2().getId().equals(userId)) return c.getUser1();
        return null;
    }
}
