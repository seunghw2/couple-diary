package com.today.question.admin;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

import java.util.List;

/** 관리자 배치 생성 API 계약. */
public class AdminQuestionDtos {

    /** 생성 요청. theme/tone은 힌트(생성기가 참고), count는 목표 개수. */
    public record GenerateRequest(
            String theme,
            String tone,
            @Min(1) @Max(100) int count
    ) {}

    /**
     * 생성 결과. generatorEnabled=false면 실제 생성/저장 없이 그 사실만 알린다.
     * generated=생성 원문 수, accepted=필터 통과·저장 수.
     */
    public record GenerateResponse(
            boolean generatorEnabled,
            String message,
            int generated,
            int accepted,
            List<String> savedTexts
    ) {}
}
