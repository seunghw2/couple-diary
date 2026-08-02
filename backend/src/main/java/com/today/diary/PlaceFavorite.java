package com.today.diary;

import com.today.couple.Couple;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 커플이 즐겨찾기로 고정해 둔 장소. (couple, name) 유니크.
 * 일기 작성 4단계에서 "자주 가는 곳"으로 바로 담을 수 있게 하는 목록이다.
 */
@Entity
@Getter
@Table(name = "place_favorites",
        uniqueConstraints = @UniqueConstraint(name = "uk_place_favorite_couple_name",
                columnNames = {"couple_id", "name"}))
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PlaceFavorite {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "couple_id", nullable = false)
    private Couple couple;

    @Column(name = "name", nullable = false, length = 100)
    private String name;

    @Builder
    public PlaceFavorite(Couple couple, String name) {
        this.couple = couple;
        this.name = name;
    }
}
