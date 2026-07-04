package com.today.diary;

import com.today.question.QuestionDtos.QuestionResponse;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDateTime;
import java.util.List;

public class DiaryDtos {

    // ---- 목록(월간) ----
    public record MonthEntrySummary(
            String date,
            DayStatus status,
            int photoCount,
            String thumbSeed,
            boolean mineWritten,
            boolean partnerWritten
    ) {}

    // ---- 작성/수정 요청 ----
    public record AnswerInput(Long questionId, String promptKey, String text) {}

    public record UpsertEntryRequest(
            @NotNull DiaryMode mode,
            String templateType,
            List<Long> questionIds,
            List<AnswerInput> answers,
            List<String> photoSeeds,
            String locationName,
            Integer rating,
            String mood
    ) {}

    // ---- 상세 ----
    public record AnswerView(Long questionId, String promptKey, String text) {}

    public record PhotoView(Long id, String colorSeed) {}

    public record EntryView(
            Long id,
            Long authorId,
            Integer rating,
            String mood,
            String locationName,
            List<AnswerView> answers,
            List<PhotoView> photos,
            LocalDateTime createdAt,
            LocalDateTime editableAfter,
            boolean editable
    ) {}

    public record LockedEntryView(boolean locked) {}

    public record CommentView(Long id, Long authorId, String authorNickname, String text, LocalDateTime createdAt) {}

    public record DayDetail(
            String date,
            DayStatus status,
            DiaryMode mode,
            String templateType,
            List<QuestionResponse> questions,
            EntryView myEntry,
            Object partnerEntry,        // EntryView(OPEN) 또는 LockedEntryView
            List<CommentView> comments
    ) {}
}
