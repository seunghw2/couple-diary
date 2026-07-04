package com.today.diary;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DiaryEntryRepository extends JpaRepository<DiaryEntry, Long> {

    List<DiaryEntry> findByDay_Id(Long dayId);

    List<DiaryEntry> findByDay_IdIn(List<Long> dayIds);

    Optional<DiaryEntry> findByDay_IdAndAuthor_Id(Long dayId, Long authorId);
}
