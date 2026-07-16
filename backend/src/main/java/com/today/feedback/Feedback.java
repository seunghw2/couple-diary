package com.today.feedback;

import com.today.user.User;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/** 사용자 의견(자유 텍스트). 화면 하단 '의견 보내기'로 수집. */
@Entity
@Getter
@Table(name = "feedback")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Feedback {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 2000)
    private String content;

    /** 어느 화면에서 보냈는지(맥락용, 선택). */
    @Column(length = 40)
    private String source;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    @Builder
    public Feedback(User user, String content, String source) {
        this.user = user;
        this.content = content;
        this.source = source;
    }
}
