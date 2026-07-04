package com.today.diary;

import com.today.couple.Couple;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

/**
 * DiaryDay 첫 생성을 별도 트랜잭션(REQUIRES_NEW)으로 수행한다.
 * 같은 트랜잭션 안에서 uk_day_couple_date 위반이 발생하면 해당 트랜잭션이
 * rollback-only로 마킹되어 복구가 불가능하므로, 생성 시도를 분리해
 * 호출자가 DataIntegrityViolationException을 잡고 재조회할 수 있게 한다.
 */
@Component
@RequiredArgsConstructor
public class DiaryDayFactory {

    private final DiaryDayRepository dayRepository;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Long create(Couple couple, LocalDate date, DiaryMode mode,
                       String templateType, List<Long> questionIds) {
        DiaryDay day = DiaryDay.builder()
                .couple(couple)
                .date(date)
                .mode(mode)
                .templateType(templateType)
                .questionIds(questionIds)
                .build();
        return dayRepository.saveAndFlush(day).getId();
    }
}
