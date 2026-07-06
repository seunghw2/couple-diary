package com.today.question.admin;

import java.util.List;

/**
 * 배치 질문 생성기(문서 25 §5). LLM 실호출은 아직 비활성 —
 * 현재 구현은 {@link DisabledQuestionGenerator}로, 호출 시 미설정임을 알린다.
 */
public interface QuestionGenerator {

    /** 생성기 활성 여부. 비활성이면 실제 LLM 호출 없이 생성이 이뤄지지 않는다. */
    boolean isEnabled();

    /** 요청 조건(theme/tone/개수)으로 후보 질문 생성. 비활성이면 예외. */
    List<GeneratedQuestion> generate(GenerateRequest req);

    /** 생성 요청. */
    record GenerateRequest(String theme, String tone, int count) {}

    /** 생성 결과 한 건(자동 필터 전 원문). */
    record GeneratedQuestion(String text, String theme, String tone, int depth, String contextTrigger) {}
}
