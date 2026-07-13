package com.today.push;

import com.today.user.User;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * 기기별 Expo 푸시 토큰. 한 유저가 여러 기기를 쓸 수 있어 유저:토큰 = 1:N.
 * 토큰은 기기 고유값이라 unique — 로그인 유저가 바뀌면 소유자만 갱신.
 */
@Entity
@Getter
@Setter
@Table(name = "push_tokens",
        uniqueConstraints = @UniqueConstraint(name = "uk_push_token", columnNames = "token"),
        indexes = @Index(name = "idx_push_user", columnList = "user_id"))
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PushToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** Expo 푸시 토큰(ExponentPushToken[...]). */
    @Column(nullable = false, length = 200)
    private String token;

    /** ios | android (참고용). */
    @Column(length = 20)
    private String platform;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Builder
    public PushToken(User user, String token, String platform) {
        this.user = user;
        this.token = token;
        this.platform = platform;
    }

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
