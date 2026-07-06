package com.today.question;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 오늘의 질문 스케줄러(KST). 인앱 알림 기반(Expo Go — 원격 푸시는 EAS 빌드 후속).
 * - 도착시간: 각 커플 설정 시간이 지나면 배정 + 도착 알림.
 * - 자정 마감: 어제 열리지 못한 편지가 있으면 '지나간 편지' 알림.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class QuestionScheduler {

    private final QuestionService questionService;

    /** 10분마다 도착시간 체크(각 커플 arrivalTime 지났고 미배정이면 배정+알림, 중복 방지). */
    @Scheduled(cron = "0 */10 * * * *", zone = "Asia/Seoul")
    public void arrival() {
        try {
            questionService.runArrivalNotifications();
        } catch (Exception e) {
            log.warn("도착 알림 스케줄 실패", e);
        }
    }

    /** 매일 00:05(KST): 어제 미열람 편지에 '지나간 편지' 알림. */
    @Scheduled(cron = "0 5 0 * * *", zone = "Asia/Seoul")
    public void midnight() {
        try {
            questionService.runMissedNotifications();
        } catch (Exception e) {
            log.warn("자정 마감 알림 스케줄 실패", e);
        }
    }
}
