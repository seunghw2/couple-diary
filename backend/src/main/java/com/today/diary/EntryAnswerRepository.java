package com.today.diary;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface EntryAnswerRepository extends JpaRepository<EntryAnswer, Long> {

    List<EntryAnswer> findByEntry_Id(Long entryId);

    void deleteByEntry_Id(Long entryId);

    // 계정 삭제: 여러 entry의 답변 일괄 제거.
    void deleteByEntry_IdIn(List<Long> entryIds);
}
