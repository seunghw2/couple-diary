package com.today.diary;

import com.today.couple.Couple;
import com.today.couple.CoupleService;
import com.today.diary.CalendarMarkDtos.CalendarMarkView;
import com.today.diary.CalendarMarkDtos.CalendarMarksResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
public class CalendarMarkService {

    private final CoupleService coupleService;
    private final CalendarMarkRepository calendarMarkRepository;

    /** 내 커플의 전체 캘린더 마커. */
    @Transactional(readOnly = true)
    public CalendarMarksResponse marks(Long userId) {
        Couple couple = coupleService.requireCouple(userId);
        List<CalendarMarkView> marks = calendarMarkRepository.findByCouple_Id(couple.getId()).stream()
                .map(m -> new CalendarMarkView(m.getDate().toString(), m.getLabel()))
                .toList();
        return new CalendarMarksResponse(marks);
    }

    /** 마커 upsert: 같은 커플+날짜가 있으면 label 갱신, 없으면 생성. */
    @Transactional
    public void upsert(Long userId, LocalDate date, String label) {
        Couple couple = coupleService.requireCouple(userId);
        String cleanLabel = (label == null || label.isBlank()) ? null : label.trim();
        CalendarMark existing = calendarMarkRepository
                .findByCouple_IdAndDate(couple.getId(), date).orElse(null);
        if (existing != null) {
            existing.setLabel(cleanLabel);
        } else {
            calendarMarkRepository.save(CalendarMark.builder()
                    .couple(couple).date(date).label(cleanLabel).build());
        }
    }

    /** 마커 삭제(idempotent). */
    @Transactional
    public void delete(Long userId, LocalDate date) {
        Couple couple = coupleService.requireCouple(userId);
        calendarMarkRepository.deleteByCouple_IdAndDate(couple.getId(), date);
    }
}
