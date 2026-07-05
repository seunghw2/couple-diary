package com.today.report;

import com.today.common.SecurityUtil;
import com.today.report.BugReportDtos.*;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/bug-reports")
@RequiredArgsConstructor
public class BugReportController {

    private final BugReportService bugReportService;

    /** 버그/기능 제안 작성. 둘 다 비면 400. 현재 로그인 유저가 reporter. */
    @PostMapping
    public BugReportResponse create(@RequestBody CreateBugReportRequest req) {
        return bugReportService.create(SecurityUtil.currentUserId(), req);
    }

    /** 전역 최신순 목록(커플 두 명 모두 노출). */
    @GetMapping
    public BugReportListResponse list() {
        return bugReportService.list();
    }
}
