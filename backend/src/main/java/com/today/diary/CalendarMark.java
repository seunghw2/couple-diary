package com.today.diary;

import com.today.couple.Couple;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;

/** 커플별 캘린더 마커(기념일 등). (couple, date) 유니크. */
@Entity
@Getter
@Setter
@Table(name = "calendar_marks",
        uniqueConstraints = @UniqueConstraint(name = "uk_calendar_mark_couple_date",
                columnNames = {"couple_id", "date"}))
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CalendarMark {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "couple_id", nullable = false)
    private Couple couple;

    @Column(name = "date", nullable = false)
    private LocalDate date;

    @Column(name = "label", length = 100)
    private String label;

    @Builder
    public CalendarMark(Couple couple, LocalDate date, String label) {
        this.couple = couple;
        this.date = date;
        this.label = label;
    }
}
