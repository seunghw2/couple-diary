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
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.math.BigInteger;
import java.security.Key;
import java.security.KeyFactory;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.RSAPublicKeySpec;
import java.util.Base64;
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
    private final RestClient jwksClient;

    // kid → 공개키 캐시. Apple 키는 자주 바뀌지 않으므로 재사용하되, 미스 시 재조회한다.
    private final Map<String, RSAPublicKey> keyCache = new ConcurrentHashMap<>();

    public AppleClient(@Value("${app.apple.client-id:uk.terrylovesapp.lovetoday}") String clientId) {
        this.clientId = clientId;
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

    /** 우리 도메인이 필요로 하는 Apple 사용자 최소 정보. */
    public record AppleUser(String appleId, String email) {}

    // ---- Apple JWKS 응답 매핑(필요 필드만) ----
    @JsonIgnoreProperties(ignoreUnknown = true)
    record Jwks(List<Jwk> keys) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Jwk(String kty, String kid, String n, String e) {}
}
