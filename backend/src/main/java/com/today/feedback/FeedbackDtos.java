package com.today.feedback;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class FeedbackDtos {

    public record CreateFeedbackRequest(
            @NotBlank(message = "의견 내용을 입력해 주세요.")
            @Size(max = 2000, message = "의견은 2000자까지 쓸 수 있어요.")
            String content,

            @Size(max = 40, message = "출처 값이 너무 길어요.")
            String source
    ) {}
}
