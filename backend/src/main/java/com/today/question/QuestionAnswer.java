package com.today.question;

import com.today.user.User;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/** 특정 오늘의 질문에 대한 한 유저의 답. sealedAt!=null 이면 봉인(제출) 상태. (daily_question, author) 유니크. */
@Entity
@Getter
@Setter
@Table(name = "question_answers",
        uniqueConstraints = @UniqueConstraint(name = "uk_question_answer_daily_author",
                columnNames = {"daily_question_id", "author_id"}))
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class QuestionAnswer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "daily_question_id", nullable = false)
    private DailyQuestion dailyQuestion;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "author_id", nullable = false)
    private User author;

    @Column(name = "text", length = 2000, nullable = false)
    private String text;

    /** 봉인(제출) 시각. null이면 아직 미봉인. */
    @Column(name = "sealed_at")
    private LocalDateTime sealedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Builder
    public QuestionAnswer(DailyQuestion dailyQuestion, User author, String text, LocalDateTime sealedAt) {
        this.dailyQuestion = dailyQuestion;
        this.author = author;
        this.text = text;
        this.sealedAt = sealedAt;
    }

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
