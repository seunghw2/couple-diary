package com.today.question.admin;

import com.today.common.ApiException;
import com.today.common.ErrorCode;
import com.today.question.admin.AdminQuestionDtos.GenerateRequest;
import com.today.question.admin.AdminQuestionDtos.GenerateResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 관리자 배치 질문 생성 API. JWT가 아닌 {@code X-Admin-Token} 헤더로 인증한다
 * (SecurityConfig에서 {@code /api/admin/**}는 permitAll — 인증은 이 컨트롤러에서 직접).
 */
@RestController
@RequestMapping("/api/admin/questions")
@RequiredArgsConstructor
public class AdminQuestionController {

    private final AdminQuestionService adminQuestionService;

    /** 설정된 관리자 토큰. 미설정(빈 값)이면 모든 요청 거부. */
    @Value("${app.admin-token:}")
    private String adminToken;

    @PostMapping("/generate")
    public GenerateResponse generate(
            @RequestHeader(value = "X-Admin-Token", required = false) String token,
            @Valid @RequestBody GenerateRequest req) {
        requireAdmin(token);
        return adminQuestionService.generate(req.theme(), req.tone(), req.count());
    }

    private void requireAdmin(String token) {
        if (adminToken == null || adminToken.isBlank() || !adminToken.equals(token)) {
            throw new ApiException(ErrorCode.FORBIDDEN);
        }
    }
}
