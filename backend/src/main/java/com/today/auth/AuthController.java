package com.today.auth;

import com.today.user.UserDtos.AppleLoginRequest;
import com.today.user.UserDtos.AuthResponse;
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

    /** 카카오 콘솔에 등록된 서버 콜백 절대 URL. 호스팅 이전 시 이 값(env)만 바꾸면 된다. */
    @Value("${app.kakao.callback-url:https://lovetoday.terrylovesapp.uk/api/auth/kakao/callback}")
    private String kakaoCallbackUrl;

    // 주의: dev-login(닉네임 무인증 로그인)은 보안상 프로덕션에서 노출되면 안 되므로
    // 별도 DevAuthController(@Profile("!prod"))로 분리했다. prod 프로파일에선 등록되지 않는다.

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
        String redirectUri = kakaoCallbackUrl; // 카카오 콘솔에 등록된 값과 동일해야 교환 성공
        // 오픈리다이렉트 방어: state(returnUri)가 허용 스킴/도메인이 아니면 토큰을 실어 보내지 않는다.
        if (state != null && !state.isBlank() && !isAllowedReturnUri(state)) {
            return ResponseEntity.badRequest().build();
        }
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

    /**
     * returnUri(state)가 우리 앱으로 되돌아가는 안전한 대상인지 검증.
     * 허용: 앱 스킴(exp/exps/today), https + terrylovesapp.uk/hammerslog.trade 도메인(자기/서브도메인).
     * 그 외(예: https://evil.com)면 거부해 액세스 토큰 유출을 막는다.
     */
    private static boolean isAllowedReturnUri(String state) {
        try {
            URI uri = URI.create(state.trim());
            String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase();
            if (scheme.equals("exp") || scheme.equals("exps") || scheme.equals("today")) {
                return true; // Expo Go / 앱 커스텀 스킴
            }
            if (scheme.equals("https")) {
                String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase();
                return host.equals("terrylovesapp.uk") || host.endsWith(".terrylovesapp.uk")
                        || host.equals("hammerslog.trade") || host.endsWith(".hammerslog.trade");
            }
            return false;
        } catch (RuntimeException e) {
            return false;
        }
    }
}
