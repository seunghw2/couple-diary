package com.today.notification;

public enum NotificationType {
    PARTNER_WROTE,   // 상대가 작성 = 네 차례
    ENTRY_OPENED,    // 일기 공개(둘 다 작성 완료)
    COMMENT,         // 댓글
    POKE,            // 콕 찌르기
    ANNIVERSARY,     // 기념일 D-day
    COUPLE_CONNECTED, // 커플 연결됨(코드 주인에게)
    QUESTION_ARRIVED, // 오늘의 질문 두 통 도착(도착시간)
    QUESTION_CHOSEN,  // 상대가 오늘 질문을 골랐어요
    QUESTION_ANSWERED,// 상대가 답장했어요(내 차례)
    QUESTION_OPENED,  // 둘 다 답해 편지가 열렸어요
    QUESTION_MISSED,  // 어제 편지가 지나갔어요(자정 마감)
    QUESTION_COMMENT, // 오늘의 편지에 댓글
    WORLDCUP_COMPLETED, // 상대가 월드컵을 완주했어요
    WORLDCUP_COMPARABLE, // 둘 다 완주 → 이제 결과 비교 가능
    SAJU_BIRTHDAY_REQUEST, // 상대가 궁합을 보려고 생일 입력을 요청함
    SAJU_COMPATIBILITY_READY // 상대가 생일을 채워 이제 궁합을 볼 수 있음
}
