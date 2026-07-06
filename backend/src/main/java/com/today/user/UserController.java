package com.today.user;

import com.today.common.SecurityUtil;
import com.today.user.UserDtos.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
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

    /**
     * 계정 삭제 (Apple 5.1.1(v) 필수). 내 계정과 관련 데이터를 하드 삭제한다.
     * 커플이 있으면 커플 공유 데이터도 함께 삭제되며 상대는 '미연결' 상태가 된다.
     */
    @DeleteMapping
    public ResponseEntity<Void> deleteMe() {
        userService.deleteAccount(SecurityUtil.currentUserId());
        return ResponseEntity.noContent().build();
    }
}
