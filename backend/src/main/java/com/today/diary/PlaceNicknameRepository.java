package com.today.diary;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PlaceNicknameRepository extends JpaRepository<PlaceNickname, Long> {

    Optional<PlaceNickname> findByCouple_IdAndName(Long coupleId, String name);

    List<PlaceNickname> findByCouple_Id(Long coupleId);
}
