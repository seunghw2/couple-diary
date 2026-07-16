package com.today.worldcup;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface WorldcupResultRepository extends JpaRepository<WorldcupResult, Long> {

    /** 내 특정 월드컵 기록(최신순). */
    List<WorldcupResult> findByAuthor_IdAndWorldcupKeyOrderByCreatedAtDesc(Long authorId, String worldcupKey);

    /** 커플 안에서 특정 저자의 특정 월드컵 가장 최근 결과(커플 비교용). */
    Optional<WorldcupResult> findTopByCouple_IdAndAuthor_IdAndWorldcupKeyOrderByCreatedAtDesc(
            Long coupleId, Long authorId, String worldcupKey);

    /** 내가 완주한 월드컵 key들(홈 목록의 완료 표시용). */
    List<WorldcupResult> findByAuthor_Id(Long authorId);

    /** 재플레이 시 최신 1건만 유지하기 위해 기존 결과 제거. */
    void deleteByAuthor_IdAndWorldcupKey(Long authorId, String worldcupKey);

    // 계정 삭제 정리용.
    void deleteByCouple_Id(Long coupleId);

    void deleteByAuthor_Id(Long authorId);
}
