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
 * winnerId/stages는 정적 카탈로그(WorldcupCatalog)의 아이템 id를 가리킨다.
 * stages는 라운드별 탈락 아이템을 통째로 저장한 전체 여정(우승~32강).
 * 형식: "stage:idCsv" 그룹을 ';'로 연결. 예 "1:5;2:12;4:3,9;8:1,4,7,20;16:...;32:...".
 * (stage = 그 라운드에서 탈락한 사이즈. 1=우승, 2=결승, 4=4강, 8=8강, 16, 32)
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

    /** 라운드별 탈락 아이템 전체(우승~32강). "stage:idCsv;..." 형식. */
    @Column(name = "stages", nullable = false, length = 1000)
    private String stages;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Builder
    public WorldcupResult(User author, Couple couple, String worldcupKey, int winnerId, String stages) {
        this.author = author;
        this.couple = couple;
        this.worldcupKey = worldcupKey;
        this.winnerId = winnerId;
        this.stages = stages;
    }

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
