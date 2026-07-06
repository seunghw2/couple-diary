package com.today.question;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface QuestionCommentRepository extends JpaRepository<QuestionComment, Long> {

    List<QuestionComment> findByDailyQuestion_IdOrderByCreatedAtAsc(Long dailyQuestionId);

    // 계정 삭제: 여러 daily question에 달린 댓글 일괄 제거.
    void deleteByDailyQuestion_IdIn(List<Long> dailyQuestionIds);
}
