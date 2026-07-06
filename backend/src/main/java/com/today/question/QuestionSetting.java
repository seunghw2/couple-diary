package com.today.question;

import com.today.couple.Couple;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalTime;

/** 커플별 오늘의 질문 설정. (couple) 유니크. */
@Entity
@Getter
@Setter
@Table(name = "question_settings",
        uniqueConstraints = @UniqueConstraint(name = "uk_question_setting_couple",
                columnNames = "couple_id"))
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class QuestionSetting {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "couple_id", nullable = false)
    private Couple couple;

    @Column(name = "notify_on", nullable = false)
    private boolean notifyOn = true;

    /** 질문 도착 시각(KST). */
    @Column(name = "arrival_time", nullable = false)
    private LocalTime arrivalTime = LocalTime.of(8, 0);

    @Column(name = "show_streak", nullable = false)
    private boolean showStreak = true;

    @Column(name = "milestone_on", nullable = false)
    private boolean milestoneOn = false;

    @Builder
    public QuestionSetting(Couple couple, Boolean notifyOn, LocalTime arrivalTime,
                           Boolean showStreak, Boolean milestoneOn) {
        this.couple = couple;
        this.notifyOn = notifyOn == null || notifyOn;
        this.arrivalTime = arrivalTime == null ? LocalTime.of(8, 0) : arrivalTime;
        this.showStreak = showStreak == null || showStreak;
        this.milestoneOn = milestoneOn != null && milestoneOn;
    }
}
