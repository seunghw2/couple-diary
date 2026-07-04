package com.today.diary;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PhotoRepository extends JpaRepository<Photo, Long> {

    List<Photo> findByEntry_Id(Long entryId);

    List<Photo> findByEntry_IdIn(List<Long> entryIds);

    void deleteByEntry_Id(Long entryId);

    // colorSeed 기반 사진(url 없음)만 삭제
    void deleteByEntry_IdAndUrlIsNull(Long entryId);

    // 업로드 URL 기반 사진만 삭제
    void deleteByEntry_IdAndUrlIsNotNull(Long entryId);
}
