package com.today.diary;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface CalendarMarkRepository extends JpaRepository<CalendarMark, Long> {

    List<CalendarMark> findByCouple_Id(Long coupleId);

    Optional<CalendarMark> findByCouple_IdAndDate(Long coupleId, LocalDate date);

    void deleteByCouple_IdAndDate(Long coupleId, LocalDate date);

    // 계정 삭제: 커플의 모든 캘린더 마커 제거.
    void deleteByCouple_Id(Long coupleId);
}
