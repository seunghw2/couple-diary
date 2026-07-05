package com.today.diary;

import com.today.common.SecurityUtil;
import com.today.diary.CalendarMarkDtos.CalendarMarkRequest;
import com.today.diary.CalendarMarkDtos.CalendarMarksResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/calendar-marks")
@RequiredArgsConstructor
public class CalendarMarkController {

    private final CalendarMarkService calendarMarkService;

    /** 내 커플의 전체 캘린더 마커. */
    @GetMapping
    public CalendarMarksResponse marks() {
        return calendarMarkService.marks(SecurityUtil.currentUserId());
    }

    /** 마커 upsert. date 필수, label 선택. */
    @PostMapping
    public void upsert(@Valid @RequestBody CalendarMarkRequest req) {
        calendarMarkService.upsert(SecurityUtil.currentUserId(), req.date(), req.label());
    }

    /** 마커 삭제(idempotent). */
    @DeleteMapping("/{date}")
    public void delete(@PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        calendarMarkService.delete(SecurityUtil.currentUserId(), date);
    }
}
