package com.today.couple;

import com.today.common.SecurityUtil;
import com.today.couple.CoupleDtos.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/couple")
@RequiredArgsConstructor
public class CoupleController {

    private final CoupleService coupleService;

    @PostMapping("/invite")
    public InviteResponse invite() {
        return coupleService.myInviteCode(SecurityUtil.currentUserId());
    }

    @PostMapping("/connect")
    public CoupleResponse connect(@Valid @RequestBody ConnectRequest req) {
        return coupleService.connect(SecurityUtil.currentUserId(), req);
    }

    @GetMapping
    public CoupleResponse couple() {
        return coupleService.myCouple(SecurityUtil.currentUserId());
    }

    @PutMapping("/anniversary")
    public CoupleResponse anniversary(@Valid @RequestBody AnniversaryRequest req) {
        return coupleService.setAnniversary(SecurityUtil.currentUserId(), req);
    }

    @GetMapping("/anniversaries")
    public AnniversaryListResponse anniversaries() {
        return coupleService.anniversaries(SecurityUtil.currentUserId());
    }
}
