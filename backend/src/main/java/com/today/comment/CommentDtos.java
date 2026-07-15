package com.today.comment;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class CommentDtos {

    public record CreateCommentRequest(
            @NotBlank @Size(max = 1000, message = "댓글은 1000자까지 쓸 수 있어요.") String text) {}
}
