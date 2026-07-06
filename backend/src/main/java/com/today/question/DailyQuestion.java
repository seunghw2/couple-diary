package com.today.question;

import com.today.couple.Couple;
import com.today.user.User;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;

/** 커플에게 하루에 배정된 질문 후보(슬롯 1|2 두 개). 그 중 하나가 chosen 된다. (couple, date, slot) 유니크. */
@Entity
@Getter
@Setter
@Table(name = "daily_questions",
        uniqueConstraints = @UniqueConstraint(name = "uk_daily_question_couple_date_slot",
                columnNames = {"couple_id", "date", "slot"}))
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class DailyQuestion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "couple_id", nullable = false)
    private Couple couple;

    @Column(name = "date", nullable = false)
    private LocalDate date;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "question_id", nullable = false)
    private QuestionPool question;

    /** 맥락 템플릿 질문을 커플별 데이터로 치환한 문장. null이면 question.text 사용. */
    @Column(name = "rendered_text", length = 500)
    private String renderedText;

    /** 후보 슬롯 1|2. */
    @Column(name = "slot", nullable = false)
    private int slot;

    @Column(name = "chosen", nullable = false)
    private boolean chosen = false;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "chosen_by")
    private User chosenBy;

    @Builder
    public DailyQuestion(Couple couple, LocalDate date, QuestionPool question, String renderedText,
                         int slot, Boolean chosen, User chosenBy) {
        this.couple = couple;
        this.date = date;
        this.question = question;
        this.renderedText = renderedText;
        this.slot = slot;
        this.chosen = chosen != null && chosen;
        this.chosenBy = chosenBy;
    }

    /** 커플에게 보여줄 최종 문장(렌더된 게 있으면 그것, 없으면 원문). */
    public String displayText() {
        return renderedText != null ? renderedText : (question == null ? null : question.getText());
    }
}
