package com.today.dev;

import com.today.common.ApiException;
import com.today.common.ErrorCode;
import com.today.couple.CoupleRepository;
import com.today.dev.DevDtos.FeedbackView;
import com.today.dev.DevDtos.PoolItem;
import com.today.dev.DevDtos.StatsView;
import com.today.diary.DiaryEntryRepository;
import com.today.feedback.FeedbackRepository;
import com.today.question.QuestionPoolRepository;
import com.today.user.User;
import com.today.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/** 개발자도구(슈퍼 관리자 전용) 조회. 모든 메서드는 관리자 권한을 요구한다. */
@Service
@RequiredArgsConstructor
public class DevService {

    private final UserRepository userRepository;
    private final CoupleRepository coupleRepository;
    private final DiaryEntryRepository diaryEntryRepository;
    private final QuestionPoolRepository questionPoolRepository;
    private final FeedbackRepository feedbackRepository;

    private void requireAdmin(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(ErrorCode.USER_NOT_FOUND));
        if (!user.isAdmin()) throw new ApiException(ErrorCode.FORBIDDEN);
    }

    @Transactional(readOnly = true)
    public List<FeedbackView> feedback(Long userId) {
        requireAdmin(userId);
        return feedbackRepository.findAll(Sort.by(Sort.Direction.DESC, "id")).stream()
                .map(f -> new FeedbackView(
                        f.getId(),
                        f.getUser().getId(),
                        f.getUser().getNickname(),
                        f.getContent(),
                        f.getSource(),
                        f.getCreatedAt()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<PoolItem> questionPool(Long userId) {
        requireAdmin(userId);
        return questionPoolRepository.findAll(Sort.by("category", "depth", "id")).stream()
                .map(p -> new PoolItem(
                        p.getId(),
                        p.getText(),
                        p.getCategory(),
                        p.getTheme(),
                        p.getDepth(),
                        p.getContextTrigger(),
                        p.isTemplate(),
                        p.getUsedCount(),
                        p.isActive()))
                .toList();
    }

    @Transactional(readOnly = true)
    public StatsView stats(Long userId) {
        requireAdmin(userId);
        long couples = coupleRepository.count();
        long realCouples = coupleRepository.countRealCouples();
        return new StatsView(
                userRepository.count(),
                userRepository.countByKakaoIdIsNotNullOrAppleIdIsNotNull(),
                couples,
                realCouples,
                couples * 2,
                realCouples * 2,
                diaryEntryRepository.count(),
                questionPoolRepository.count(),
                questionPoolRepository.countByActiveTrue(),
                feedbackRepository.count());
    }
}
