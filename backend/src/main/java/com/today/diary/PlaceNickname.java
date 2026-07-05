package com.today.diary;

import com.today.couple.Couple;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** 커플별 장소 별명. (couple, name) 유니크. */
@Entity
@Getter
@Setter
@Table(name = "place_nicknames",
        uniqueConstraints = @UniqueConstraint(name = "uk_place_nickname_couple_name",
                columnNames = {"couple_id", "name"}))
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PlaceNickname {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "couple_id", nullable = false)
    private Couple couple;

    @Column(name = "name", nullable = false, length = 100)
    private String name;

    @Column(name = "nickname", nullable = false, length = 100)
    private String nickname;

    @Builder
    public PlaceNickname(Couple couple, String name, String nickname) {
        this.couple = couple;
        this.name = name;
        this.nickname = nickname;
    }
}
