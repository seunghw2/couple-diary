package com.today.question;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface QuestionCommentRepository extends JpaRepository<QuestionComment, Long> {

    List<QuestionComment> findByDailyQuestion_IdOrderByCreatedAtAsc(Long dailyQuestionId);
}
