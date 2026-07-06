package com.today.question;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface QuestionPoolRepository extends JpaRepository<QuestionPool, Long> {

    List<QuestionPool> findByActiveTrue();

    long countByActiveTrue();

    Optional<QuestionPool> findFirstByText(String text);

    List<QuestionPool> findBySource(String source);

    /** 비템플릿 활성 풀(일반 배정 대상). */
    List<QuestionPool> findByActiveTrueAndIsTemplateFalse();

    /** 특정 맥락 트리거의 활성 템플릿 질문. */
    List<QuestionPool> findByActiveTrueAndIsTemplateTrueAndContextTrigger(String contextTrigger);
}
