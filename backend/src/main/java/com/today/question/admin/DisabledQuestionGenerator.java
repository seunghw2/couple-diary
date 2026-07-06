package com.today.question.admin;

import com.today.common.ApiException;
import com.today.common.ErrorCode;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * 기본 생성기: LLM 미설정 상태. {@link #generate}는 호출 시 명확한 메시지와 함께 예외.
 * (실 LLM 연동 시 이 빈을 대체하는 구현을 추가한다.)
 */
@Component
public class DisabledQuestionGenerator implements QuestionGenerator {

    @Override
    public boolean isEnabled() {
        return false;
    }

    @Override
    public List<GeneratedQuestion> generate(GenerateRequest req) {
        throw new ApiException(ErrorCode.INVALID_INPUT,
                "질문 생성기가 비활성 상태입니다(LLM 미설정). 시드/수동 등록만 가능합니다.");
    }
}
