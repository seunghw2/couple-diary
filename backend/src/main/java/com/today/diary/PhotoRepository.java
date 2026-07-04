package com.today.diary;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PhotoRepository extends JpaRepository<Photo, Long> {

    List<Photo> findByEntry_Id(Long entryId);

    List<Photo> findByEntry_IdIn(List<Long> entryIds);

    void deleteByEntry_Id(Long entryId);
}
