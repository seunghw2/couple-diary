package com.today.auth;

import com.today.user.UserDtos.AuthResponse;
import com.today.user.UserDtos.DevLoginRequest;
import com.today.user.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final UserService userService;

    @PostMapping("/dev-login")
    public AuthResponse devLogin(@Valid @RequestBody DevLoginRequest req) {
        return userService.devLogin(req);
    }
}
