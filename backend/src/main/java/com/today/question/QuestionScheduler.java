package com.today.question;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 오늘의 질문 스케줄러(KST). 인앱 알림 기반(Expo Go — 원격 푸시는 EAS 빌드 후속).
 * - 도착시간: 각 커플 설정 시간이 지나면 새 기간 질문 배정 + 도착 알림.
 *   (마감 = 다음날 도착시간. 직전 기간 '지나간 편지' 알림은 새 기간 배정 시 함께 처리.)
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class QuestionScheduler {

    private final QuestionService questionService;

    /**
     * 10분마다 도착시간 체크: 각 커플 arrivalTime이 지났고 새 기간 미배정이면 배정 + 도착 알림.
     * 마감은 '자정'이 아니라 '다음 도착시간'이며, 새 기간 배정 시점에 직전 기간 '지나간 편지' 알림이 함께 나간다.
     */
    @Scheduled(cron = "0 */10 * * * *", zone = "Asia/Seoul")
    public void arrival() {
        try {
            questionService.runArrivalNotifications();
        } catch (Exception e) {
            log.warn("도착 알림 스케줄 실패", e);
        }
    }
}
