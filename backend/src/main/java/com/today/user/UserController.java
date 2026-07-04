package com.today.user;

import com.today.common.SecurityUtil;
import com.today.user.UserDtos.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/me")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping
    public MeResponse me() {
        return userService.me(SecurityUtil.currentUserId());
    }

    @PatchMapping
    public UserSummary updateMe(@Valid @RequestBody UpdateMeRequest req) {
        return userService.updateMe(SecurityUtil.currentUserId(), req);
    }
}
