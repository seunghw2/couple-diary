package com.today.question;

import com.today.couple.Couple;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/** 커플이 특정 풀 질문을 '별로예요' 신고. (question, couple) 유니크 — 커플당 1회. */
@Entity
@Getter
@Setter
@Table(name = "question_reports",
        uniqueConstraints = @UniqueConstraint(name = "uk_question_report_question_couple",
                columnNames = {"question_id", "couple_id"}))
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class QuestionReport {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "question_id", nullable = false)
    private QuestionPool question;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "couple_id", nullable = false)
    private Couple couple;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Builder
    public QuestionReport(QuestionPool question, Couple couple) {
        this.question = question;
        this.couple = couple;
    }

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
