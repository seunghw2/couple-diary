package com.today.feedback;

import com.today.common.SecurityUtil;
import com.today.feedback.FeedbackDtos.CreateFeedbackRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** 사용자 의견 수집 API. */
@RestController
@RequestMapping("/api/feedback")
@RequiredArgsConstructor
public class FeedbackController {

    private final FeedbackService feedbackService;

    @PostMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void submit(@Valid @RequestBody CreateFeedbackRequest req) {
        feedbackService.submit(SecurityUtil.currentUserId(), req);
    }
}
