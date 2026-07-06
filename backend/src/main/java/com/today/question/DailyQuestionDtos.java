package com.today.question;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * 오늘의 질문(Daily Question) JSON 계약. 프론트와 정확히 일치해야 한다.
 * (기존 {@link QuestionDtos}는 별개의 '20문답' 기능용이라 분리했다.)
 * null 필드는 Jackson 기본 설정상 노출되나 의미상 무시(예: coupled=false면 나머지는 무의미).
 */
public class DailyQuestionDtos {

    // ===================== 오늘 =====================

    /**
     * state ∈ {"BEFORE_ARRIVAL","NEEDS_CHOICE","NEEDS_ANSWER","WAITING_PARTNER","OPENED"}.
     * coupled=false면 나머지는 무의미.
     */
    public record TodayResponse(
            String date,
            String state,
            String arrivalTime,
            boolean coupled,
            List<Choice> choices,
            QuestionView question,
            Person chosenBy,
            Boolean chosenByMe,
            AnswerView myAnswer,
            AnswerView partnerAnswer,
            Boolean partnerSealed,
            int streak,
            Boolean missedYesterday,
            List<CommentView> comments
    ) {
        /** 커플 미연결 응답. */
        public static TodayResponse notCoupled() {
            return new TodayResponse(null, null, null, false, null, null,
                    null, null, null, null, null, 0, null, null);
        }
    }

    /** 선택 후보. id = QuestionPool id. */
    public record Choice(Long id, String text, int slot) {}

    public record QuestionView(Long id, String text) {}

    public record Person(Long id, String nickname) {}

    /** text: 내 답은 항상, 상대 답은 OPENED에서만 채운다. */
    public record AnswerView(
            Long id,
            String text,
            boolean sealed,
            Boolean reactedByPartner,
            Boolean reactedByMe
    ) {}

    // ===================== 댓글 =====================

    public record CommentView(
            Long id,
            Long authorId,
            String authorNickname,
            String text,
            java.time.LocalDateTime createdAt
    ) {}

    // ===================== 요청 =====================

    public record ChooseRequest(@NotNull Long questionId) {}

    public record AnswerRequest(@NotBlank @Size(max = 2000) String text) {}

    /** date nullable = 오늘(활성 기간). */
    public record CommentRequest(
            java.time.LocalDate date,
            @NotBlank @Size(max = 1000) String text
    ) {}

    // ===================== 아카이브 =====================

    public record ArchiveResponse(
            List<ArchiveItem> items,
            String nextCursor,
            int totalOpened,
            int streak,
            String milestone
    ) {}

    public record ArchiveItem(
            String date,
            String questionText,
            boolean opened,
            String chosenByNickname
    ) {}

    public record ArchiveDetailResponse(
            String date,
            String questionText,
            Person chosenBy,
            boolean opened,
            AnswerView myAnswer,
            AnswerView partnerAnswer,
            String partnerNickname,
            List<CommentView> comments
    ) {}

    // ===================== 설정 =====================

    public record SettingsResponse(
            boolean notifyOn,
            String arrivalTime,
            boolean showStreak,
            boolean milestoneOn
    ) {}

    public record SettingsRequest(
            @NotNull Boolean notifyOn,
            @NotBlank String arrivalTime,
            @NotNull Boolean showStreak,
            @NotNull Boolean milestoneOn
    ) {}
}
