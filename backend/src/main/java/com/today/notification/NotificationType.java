package com.today.notification;

public enum NotificationType {
    PARTNER_WROTE,   // 상대가 작성 = 네 차례
    ENTRY_OPENED,    // 일기 공개(둘 다 작성 완료)
    COMMENT,         // 댓글
    POKE,            // 콕 찌르기
    ANNIVERSARY,     // 기념일 D-day
    COUPLE_CONNECTED // 커플 연결됨(코드 주인에게)
}
