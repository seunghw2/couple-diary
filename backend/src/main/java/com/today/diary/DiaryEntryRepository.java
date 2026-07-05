package com.today.diary;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface DiaryEntryRepository extends JpaRepository<DiaryEntry, Long> {

    List<DiaryEntry> findByDay_Id(Long dayId);

    List<DiaryEntry> findByDay_IdIn(List<Long> dayIds);

    Optional<DiaryEntry> findByDay_IdAndAuthor_Id(Long dayId, Long authorId);

    /**
     * 커플의 과거 entry들에서 사용된 distinct 장소 목록을 최근순으로 반환.
     * 각 장소의 가장 최근 사용 날짜(day.date) 기준 내림차순.
     */
    @Query("select loc from DiaryEntry e join e.locations loc " +
            "where e.day.couple.id = :coupleId and loc is not null and trim(loc) <> '' " +
            "group by loc order by max(e.day.date) desc")
    List<String> findDistinctLocationsByCouple(@Param("coupleId") Long coupleId, Pageable pageable);

    /**
     * 커플의 장소별 방문 일수(distinct day) + 최근순 정렬.
     * count는 두 사람이 같은 날 같은 장소를 적어도 1로 세도록 distinct day 기준.
     */
    @Query("select loc as name, count(distinct e.day.id) as count from DiaryEntry e join e.locations loc " +
            "where e.day.couple.id = :coupleId and loc is not null and trim(loc) <> '' " +
            "group by loc order by max(e.day.date) desc")
    List<LocationCountProjection> findLocationCountsByCouple(@Param("coupleId") Long coupleId, Pageable pageable);

    /** JPQL projection: 장소명 + 방문 일수. */
    interface LocationCountProjection {
        String getName();
        long getCount();
    }
}
