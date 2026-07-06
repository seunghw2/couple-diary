package com.today.auth;

import com.today.user.UserDtos.AppleLoginRequest;
import com.today.user.UserDtos.AuthResponse;
import com.today.user.UserDtos.DevLoginRequest;
import com.today.user.UserDtos.KakaoLoginRequest;
import com.today.user.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.net.URLEncoder;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final UserService userService;

    @Value("${app.kakao.rest-key}")
    private String kakaoRestKey;

    @PostMapping("/dev-login")
    public AuthResponse devLogin(@Valid @RequestBody DevLoginRequest req) {
        return userService.devLogin(req);
    }

    /**
     * 카카오 로그인(권장 경로). 프론트가 WebBrowser 인가 플로우로 받은 code + redirectUri를 넘기면
     * 서버가 토큰 교환·사용자 조회·upsert 후 우리 JWT를 발급한다. dev-login과 응답(AuthResponse) 동일.
     */
    @PostMapping("/kakao")
    public AuthResponse kakaoLogin(@Valid @RequestBody KakaoLoginRequest req) {
        return userService.kakaoLogin(req);
    }

    /**
     * Apple 로그인. 프론트(expo-apple-authentication)가 받은 identityToken을 검증해
     * 사용자 upsert 후 우리 JWT를 발급한다. Apple 가이드라인 4.8 대응.
     */
    @PostMapping("/apple")
    public AuthResponse appleLogin(@Valid @RequestBody AppleLoginRequest req) {
        return userService.appleLogin(req);
    }

    /**
     * 서버 콜백 경로(백엔드가 redirect_uri일 때 사용).
     * 카카오 → 이 콜백으로 code 전달 → 서버가 로그인 처리 → state(앱 returnUri)로 302 리다이렉트하며 token 부착.
     *
     * state에는 앱이 openAuthSessionAsync로 넘긴 returnUri(예: exp://.../--/auth 또는 today://auth)가 담긴다.
     * 실패 시 returnUri?error=... 로 리다이렉트. state가 없으면 JSON으로 폴백 반환.
     */
    @GetMapping("/kakao/callback")
    public ResponseEntity<?> kakaoCallback(@RequestParam("code") String code,
                                           @RequestParam(value = "state", required = false) String state) {
        String redirectUri = ServerCallbackUri.SELF; // 카카오 콘솔에 등록된 값과 동일해야 교환 성공
        if (state == null || state.isBlank()) {
            // returnUri가 없으면 앱으로 되돌릴 수 없으므로 JSON으로 결과 반환(디버그/폴백).
            AuthResponse res = userService.kakaoLogin(new KakaoLoginRequest(code, redirectUri));
            return ResponseEntity.ok(res);
        }
        try {
            AuthResponse res = userService.kakaoLogin(new KakaoLoginRequest(code, redirectUri));
            URI target = UriComponentsBuilder.fromUriString(state)
                    .queryParam("token", encode(res.accessToken()))
                    .build(true)
                    .toUri();
            return ResponseEntity.status(HttpStatus.FOUND).location(target).build();
        } catch (RuntimeException e) {
            URI target = UriComponentsBuilder.fromUriString(state)
                    .queryParam("error", "kakao_login_failed")
                    .build(true)
                    .toUri();
            return ResponseEntity.status(HttpStatus.FOUND).location(target).build();
        }
    }

    private static String encode(String v) {
        return URLEncoder.encode(v, StandardCharsets.UTF_8);
    }

    /** 서버 콜백이 자기 자신을 redirect_uri로 쓸 때의 절대 URL(운영). */
    static final class ServerCallbackUri {
        static final String SELF = "https://today-api.hammerslog.trade/api/auth/kakao/callback";
        private ServerCallbackUri() {}
    }
}
