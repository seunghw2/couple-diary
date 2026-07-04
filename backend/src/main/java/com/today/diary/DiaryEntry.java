package com.today.diary;

import com.today.user.User;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

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

    @Column(name = "location_name")
    private String locationName;

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

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
