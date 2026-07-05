package com.today.diary;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.List;

public class CalendarMarkDtos {

    /** 마커 upsert 요청. date 필수, label 선택. */
    public record CalendarMarkRequest(
            @NotNull LocalDate date,
            @Size(max = 100) String label
    ) {}

    /** 단일 마커 뷰. */
    public record CalendarMarkView(
            String date,
            String label
    ) {}

    /** 커플의 전체 마커 목록. */
    public record CalendarMarksResponse(
            List<CalendarMarkView> marks
    ) {}
}
