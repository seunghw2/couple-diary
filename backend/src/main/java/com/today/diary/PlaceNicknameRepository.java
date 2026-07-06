package com.today.diary;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PlaceNicknameRepository extends JpaRepository<PlaceNickname, Long> {

    Optional<PlaceNickname> findByCouple_IdAndName(Long coupleId, String name);

    List<PlaceNickname> findByCouple_Id(Long coupleId);

    // 계정 삭제: 커플의 모든 장소 별명 제거.
    void deleteByCouple_Id(Long coupleId);
}
