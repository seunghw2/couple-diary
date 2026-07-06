package com.today.question;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface DailyQuestionRepository extends JpaRepository<DailyQuestion, Long> {

    List<DailyQuestion> findByCouple_IdAndDate(Long coupleId, LocalDate date);

    boolean existsByCouple_Id(Long coupleId);

    /** 가장 최근 기간의 한 행(마감 판정·직전 기간 확인용). */
    java.util.Optional<DailyQuestion> findTopByCouple_IdOrderByDateDescSlotDesc(Long coupleId);

    Optional<DailyQuestion> findByCouple_IdAndDateAndChosenTrue(Long coupleId, LocalDate date);

    /** 과거(오늘 제외) chosen 질문을 날짜 내림차순으로. 아카이브용. */
    List<DailyQuestion> findByCouple_IdAndChosenTrueAndDateLessThanOrderByDateDesc(
            Long coupleId, LocalDate date);

    // 계정 삭제: 커플의 모든 daily question. 자식(answer/reaction/comment) 정리에 id 목록 사용.
    List<DailyQuestion> findByCouple_Id(Long coupleId);

    void deleteByCouple_Id(Long coupleId);
}
