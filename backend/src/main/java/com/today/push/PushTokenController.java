package com.today.push;

import com.today.common.SecurityUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
public class PushTokenController {

    private final PushTokenService pushTokenService;

    public record TokenRequest(String token, String platform) {}

    /** 앱이 발급받은 Expo 푸시 토큰 등록. */
    @PostMapping("/api/push-tokens")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void register(@RequestBody TokenRequest req) {
        pushTokenService.register(SecurityUtil.currentUserId(), req.token(), req.platform());
    }

    /** 로그아웃 등에서 이 기기 토큰 해제. */
    @DeleteMapping("/api/push-tokens")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void unregister(@RequestBody TokenRequest req) {
        pushTokenService.unregister(req.token());
    }
}
