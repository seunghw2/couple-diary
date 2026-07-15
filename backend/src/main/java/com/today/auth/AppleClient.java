package com.today.auth;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.today.common.ApiException;
import com.today.common.ErrorCode;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jws;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.Locator;
import io.jsonwebtoken.ProtectedHeader;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;

import java.math.BigInteger;
import java.security.Key;
import java.security.KeyFactory;
import java.security.PrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.RSAPublicKeySpec;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Apple Sign In 저수준 클라이언트. 프론트가 받은 identityToken(JWT)을 검증한다.
 *
 * 1) Apple 공개키(JWKS, appleid.apple.com/auth/keys) 조회 → 토큰 헤더의 kid로 RSA 공개키 구성
 * 2) 서명·발급자(iss=appleid.apple.com)·대상(aud=우리 번들 ID)·만료(exp)를 jjwt로 검증
 * 3) 통과하면 sub(Apple 고유 사용자 ID)·email을 반환
 *
 * 카카오와 달리 서버-서버 토큰 교환이 없다. Apple이 서명한 JWT 자체가 신뢰의 근거다.
 */
@Slf4j
@Component
public class AppleClient {

    private static final String APPLE_ISSUER = "https://appleid.apple.com";

    /** 검증 대상(aud). iOS 앱 번들 ID와 동일해야 한다. */
    private final String clientId;
    // 서버-서버 인증(토큰 교환·revoke)용. Apple Developer의 'Sign in with Apple' 키에서 발급.
    private final String teamId;
    private final String keyId;
    private final String privateKeyPem;  // .p8 내용(PEM)
    private final RestClient jwksClient;

    // kid → 공개키 캐시. Apple 키는 자주 바뀌지 않으므로 재사용하되, 미스 시 재조회한다.
    private final Map<String, RSAPublicKey> keyCache = new ConcurrentHashMap<>();

    public AppleClient(
            @Value("${app.apple.client-id:uk.terrylovesapp.lovetoday}") String clientId,
            @Value("${app.apple.team-id:}") String teamId,
            @Value("${app.apple.key-id:}") String keyId,
            @Value("${app.apple.private-key:}") String privateKeyPem) {
        this.clientId = clientId;
        this.teamId = teamId;
        this.keyId = keyId;
        this.privateKeyPem = privateKeyPem;
        this.jwksClient = RestClient.builder()
                .baseUrl("https://appleid.apple.com")
                .build();
    }

    /** identityToken을 검증하고 Apple 사용자 정보를 반환. 실패 시 APPLE_AUTH_FAILED. */
    public AppleUser verify(String identityToken) {
        try {
            Jws<Claims> jws = Jwts.parser()
                    .keyLocator(keyLocator())
                    .requireIssuer(APPLE_ISSUER)
                    .requireAudience(clientId)
                    .build()
                    .parseSignedClaims(identityToken);
            Claims c = jws.getPayload();
            String sub = c.getSubject();
            if (sub == null || sub.isBlank()) {
                throw new ApiException(ErrorCode.APPLE_AUTH_FAILED);
            }
            String email = c.get("email", String.class);
            return new AppleUser(sub, email);
        } catch (ApiException e) {
            throw e;
        } catch (JwtException | IllegalArgumentException e) {
            log.warn("Apple identity token verification failed", e);
            throw new ApiException(ErrorCode.APPLE_AUTH_FAILED);
        }
    }

    /** 토큰 헤더의 kid에 해당하는 Apple 공개키를 찾아 준다(캐시 우선, 미스 시 JWKS 재조회). */
    private Locator<Key> keyLocator() {
        return new Locator<>() {
            @Override
            public Key locate(io.jsonwebtoken.Header header) {
                if (!(header instanceof ProtectedHeader ph)) {
                    throw new ApiException(ErrorCode.APPLE_AUTH_FAILED);
                }
                String kid = ph.getKeyId();
                if (kid == null) throw new ApiException(ErrorCode.APPLE_AUTH_FAILED);
                RSAPublicKey cached = keyCache.get(kid);
                if (cached != null) return cached;
                refreshKeys();
                RSAPublicKey key = keyCache.get(kid);
                if (key == null) throw new ApiException(ErrorCode.APPLE_AUTH_FAILED);
                return key;
            }
        };
    }

