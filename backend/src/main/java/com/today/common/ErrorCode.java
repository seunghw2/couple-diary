package com.today.common;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum ErrorCode {

    INVALID_INPUT(HttpStatus.BAD_REQUEST, "C001", "입력한 내용을 다시 확인해 주세요."),
    UNAUTHORIZED(HttpStatus.UNAUTHORIZED, "C002", "로그인이 필요해요."),
    FORBIDDEN(HttpStatus.FORBIDDEN, "C003", "접근 권한이 없어요."),
    NOT_FOUND(HttpStatus.NOT_FOUND, "C004", "요청한 정보를 찾을 수 없어요."),

    USER_NOT_FOUND(HttpStatus.NOT_FOUND, "U001", "사용자를 찾을 수 없어요."),

    INVALID_TOKEN(HttpStatus.UNAUTHORIZED, "T001", "로그인 정보가 올바르지 않아요. 다시 로그인해 주세요."),
    EXPIRED_TOKEN(HttpStatus.UNAUTHORIZED, "T002", "로그인이 만료됐어요. 다시 로그인해 주세요."),

    KAKAO_AUTH_FAILED(HttpStatus.UNAUTHORIZED, "K001", "카카오 로그인에 실패했어요. 잠시 후 다시 시도해 주세요."),

    APPLE_AUTH_FAILED(HttpStatus.UNAUTHORIZED, "A001", "애플 로그인에 실패했어요. 잠시 후 다시 시도해 주세요."),

    ALREADY_COUPLED(HttpStatus.CONFLICT, "P001", "이미 다른 상대와 연결돼 있어요."),
    INVALID_INVITE_CODE(HttpStatus.NOT_FOUND, "P002", "초대 코드를 찾을 수 없어요. 다시 확인해 주세요."),
    CANNOT_CONNECT_SELF(HttpStatus.BAD_REQUEST, "P003", "내 초대 코드로는 연결할 수 없어요."),
    COUPLE_NOT_FOUND(HttpStatus.NOT_FOUND, "P004", "아직 연결된 상대가 없어요."),
    PARTNER_ALREADY_COUPLED(HttpStatus.CONFLICT, "P005", "상대가 이미 다른 사람과 연결돼 있어요."),

    QUESTION_NOT_FOUND(HttpStatus.NOT_FOUND, "Q001", "질문을 찾을 수 없어요."),
    ANSWER_NOT_EDITABLE(HttpStatus.FORBIDDEN, "Q002", "답장은 24시간 이내에만 수정할 수 있어요."),

    DAY_LOCKED(HttpStatus.FORBIDDEN, "D001", "아직 열리지 않은 일기예요."),
    ENTRY_NOT_EDITABLE(HttpStatus.FORBIDDEN, "D002", "작성 후 24시간이 지나 수정할 수 없어요."),
    DAY_ALREADY_EXISTS(HttpStatus.CONFLICT, "D003", "그날에는 이미 일기가 있어요."),
    ;

    private final HttpStatus status;
    private final String code;
    private final String message;
}
