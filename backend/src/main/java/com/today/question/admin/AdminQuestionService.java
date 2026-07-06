package com.today.question.admin;

import com.today.question.QuestionPool;
import com.today.question.QuestionPoolRepository;
import com.today.question.admin.AdminQuestionDtos.GenerateResponse;
import com.today.question.admin.QuestionGenerator.GeneratedQuestion;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * 관리자 배치 생성 로직(문서 25 §5). 생성기가 활성일 때만 생성→필터→저장.
 * 현재 기본 생성기는 비활성이라 실제 저장은 없다.
 */
@Service
@RequiredArgsConstructor
public class AdminQuestionService {

    private final QuestionGenerator generator;
    private final QuestionFilter filter;
    private final QuestionPoolRepository poolRepository;

    @Transactional
    public GenerateResponse generate(String theme, String tone, int count) {
        if (!generator.isEnabled()) {
            return new GenerateResponse(false,
                    "질문 생성기가 비활성 상태입니다(LLM 미설정). 저장된 질문이 없습니다.",
                    0, 0, List.of());
        }

        List<GeneratedQuestion> raw =
                generator.generate(new QuestionGenerator.GenerateRequest(theme, tone, count));

        Set<String> existing = new HashSet<>();
        for (QuestionPool p : poolRepository.findAll()) {
            existing.add(p.getText());
        }

        List<GeneratedQuestion> accepted = filter.filter(raw, existing);

        List<String> savedTexts = new ArrayList<>();
        for (GeneratedQuestion q : accepted) {
            poolRepository.save(QuestionPool.builder()
                    .text(q.text())
                    .theme(q.theme())
                    .tone(q.tone())
                    .depth(q.depth())
                    .contextTrigger(q.contextTrigger())
                    .isTemplate(q.contextTrigger() != null)
                    .active(true)
                    .source("ai")
                    .build());
            savedTexts.add(q.text());
        }

        return new GenerateResponse(true,
                "생성 " + raw.size() + "건 중 " + accepted.size() + "건 저장.",
                raw.size(), accepted.size(), savedTexts);
    }
}
