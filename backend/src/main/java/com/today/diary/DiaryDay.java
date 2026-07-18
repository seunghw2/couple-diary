package com.today.diary;

import com.today.couple.Couple;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Getter
@Setter
@Table(name = "diary_days",
        uniqueConstraints = @UniqueConstraint(name = "uk_day_couple_date", columnNames = {"couple_id", "date"}))
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class DiaryDay {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "couple_id", nullable = false)
    private Couple couple;

    @Column(nullable = false)
    private LocalDate date;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private DiaryMode mode;

    @Column(name = "template_type")
    private String templateType;

    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "diary_day_question_ids", joinColumns = @JoinColumn(name = "day_id"))
    @Column(name = "question_id")
    private List<Long> questionIds = new ArrayList<>();

    // 그날의 대표 사진(커플 공유, bare 상대경로). 지도 목록·장소 상세 썸네일에 사용.
    // 둘 중 누구든 지정 가능. 없으면 첫 사진으로 폴백.
    @Column(name = "rep_photo_url", length = 500)
    private String repPhotoUrl;

    // 커플이 함께 다녀온 장소 — 두 사람이 공유하는 하나의 목록(작성자 구분 없음).
    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "diary_day_places", joinColumns = @JoinColumn(name = "day_id"))
    private List<LocationPoint> places = new ArrayList<>();

    /** 공유 장소 목록을 요청 순서대로 교체(이름 기준 중복 제거). null=변경 안 함. */
    public void applyPlaces(List<LocationPoint> requested) {
        if (requested == null) return;
        List<LocationPoint> next = new ArrayList<>();
        java.util.Set<String> seen = new java.util.HashSet<>();
        for (LocationPoint p : requested) {
            if (p == null || p.getName() == null || p.getName().isBlank()) continue;
            String nm = p.getName().trim();
            if (!seen.add(nm)) continue;
            next.add(new LocationPoint(nm, p.getLat(), p.getLng(), p.getCategory()));
        }
        this.places.clear();
        this.places.addAll(next);
    }

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Builder
    public DiaryDay(Couple couple, LocalDate date, DiaryMode mode, String templateType, List<Long> questionIds) {
        this.couple = couple;
        this.date = date;
        this.mode = mode;
        this.templateType = templateType;
        this.questionIds = questionIds == null ? new ArrayList<>() : new ArrayList<>(questionIds);
    }

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
