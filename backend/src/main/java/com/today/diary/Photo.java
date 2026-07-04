package com.today.diary;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Getter
@Setter
@Table(name = "photos")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Photo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "entry_id", nullable = false)
    private DiaryEntry entry;

    @Column(name = "color_seed")
    private String colorSeed;

    @Builder
    public Photo(DiaryEntry entry, String colorSeed) {
        this.entry = entry;
        this.colorSeed = colorSeed;
    }
}
