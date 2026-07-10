package com.today.auth;

import com.today.user.UserDtos.AuthResponse;
import com.today.user.UserDtos.DevLoginRequest;
import com.today.user.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 개발/테스트 전용 로그인. 닉네임만으로 무인증 로그인하므로 절대 프로덕션에 노출하면 안 된다.
 * {@code @Profile("!prod")} 라 prod 프로파일에선 이 빈이 등록되지 않아 엔드포인트가 404가 된다.
 */
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Profile("!prod")
public class DevAuthController {

    private final UserService userService;

    @PostMapping("/dev-login")
    public AuthResponse devLogin(@Valid @RequestBody DevLoginRequest req) {
        return userService.devLogin(req);
    }
}
