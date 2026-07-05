package com.today.diary;

import com.today.user.User;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Getter
@Setter
@Table(name = "diary_entries",
        uniqueConstraints = @UniqueConstraint(name = "uk_entry_day_author", columnNames = {"day_id", "author_id"}))
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class DiaryEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "day_id", nullable = false)
    private DiaryDay day;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "author_id", nullable = false)
    private User author;

    @Column
    private Integer rating;

    @Column
    private String mood;

    // 호환 유지: 첫 장소를 미러링하는 단일 컬럼
    @Column(name = "location_name")
    private String locationName;

    // 여러 장소(별도 테이블)
    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "diary_entry_locations",
            joinColumns = @JoinColumn(name = "entry_id"))
    @Column(name = "location", length = 100)
    private List<String> locations = new ArrayList<>();

    // 장소 좌표 메타(지도에서 콕 찍기). locations(이름)와 병렬 저장, name으로 매칭.
    // 좌표 없던 기존 데이터는 비어 있고, 그 경우 지도는 이름으로 지오코딩(하위호환).
    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "diary_entry_location_points",
            joinColumns = @JoinColumn(name = "entry_id"))
    private List<LocationPoint> locationPoints = new ArrayList<>();

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "editable_after")
    private LocalDateTime editableAfter;

    @Builder
    public DiaryEntry(DiaryDay day, User author, Integer rating, String mood, String locationName) {
        this.day = day;
        this.author = author;
        this.rating = rating;
        this.mood = mood;
        this.locationName = locationName;
    }

    /** 여러 장소를 설정하며 locationName(첫 장소)도 미러링한다. null=변경 안 함, 빈 리스트=전체 삭제. */
    public void applyLocations(List<String> newLocations) {
        if (newLocations == null) return;
        List<String> cleaned = new ArrayList<>();
        for (String s : newLocations) {
            if (s != null && !s.isBlank()) cleaned.add(s.trim());
        }
        this.locations.clear();
        this.locations.addAll(cleaned);
        this.locationName = cleaned.isEmpty() ? null : cleaned.get(0);
    }

    /**
     * 장소 좌표 메타를 통째로 교체한다. name이 비었거나 lat/lng가 모두 없으면 스킵.
     * null=변경 안 함, 빈 리스트=전체 삭제. locations(이름)와 독립적으로 갱신되며,
     * 이름은 여전히 applyLocations가 소스다(하위호환).
     */
    public void applyLocationPoints(List<LocationPoint> newPoints) {
        if (newPoints == null) return;
        this.locationPoints.clear();
        for (LocationPoint p : newPoints) {
            if (p == null || p.getName() == null || p.getName().isBlank()) continue;
            if (p.getLat() == null || p.getLng() == null) continue;
            this.locationPoints.add(
                    new LocationPoint(p.getName().trim(), p.getLat(), p.getLng(), p.getCategory()));
        }
    }

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
