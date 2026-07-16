package com.today.feedback;

import com.today.common.ApiException;
import com.today.common.ErrorCode;
import com.today.feedback.FeedbackDtos.CreateFeedbackRequest;
import com.today.user.User;
import com.today.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class FeedbackService {

    private final FeedbackRepository feedbackRepository;
    private final UserRepository userRepository;

    @Transactional
    public void submit(Long userId, CreateFeedbackRequest req) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(ErrorCode.USER_NOT_FOUND));
        feedbackRepository.save(Feedback.builder()
                .user(user)
                .content(req.content().strip())
                .source(req.source())
                .build());
    }
}
