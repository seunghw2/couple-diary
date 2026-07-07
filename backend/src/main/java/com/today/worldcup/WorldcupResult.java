package com.today.worldcup;

import com.today.couple.Couple;
import com.today.user.User;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * 월드컵 1회 완주 결과. 유저별로 남고, 커플 비교를 위해 couple도 함께 보관한다.
 * winnerId/top4는 정적 카탈로그(WorldcupCatalog)의 아이템 id를 가리킨다.
 * top4는 4강 진출 아이템 id들을 쉼표로 이어 저장(취향 일치율 계산용).
 */
@Entity
@Getter
@Setter
@Table(name = "worldcup_results",
        indexes = {
                @Index(name = "idx_wc_couple_key", columnList = "couple_id, worldcup_key"),
                @Index(name = "idx_wc_author_key", columnList = "author_id, worldcup_key")
        })
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class WorldcupResult {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "author_id", nullable = false)
    private User author;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "couple_id", nullable = false)
    private Couple couple;

    @Column(name = "worldcup_key", nullable = false)
    private String worldcupKey;

    @Column(name = "winner_id", nullable = false)
    private int winnerId;

    /** 4강 진출 아이템 id들(쉼표 구분). 취향 일치율(겹침) 계산용. */
    @Column(name = "top4", nullable = false)
    private String top4;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Builder
    public WorldcupResult(User author, Couple couple, String worldcupKey, int winnerId, String top4) {
        this.author = author;
        this.couple = couple;
        this.worldcupKey = worldcupKey;
        this.winnerId = winnerId;
        this.top4 = top4;
    }

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
