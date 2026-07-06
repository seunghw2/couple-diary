package com.today.question;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/** 오늘의 질문 원천 풀. 여기서 매일 커플에게 질문을 배정한다. */
@Entity
@Getter
@Setter
@Table(name = "question_pool")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class QuestionPool {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "text", length = 500, nullable = false)
    private String text;

    @Column(name = "category", length = 60)
    private String category;

    /** 질문 깊이 1(가벼움)~3(깊음). */
    @Column(name = "depth", nullable = false)
    private int depth;

    @Column(name = "active", nullable = false)
    private boolean active = true;

    @Column(name = "source", length = 20, nullable = false)
    private String source = "seed";

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Builder
    public QuestionPool(String text, String category, int depth, Boolean active, String source) {
        this.text = text;
        this.category = category;
        this.depth = depth;
        this.active = active == null || active;
        this.source = source == null ? "seed" : source;
    }

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
