package com.today.dev;

import java.time.LocalDateTime;

public class DevDtos {

    /** 사용자 의견 한 건. */
    public record FeedbackView(
            Long id,
            Long userId,
            String userNickname,
            String content,
            String source,
            LocalDateTime createdAt
    ) {}

    /** 질문 뱅크(question_pool) 한 건. */
    public record PoolItem(
            Long id,
            String text,
            String category,
            String theme,
            int depth,
            String contextTrigger,
            boolean template,
            int usedCount,
            boolean active
    ) {}

    /** 가입·커플 등 요약 통계. real* = 테스트/dev 계정 제외(카카오·애플 로그인만). */
    public record StatsView(
            long users,
            long usersReal,
            long couples,
            long couplesReal,
            long coupledUsers,
            long coupledUsersReal,
            long entries,
            long questionsPool,
            long questionsActive,
            long feedback
    ) {}
}
