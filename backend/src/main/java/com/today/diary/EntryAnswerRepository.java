package com.today.diary;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface EntryAnswerRepository extends JpaRepository<EntryAnswer, Long> {

    List<EntryAnswer> findByEntry_Id(Long entryId);

    void deleteByEntry_Id(Long entryId);
}
