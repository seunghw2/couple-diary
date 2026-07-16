package com.today.dev;

import com.today.common.SecurityUtil;
import com.today.dev.DevDtos.FeedbackView;
import com.today.dev.DevDtos.PoolItem;
import com.today.dev.DevDtos.StatsView;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 개발자도구 API(슈퍼 관리자 전용). JWT 인증 경로(/api/dev/**) — 권한은 서비스에서 role로 확인.
 */
@RestController
@RequestMapping("/api/dev")
@RequiredArgsConstructor
public class DevController {

    private final DevService devService;

    @GetMapping("/feedback")
    public List<FeedbackView> feedback() {
        return devService.feedback(SecurityUtil.currentUserId());
    }

    @GetMapping("/questions")
    public List<PoolItem> questions() {
        return devService.questionPool(SecurityUtil.currentUserId());
    }

    @GetMapping("/stats")
    public StatsView stats() {
        return devService.stats(SecurityUtil.currentUserId());
    }
}
