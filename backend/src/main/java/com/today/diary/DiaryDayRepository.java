package com.today.diary;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface DiaryDayRepository extends JpaRepository<DiaryDay, Long> {

    Optional<DiaryDay> findByCouple_IdAndDate(Long coupleId, LocalDate date);

    List<DiaryDay> findByCouple_IdAndDateBetween(Long coupleId, LocalDate start, LocalDate end);
}
