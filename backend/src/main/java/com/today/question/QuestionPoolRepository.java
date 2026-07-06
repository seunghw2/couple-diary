package com.today.question;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface QuestionPoolRepository extends JpaRepository<QuestionPool, Long> {

    List<QuestionPool> findByActiveTrue();

    long countByActiveTrue();
}
