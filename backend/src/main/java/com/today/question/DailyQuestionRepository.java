package com.today.question;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface DailyQuestionRepository extends JpaRepository<DailyQuestion, Long> {

    List<DailyQuestion> findByCouple_IdAndDate(Long coupleId, LocalDate date);

    /**
     * 봉인 대기(pending) 편지: chosen이고 마감이 지났는데 봉인된 답이 정확히 1개인 것.
     * (한 명만 답장 → 지나가지 않고 계속 봉인. 상대가 답하면 열림.) 날짜 내림차순.
     */
    @Query("select dq from DailyQuestion dq where dq.couple.id = :coupleId and dq.chosen = true "
            + "and dq.deadline is not null and dq.deadline < :now "
            + "and (select count(a) from QuestionAnswer a where a.dailyQuestion = dq and a.sealedAt is not null) = 1 "
            + "order by dq.date desc")
    List<DailyQuestion> findPendingLetters(@Param("coupleId") Long coupleId, @Param("now") LocalDateTime now);

    boolean existsByCouple_Id(Long coupleId);

    /** 해당 질문이 이 커플에 배정된 적 있는지(신고 소속 검증용). */
    boolean existsByCouple_IdAndQuestion_Id(Long coupleId, Long questionId);

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
