package com.today.question;

import com.today.question.QuestionDtos.QuestionResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/questions")
@RequiredArgsConstructor
public class QuestionController {

    private final QuestionRepository questionRepository;

    @GetMapping
    public List<QuestionResponse> all() {
        return questionRepository.findAllByOrderByOrderNoAsc().stream()
                .map(QuestionResponse::of)
                .toList();
    }
}
