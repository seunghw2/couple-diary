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

    /** 주제(테마). 예: 오늘/일상, 취향/선호, 추억, 마음, 미래 등. */
    @Column(name = "theme", length = 60)
    private String theme;

    /** 톤: deep|light|fun|context. */
    @Column(name = "tone", length = 10)
    private String tone;

    /** 질문 깊이 1(가벼움)~3(깊음). */
    @Column(name = "depth", nullable = false)
    private int depth;

    /** 맥락 트리거: anniversary|birthday|season|streak|firstletter|comeback. 템플릿 질문에만. */
    @Column(name = "context_trigger", length = 20)
    private String contextTrigger;

    /** placeholder({N},{상대})를 포함한 맥락 템플릿 질문 여부. */
    @Column(name = "is_template", nullable = false)
    private boolean isTemplate = false;

    /** 배정 누적 횟수. */
    @Column(name = "used_count", nullable = false)
    private int usedCount = 0;

    /** 서로 다른 커플의 '별로예요' 신고 수. */
    @Column(name = "reported_count", nullable = false)
    private int reportedCount = 0;

    @Column(name = "active", nullable = false)
    private boolean active = true;

    @Column(name = "source", length = 20, nullable = false)
    private String source = "seed";

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Builder
    public QuestionPool(String text, String category, String theme, String tone, int depth,
                        String contextTrigger, Boolean isTemplate, Integer usedCount,
                        Integer reportedCount, Boolean active, String source) {
        this.text = text;
        this.category = category;
        this.theme = theme;
        this.tone = tone;
        this.depth = depth < 1 ? 1 : depth;
        this.contextTrigger = contextTrigger;
        this.isTemplate = isTemplate != null && isTemplate;
        this.usedCount = usedCount == null ? 0 : usedCount;
        this.reportedCount = reportedCount == null ? 0 : reportedCount;
        this.active = active == null || active;
        this.source = source == null ? "seed" : source;
    }

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
