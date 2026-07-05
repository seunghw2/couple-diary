package com.today.auth;

import com.today.common.ApiException;
import com.today.common.ErrorCode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;

/**
 * 카카오 OAuth 저수준 클라이언트.
 * 1) 인가 코드 → 액세스 토큰 (kauth.kakao.com)
 * 2) 액세스 토큰 → 사용자 정보 (kapi.kakao.com)
 *
 * REST 키는 서버에만 보관(application.yml app.kakao.rest-key). PlaceService와 동일한 RestClient 패턴.
 */
@Slf4j
@Component
public class KakaoClient {

    private final String restKey;
    private final RestClient authClient;   // kauth.kakao.com — 토큰 발급
    private final RestClient apiClient;     // kapi.kakao.com  — 사용자 정보

    public KakaoClient(@Value("${app.kakao.rest-key}") String restKey) {
        this.restKey = restKey;
        this.authClient = RestClient.builder()
                .baseUrl("https://kauth.kakao.com")
                .build();
        this.apiClient = RestClient.builder()
                .baseUrl("https://kapi.kakao.com")
                .build();
    }

    /** 인가 코드를 카카오 액세스 토큰으로 교환. */
    public String exchangeToken(String code, String redirectUri) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", "authorization_code");
        form.add("client_id", restKey);
        form.add("redirect_uri", redirectUri);
        form.add("code", code);

        TokenResponse resp;
        try {
            resp = authClient.post()
                    .uri("/oauth/token")
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(form)
                    .retrieve()
                    .body(TokenResponse.class);
        } catch (RuntimeException e) {
            log.warn("Kakao token exchange failed", e);
            throw new ApiException(ErrorCode.KAKAO_AUTH_FAILED);
        }
        if (resp == null || resp.access_token() == null || resp.access_token().isBlank()) {
            throw new ApiException(ErrorCode.KAKAO_AUTH_FAILED);
        }
        return resp.access_token();
    }

    /** 카카오 액세스 토큰으로 사용자 정보 조회. */
    public KakaoUser fetchUser(String kakaoAccessToken) {
        UserMeResponse resp;
        try {
            resp = apiClient.get()
                    .uri("/v2/user/me")
                    .header("Authorization", "Bearer " + kakaoAccessToken)
                    .retrieve()
                    .body(UserMeResponse.class);
        } catch (RuntimeException e) {
            log.warn("Kakao user fetch failed", e);
            throw new ApiException(ErrorCode.KAKAO_AUTH_FAILED);
        }
        if (resp == null || resp.id() == null) {
            throw new ApiException(ErrorCode.KAKAO_AUTH_FAILED);
        }
        String nickname = null;
        String email = null;
        if (resp.kakao_account() != null) {
            email = resp.kakao_account().email();
            if (resp.kakao_account().profile() != null) {
                nickname = resp.kakao_account().profile().nickname();
            }
        }
        return new KakaoUser(String.valueOf(resp.id()), nickname, email);
    }

    /** 우리 도메인이 필요로 하는 카카오 사용자 최소 정보. */
    public record KakaoUser(String kakaoId, String nickname, String email) {}

    // ---- 카카오 응답 매핑(필요 필드만; non_null 무시) ----
    record TokenResponse(String access_token, String token_type, String refresh_token, Integer expires_in) {}

    record UserMeResponse(Long id, KakaoAccount kakao_account) {}

    record KakaoAccount(String email, Profile profile) {}

    record Profile(String nickname) {}
}