    /** Apple JWKS를 조회해 kid→RSAPublicKey 캐시를 갱신한다. */
    private void refreshKeys() {
        Jwks jwks;
        try {
            jwks = jwksClient.get()
                    .uri("/auth/keys")
                    .retrieve()
                    .body(Jwks.class);
        } catch (RuntimeException e) {
            log.warn("Apple JWKS fetch failed", e);
            throw new ApiException(ErrorCode.APPLE_AUTH_FAILED);
        }
        if (jwks == null || jwks.keys() == null) {
            throw new ApiException(ErrorCode.APPLE_AUTH_FAILED);
        }
        for (Jwk k : jwks.keys()) {
            if (!"RSA".equals(k.kty())) continue;
            try {
                BigInteger n = new BigInteger(1, Base64.getUrlDecoder().decode(k.n()));
                BigInteger e = new BigInteger(1, Base64.getUrlDecoder().decode(k.e()));
                RSAPublicKey pub = (RSAPublicKey) KeyFactory.getInstance("RSA")
                        .generatePublic(new RSAPublicKeySpec(n, e));
                keyCache.put(k.kid(), pub);
            } catch (Exception ex) {
                log.warn("Apple JWK parse failed for kid={}", k.kid(), ex);
            }
        }
    }

    // ===================== 서버-서버 인증(토큰 교환 · revoke) =====================

    /** revoke/토큰 교환에 필요한 Apple 키가 모두 설정됐는가(미설정이면 관련 기능 no-op). */
    public boolean isServerAuthConfigured() {
        return notBlank(teamId) && notBlank(keyId) && notBlank(privateKeyPem);
    }

    /** 로그인 시 authorizationCode → refresh_token 교환. 미설정/코드없음/실패면 null. */
    public String exchangeRefreshToken(String authorizationCode) {
        if (!isServerAuthConfigured() || !notBlank(authorizationCode)) return null;
        try {
            MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
            form.add("client_id", clientId);
            form.add("client_secret", clientSecret());
            form.add("grant_type", "authorization_code");
            form.add("code", authorizationCode);
            TokenResponse res = jwksClient.post().uri("/auth/token")
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(form).retrieve().body(TokenResponse.class);
            return res == null ? null : res.refresh_token();
        } catch (RuntimeException e) {
            log.warn("Apple token exchange failed", e);
            return null;
        }
    }

    /** 계정 삭제 시 Apple 토큰 revoke(Apple 5.1.1(v) 요건). 미설정/토큰없음/실패면 조용히 넘어간다. */
    public void revoke(String refreshToken) {
        if (!isServerAuthConfigured() || !notBlank(refreshToken)) return;
        try {
            MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
            form.add("client_id", clientId);
            form.add("client_secret", clientSecret());
            form.add("token", refreshToken);
            form.add("token_type_hint", "refresh_token");
            jwksClient.post().uri("/auth/revoke")
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(form).retrieve().toBodilessEntity();
        } catch (RuntimeException e) {
            log.warn("Apple token revoke failed (계정 삭제는 계속 진행)", e);
        }
    }

    /** client_secret = ES256로 서명한 JWT(iss=teamId, sub=clientId, aud=Apple). */
    private String clientSecret() {
        try {
            String pem = privateKeyPem
                    .replace("-----BEGIN PRIVATE KEY-----", "")
                    .replace("-----END PRIVATE KEY-----", "")
                    .replaceAll("\\s", "");
            byte[] der = Base64.getDecoder().decode(pem);
            PrivateKey key = KeyFactory.getInstance("EC").generatePrivate(new PKCS8EncodedKeySpec(der));
            Instant now = Instant.now();
            return Jwts.builder()
                    .header().keyId(keyId).and()
                    .issuer(teamId).subject(clientId)
                    .audience().add(APPLE_ISSUER).and()
                    .issuedAt(Date.from(now))
                    .expiration(Date.from(now.plusSeconds(3600)))
                    .signWith(key, Jwts.SIG.ES256)
                    .compact();
        } catch (Exception e) {
            log.warn("Apple client_secret 생성 실패", e);
            throw new ApiException(ErrorCode.APPLE_AUTH_FAILED);
        }
    }

    private static boolean notBlank(String s) { return s != null && !s.isBlank(); }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record TokenResponse(String access_token, String refresh_token, String id_token) {}

    /** 우리 도메인이 필요로 하는 Apple 사용자 최소 정보. */
    public record AppleUser(String appleId, String email) {}

    // ---- Apple JWKS 응답 매핑(필요 필드만) ----
    @JsonIgnoreProperties(ignoreUnknown = true)
    record Jwks(List<Jwk> keys) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Jwk(String kty, String kid, String n, String e) {}
}
