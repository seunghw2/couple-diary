package com.today.upload;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;

/**
 * 사진 URL 시간제한 서명(서명 링크). 파일명 + 만료시각(exp)을 HMAC-SHA256으로 서명해
 * {@code /files/<name>?exp=E&sig=S} 형태로 내려주고, 서빙 시 검증한다.
 * 로그인한 사용자만 앱에서 서명 URL을 받으므로, 링크가 유출돼도 exp 후에는 무효.
 */
@Component
public class PhotoUrlSigner {

    // 만료를 시(hour) 경계로 정렬해 같은 사진은 한 시간 동안 같은 URL → 캐시 유효.
    private static final long TTL_HOURS = 6;

    private final byte[] key;

    public PhotoUrlSigner(@Value("${app.jwt.secret}") String secret) {
        this.key = secret.getBytes(StandardCharsets.UTF_8);
    }

    /** "/files/abc.jpg" → "/files/abc.jpg?exp=E&sig=S". 이미 서명돼 있거나 외부 URL이면 그대로. */
    public String signRelative(String relUrl) {
        if (relUrl == null || !relUrl.startsWith("/files/") || relUrl.contains("sig=")) return relUrl;
        String filename = relUrl.substring("/files/".length());
        long exp = (Instant.now().getEpochSecond() / 3600 + TTL_HOURS) * 3600;
        String sig = hmac(filename + "|" + exp);
        return relUrl + "?exp=" + exp + "&sig=" + sig;
    }

    /** 파일명(예: abc.jpg)과 exp/sig 파라미터 검증. */
    public boolean verify(String filename, String expStr, String sig) {
        if (filename == null || expStr == null || sig == null) return false;
        long exp;
        try {
            exp = Long.parseLong(expStr);
        } catch (NumberFormatException e) {
            return false;
        }
        if (Instant.now().getEpochSecond() > exp) return false; // 만료
        String expected = hmac(filename + "|" + exp);
        return MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8), sig.getBytes(StandardCharsets.UTF_8));
    }

    private String hmac(String data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key, "HmacSHA256"));
            byte[] out = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(out);
        } catch (Exception e) {
            throw new IllegalStateException("사진 URL 서명 실패", e);
        }
    }
}
