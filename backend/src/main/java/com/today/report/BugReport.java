package com.today.report;

import com.today.user.User;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Getter
@Table(name = "bug_reports")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class BugReport {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "reporter_id", nullable = false)
    private User reporter;

    /** "어떤 기능이 안되나요?" (버그). wishText와 둘 중 하나 이상 필수. */
    @Column(name = "bug_text", columnDefinition = "TEXT")
    private String bugText;

    /** "어떤 기능이 있으면 좋겠나요?" (기능 제안). */
    @Column(name = "wish_text", columnDefinition = "TEXT")
    private String wishText;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Builder
    public BugReport(User reporter, String bugText, String wishText) {
        this.reporter = reporter;
        this.bugText = bugText;
        this.wishText = wishText;
    }

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
