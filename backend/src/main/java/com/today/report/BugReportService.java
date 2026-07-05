package com.today.report;

import com.today.common.ApiException;
import com.today.common.ErrorCode;
import com.today.report.BugReportDtos.*;
import com.today.user.User;
import com.today.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class BugReportService {

    private final BugReportRepository bugReportRepository;
    private final UserRepository userRepository;

    @Transactional
    public BugReportResponse create(Long userId, CreateBugReportRequest req) {
        String bug = trimToNull(req.bugText());
        String wish = trimToNull(req.wishText());
        // 버그/기능 제안 둘 다 비면 잘못된 입력.
        if (bug == null && wish == null) {
            throw new ApiException(ErrorCode.INVALID_INPUT, "버그 또는 기능 제안 중 최소 하나는 작성해 주세요.");
        }

        User me = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(ErrorCode.USER_NOT_FOUND));

        // 첨부 이미지는 최대 3장까지만 저장(빈 값 제거).
        List<String> images = req.imageUrls() == null ? List.of()
                : req.imageUrls().stream()
                        .filter(u -> u != null && !u.isBlank())
                        .limit(3)
                        .toList();

        BugReport saved = bugReportRepository.save(
                BugReport.builder().reporter(me).bugText(bug).wishText(wish)
                        .imageUrls(new ArrayList<>(images)).build());
        return BugReportResponse.of(saved);
    }

    @Transactional(readOnly = true)
    public BugReportListResponse list() {
        return new BugReportListResponse(
                bugReportRepository.findAllByOrderByCreatedAtDesc().stream()
                        .map(BugReportResponse::of)
                        .toList());
    }

    private static String trimToNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }
}
