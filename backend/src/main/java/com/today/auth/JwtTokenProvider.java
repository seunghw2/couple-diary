package com.today.auth;

import com.today.common.ApiException;
import com.today.common.ErrorCode;
import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

@Slf4j
@Component
@RequiredArgsConstructor
public class JwtTokenProvider {

    /** application.yml의 기본(개발용) 시크릿 접두. 프로덕션에서 이 값이면 안 된다. */
    private static final String DEV_SECRET_PREFIX = "change-me";

    private final Environment environment;

    @Value("${app.jwt.secret}")
    private String secret;

    @Value("${app.jwt.access-token-ttl-minutes}")
    private long accessTtlMin;

    private SecretKey key;

    @PostConstruct
    void init() {
        // 프로덕션에서 기본/빈 시크릿이면 토큰 위조가 가능하므로 부팅을 막는다(fail-fast).
        boolean isProd = environment.acceptsProfiles(Profiles.of("prod"));
        boolean weak = secret == null || secret.isBlank() || secret.startsWith(DEV_SECRET_PREFIX);
        if (isProd && weak) {
            throw new IllegalStateException(
                    "운영 환경에서는 JWT_SECRET 환경변수(32바이트 이상 랜덤)를 반드시 설정해야 합니다.");
        }
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    public String createAccessToken(Long userId) {
        Date now = new Date();
        Date exp = new Date(now.getTime() + accessTtlMin * 60_000L);
        return Jwts.builder()
                .subject(String.valueOf(userId))
                .claim("type", "access")
                .issuedAt(now)
                .expiration(exp)
                .signWith(key)
                .compact();
    }

    public Long getUserId(String token) {
        return Long.parseLong(parse(token).getSubject());
    }

    public boolean isAccessToken(String token) {
        return "access".equals(parse(token).get("type", String.class));
    }

    private Claims parse(String token) {
        try {
            return Jwts.parser().verifyWith(key).build()
                    .parseSignedClaims(token).getPayload();
        } catch (ExpiredJwtException e) {
            throw new ApiException(ErrorCode.EXPIRED_TOKEN);
        } catch (JwtException | IllegalArgumentException e) {
            throw new ApiException(ErrorCode.INVALID_TOKEN);
        }
    }
}
