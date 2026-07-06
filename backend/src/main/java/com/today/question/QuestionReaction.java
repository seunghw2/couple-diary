package com.today.question;

import com.today.user.User;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/** 상대 답에 대한 하트. (answer, user) 유니크 — 토글용. */
@Entity
@Getter
@Setter
@Table(name = "question_reactions",
        uniqueConstraints = @UniqueConstraint(name = "uk_question_reaction_answer_user",
                columnNames = {"answer_id", "user_id"}))
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class QuestionReaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "answer_id", nullable = false)
    private QuestionAnswer answer;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Builder
    public QuestionReaction(QuestionAnswer answer, User user) {
        this.answer = answer;
        this.user = user;
    }

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
