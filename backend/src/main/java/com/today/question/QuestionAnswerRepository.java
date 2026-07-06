package com.today.question;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface QuestionAnswerRepository extends JpaRepository<QuestionAnswer, Long> {

    List<QuestionAnswer> findByDailyQuestion_Id(Long dailyQuestionId);

    Optional<QuestionAnswer> findByDailyQuestion_IdAndAuthor_Id(Long dailyQuestionId, Long authorId);
}
