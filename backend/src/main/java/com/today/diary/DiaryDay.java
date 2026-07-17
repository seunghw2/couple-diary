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
