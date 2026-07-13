package com.today.push;

import com.today.common.ApiException;
import com.today.common.ErrorCode;
import com.today.user.User;
import com.today.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PushTokenService {

    private final PushTokenRepository pushTokenRepository;
    private final UserRepository userRepository;

    /** 토큰 등록(있으면 소유자/플랫폼만 갱신). 한 기기 토큰은 로그인한 유저에게 귀속. */
    @Transactional
    public void register(Long userId, String token, String platform) {
        if (token == null || token.isBlank()) throw new ApiException(ErrorCode.INVALID_INPUT);
        String value = token.trim();
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(ErrorCode.UNAUTHORIZED));
        pushTokenRepository.findByToken(value).ifPresentOrElse(
                existing -> {
                    existing.setUser(user);
                    existing.setPlatform(platform);
                },
                () -> pushTokenRepository.save(PushToken.builder()
                        .user(user).token(value).platform(platform).build())
        );
    }

    /** 로그아웃 시 이 기기 토큰 해제 — 본인 소유 토큰만(소유권 검증). */
    @Transactional
    public void unregister(Long userId, String token) {
        if (token == null || token.isBlank()) return;
        pushTokenRepository.deleteByTokenAndUser_Id(token.trim(), userId);
    }
}
