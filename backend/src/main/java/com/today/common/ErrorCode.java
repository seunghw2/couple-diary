package com.today.common;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum ErrorCode {

    INVALID_INPUT(HttpStatus.BAD_REQUEST, "C001", "잘못된 입력입니다."),
    UNAUTHORIZED(HttpStatus.UNAUTHORIZED, "C002", "인증이 필요합니다."),
    FORBIDDEN(HttpStatus.FORBIDDEN, "C003", "권한이 없습니다."),
    NOT_FOUND(HttpStatus.NOT_FOUND, "C004", "리소스를 찾을 수 없습니다."),

    USER_NOT_FOUND(HttpStatus.NOT_FOUND, "U001", "존재하지 않는 사용자입니다."),

    INVALID_TOKEN(HttpStatus.UNAUTHORIZED, "T001", "유효하지 않은 토큰입니다."),
    EXPIRED_TOKEN(HttpStatus.UNAUTHORIZED, "T002", "토큰이 만료되었습니다."),

    ALREADY_COUPLED(HttpStatus.CONFLICT, "P001", "이미 커플로 연결되어 있습니다."),
    INVALID_INVITE_CODE(HttpStatus.NOT_FOUND, "P002", "유효하지 않은 초대 코드입니다."),
    CANNOT_CONNECT_SELF(HttpStatus.BAD_REQUEST, "P003", "자신의 초대 코드로는 연결할 수 없습니다."),
    COUPLE_NOT_FOUND(HttpStatus.NOT_FOUND, "P004", "연결된 커플이 없습니다."),
    PARTNER_ALREADY_COUPLED(HttpStatus.CONFLICT, "P005", "상대방이 이미 다른 커플로 연결되어 있습니다."),

    QUESTION_NOT_FOUND(HttpStatus.NOT_FOUND, "Q001", "존재하지 않는 질문입니다."),

    DAY_LOCKED(HttpStatus.FORBIDDEN, "D001", "아직 공개되지 않은 일기입니다."),
    ENTRY_NOT_EDITABLE(HttpStatus.FORBIDDEN, "D002", "수정 가능 시간이 지났습니다."),
    ;

    private final HttpStatus status;
    private final String code;
    private final String message;
}
