package com.today.question;

public class QuestionDtos {

    public record QuestionResponse(Long id, Integer orderNo, String text, QuestionType type) {
        public static QuestionResponse of(Question q) {
            return new QuestionResponse(q.getId(), q.getOrderNo(), q.getText(), q.getType());
        }
    }
}
