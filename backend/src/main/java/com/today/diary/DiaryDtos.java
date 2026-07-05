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
            List<@Valid LocationPointInput> locationPoints,
            @NotNull @Min(1) @Max(5) Integer rating,
            @NotBlank @Size(max = 100) String mood
    ) {}

    /** 지도에서 찍은 장소의 좌표 메타(선택). name은 locations와 매칭용. */
    public record LocationPointInput(
            @NotBlank @Size(max = 100) String name,
            Double lat,
            Double lng,
            @Size(max = 60) String category
    ) {}

    // ---- 상세 ----
    public record AnswerView(Long questionId, String promptKey, String text) {}

    /** 지도 재현용 장소 좌표 메타. */
    public record LocationPointView(String name, Double lat, Double lng, String category) {}

    public record PhotoView(Long id, String colorSeed, String url) {}

    public record EntryView(
            Long id,
            Long authorId,
            Integer rating,
            String mood,
            String locationName,
            List<String> locations,
            List<LocationPointView> locationPoints,
            List<AnswerView> answers,
            List<PhotoView> photos,
            LocalDateTime createdAt,
            LocalDateTime editableAfter,
            boolean editable
    ) {}

    public record LockedEntryView(boolean locked) {}

    // ---- 날짜 이동 ----
    public record MoveDayRequest(
            @NotNull java.time.LocalDate targetDate
    ) {}

    // ---- 이전 장소 추천 / 지도 ----
    // locations: 이름만(작성화면 추천용, 하위호환). counts: 장소별 방문 일수(지도 핀 뱃지용).
    public record LocationsResponse(List<String> locations, List<LocationCount> counts) {}

    /** name=장소명, count=그 장소에 다녀온 날짜 수(방문 횟수). */
    public record LocationCount(String name, long count) {}

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
