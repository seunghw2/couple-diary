package com.today.question;

import org.springframework.data.jpa.repository.JpaRepository;

public interface QuestionReportRepository extends JpaRepository<QuestionReport, Long> {

    boolean existsByQuestion_IdAndCouple_Id(Long questionId, Long coupleId);

    /** 이 질문을 신고한 서로 다른 커플 수(= 행 수, 유니크 제약으로 커플당 1행). */
    long countByQuestion_Id(Long questionId);

    // 계정 삭제: 커플의 모든 질문 신고 제거.
    void deleteByCouple_Id(Long coupleId);
}
