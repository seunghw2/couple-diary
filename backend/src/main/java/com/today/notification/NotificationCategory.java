package com.today.notification;

/** 알림 설정 토글 단위(사용자에게 노출되는 카테고리). */
public enum NotificationCategory {
    DIARY,        // 일기: 상대 작성·공개·댓글
    QUESTION,     // 오늘의 질문(편지)
    POKE,         // 콕 찌르기
    ANNIVERSARY,  // 기념일
    WORLDCUP,     // 월드컵 게임
    SAJU          // 사주 궁합
}
