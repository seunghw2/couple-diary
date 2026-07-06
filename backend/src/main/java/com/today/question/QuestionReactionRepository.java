package com.today.question;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface QuestionReactionRepository extends JpaRepository<QuestionReaction, Long> {

    Optional<QuestionReaction> findByAnswer_IdAndUser_Id(Long answerId, Long userId);

    boolean existsByAnswer_IdAndUser_Id(Long answerId, Long userId);

    List<QuestionReaction> findByAnswer_Id(Long answerId);

    void deleteByAnswer_IdAndUser_Id(Long answerId, Long userId);
}
