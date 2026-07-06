package com.today.diary;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface DiaryDayRepository extends JpaRepository<DiaryDay, Long> {

    Optional<DiaryDay> findByCouple_IdAndDate(Long coupleId, LocalDate date);

    List<DiaryDay> findByCouple_IdAndDateBetween(Long coupleId, LocalDate start, LocalDate end);

    // 계정 삭제: 커플의 모든 diary day (element collection 정리를 위해 엔티티 로드 후 deleteAll).
    List<DiaryDay> findByCouple_Id(Long coupleId);
}
