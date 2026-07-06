package com.today.question;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface DailyQuestionRepository extends JpaRepository<DailyQuestion, Long> {

    List<DailyQuestion> findByCouple_IdAndDate(Long coupleId, LocalDate date);

    Optional<DailyQuestion> findByCouple_IdAndDateAndChosenTrue(Long coupleId, LocalDate date);

    /** 과거(오늘 제외) chosen 질문을 날짜 내림차순으로. 아카이브용. */
    List<DailyQuestion> findByCouple_IdAndChosenTrueAndDateLessThanOrderByDateDesc(
            Long coupleId, LocalDate date);
}
