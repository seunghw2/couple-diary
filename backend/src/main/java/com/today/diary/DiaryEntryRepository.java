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

    /**
     * 커플의 특정 장소(name)를 locations에 포함하는 모든 entry.
     * 장소 상세(날짜별 집계)에서 사용. day.date 내림차순.
     */
    @Query("select e from DiaryEntry e join e.locations loc " +
            "where e.day.couple.id = :coupleId and loc = :name " +
            "order by e.day.date desc")
    List<DiaryEntry> findByCoupleAndLocation(@Param("coupleId") Long coupleId,
                                             @Param("name") String name);

    /**
     * 커플의 entry에 저장된 장소 좌표 메타(locationPoints)에서 (이름, 카테고리) 쌍을 한 번에 로드.
     * 지도 목록에서 name→category 매핑용. category가 비어있지 않은 것만 가져와, 같은 이름이
     * 여러 개면 그 중 아무거나 하나를 쓰면 된다(호출부에서 first-wins 매핑). N+1 방지용 배치 쿼리.
     */
    @Query("select lp.name as name, lp.category as category from DiaryEntry e join e.locationPoints lp " +
            "where e.day.couple.id = :coupleId and lp.category is not null and trim(lp.category) <> ''")
    List<LocationCategoryProjection> findLocationCategoriesByCouple(@Param("coupleId") Long coupleId);

    /** JPQL projection: 장소명 + 방문 일수. */
    interface LocationCountProjection {
        String getName();
        long getCount();
    }

    /** JPQL projection: 장소명 + 카테고리(장소 종류). */
    interface LocationCategoryProjection {
        String getName();
        String getCategory();
    }
}
