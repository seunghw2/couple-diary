package com.today.diary;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PlaceFavoriteRepository extends JpaRepository<PlaceFavorite, Long> {

    List<PlaceFavorite> findByCouple_IdOrderByIdAsc(Long coupleId);

    boolean existsByCouple_IdAndName(Long coupleId, String name);

    void deleteByCouple_IdAndName(Long coupleId, String name);

    // 계정 삭제: 커플의 모든 즐겨찾기 제거.
    void deleteByCouple_Id(Long coupleId);
}
