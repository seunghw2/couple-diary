package com.today.config;

import com.today.question.Question;
import com.today.question.QuestionRepository;
import com.today.question.QuestionType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.List;

@Slf4j
@Order(1)
@Component
@RequiredArgsConstructor
public class QuestionSeeder implements CommandLineRunner {

    private final QuestionRepository questionRepository;

    @Override
    public void run(String... args) {
        if (questionRepository.count() > 0) return;

        List<Question> seed = List.of(
                Question.builder().orderNo(1).text("기억에 남는 장면 2~3가지").type(QuestionType.NORMAL).build(),
                Question.builder().orderNo(2).text("오늘 내가 느낀 감정 한 줄").type(QuestionType.NORMAL).build(),
                Question.builder().orderNo(3).text("오늘 우리가 잘 맞았던 순간").type(QuestionType.NORMAL).build(),
                Question.builder().orderNo(4).text("한 줄 요약 — 오늘은 \"___\"한 하루였다").type(QuestionType.INLINE_BLANK).build(),
                Question.builder().orderNo(5).text("고마웠던 순간").type(QuestionType.NORMAL).build(),
                Question.builder().orderNo(6).text("상대가 오늘 귀여웠던 순간").type(QuestionType.NORMAL).build(),
                Question.builder().orderNo(7).text("오늘 살짝 아쉬웠던 것").type(QuestionType.NORMAL).build(),
                Question.builder().orderNo(8).text("다음에 우리 같이 하고 싶은 것").type(QuestionType.NORMAL).build()
        );
        questionRepository.saveAll(seed);
        log.info("Seeded {} default questions", seed.size());
    }
}
