package com.today.diary;

import com.today.question.QuestionDtos.QuestionResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

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
    public record AnswerInput(
            Long questionId,
            String promptKey,
            @Size(max = 2000) String text
    ) {}

    public record UpsertEntryRequest(
            @NotNull DiaryMode mode,
            String templateType,
            List<Long> questionIds,
            List<@Valid AnswerInput> answers,
            List<String> photoSeeds,
            List<@Size(max = 500) String> photoUrls,
            @Size(max = 100) String locationName,
            List<@Size(max = 100) String> locations,
            @NotNull @Min(1) @Max(5) Integer rating,
            @NotBlank @Size(max = 100) String mood
    ) {}

    // ---- 상세 ----
    public record AnswerView(Long questionId, String promptKey, String text) {}

    public record PhotoView(Long id, String colorSeed, String url) {}

    public record EntryView(
            Long id,
            Long authorId,
            Integer rating,
            String mood,
            String locationName,
            List<String> locations,
            List<AnswerView> answers,
            List<PhotoView> photos,
            LocalDateTime createdAt,
            LocalDateTime editableAfter,
            boolean editable
    ) {}

    public record LockedEntryView(boolean locked) {}

    // ---- 이전 장소 추천 ----
    public record LocationsResponse(List<String> locations) {}

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
