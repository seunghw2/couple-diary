package com.today.question;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface QuestionAnswerRepository extends JpaRepository<QuestionAnswer, Long> {

    List<QuestionAnswer> findByDailyQuestion_Id(Long dailyQuestionId);

    Optional<QuestionAnswer> findByDailyQuestion_IdAndAuthor_Id(Long dailyQuestionId, Long authorId);

    // 계정 삭제: 여러 daily question의 답변 조회/일괄 삭제.
    List<QuestionAnswer> findByDailyQuestion_IdIn(List<Long> dailyQuestionIds);

    void deleteByDailyQuestion_IdIn(List<Long> dailyQuestionIds);
}
