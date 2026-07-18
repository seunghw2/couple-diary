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
            @Size(max = 20) List<Long> questionIds,
            @Size(max = 50) List<@Valid AnswerInput> answers,
            @Size(max = 30) List<String> photoSeeds,
            @Size(max = 30) List<@Size(max = 500) String> photoUrls,
            @Size(max = 100) String locationName,
            @Size(max = 30) List<@Size(max = 100) String> locations,
            @Size(max = 30) List<@Valid LocationPointInput> locationPoints,
            @Size(max = 30) List<@Valid LocationPointInput> places, // 커플 공유 다녀온 장소(있으면 이걸 소스로)
            @Size(max = 500) String repPhotoUrl, // 그날 대표 사진(photoUrls 중 하나). 커플 공유.
            @Min(1) @Max(5) Integer rating, // 별점 기능 제거 → 선택(있으면 1~5 검증)
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
    // nicknames: 별명이 있는 장소만(지도/목록에 별명 표시용).
    public record LocationsResponse(List<String> locations, List<LocationCount> counts,
                                    List<PlaceNicknameView> nicknames) {}

    /** name=장소명, count=방문 날짜 수, thumbUrl=대표 사진(서명, 없으면 null), recentDate=가장 최근 방문일. */
    public record LocationCount(String name, long count, String thumbUrl, String recentDate) {}

    /** name=장소명, nickname=커플이 붙인 별명. */
    public record PlaceNicknameView(String name, String nickname) {}

    // ---- 장소 별명 upsert ----
    public record PlaceNicknameRequest(
            @NotBlank @Size(max = 100) String name,
            @Size(max = 100) String nickname
    ) {}

    // ---- 장소 상세(한 장소에 쌓인 기록) ----
    public record PlaceDetailEntry(
            String date,
            String thumbUrl,
            String snippet,
            boolean mineWritten,
            boolean partnerWritten
    ) {}

    public record PlaceDetailResponse(
            String name,
            String nickname,       // null=별명 없음
            int count,             // 이 장소에 다녀온 날짜 수
            List<PlaceDetailEntry> entries
    ) {}

    public record CommentView(Long id, Long authorId, String authorNickname, String text, LocalDateTime createdAt) {}

    public record DayDetail(
            String date,
            DayStatus status,
            DiaryMode mode,
            String templateType,
            List<QuestionResponse> questions,
            EntryView myEntry,
            Object partnerEntry,        // EntryView(OPEN) 또는 LockedEntryView
            List<CommentView> comments,
            String repPhotoUrl,         // 그날 대표 사진(서명, 없으면 null) — 작성 화면 별표 프리필용
            List<LocationPointView> places // 커플 공유 다녀온 장소(항상 노출)
    ) {}
}
