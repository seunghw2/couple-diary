package com.today.diary;

import com.today.comment.CommentDtos.CreateCommentRequest;
import com.today.common.SecurityUtil;
import com.today.diary.DiaryDtos.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/entries")
@RequiredArgsConstructor
public class DiaryController {

    private final DiaryService diaryService;

    @GetMapping
    public List<MonthEntrySummary> month(@RequestParam int year, @RequestParam int month) {
        return diaryService.month(SecurityUtil.currentUserId(), year, month);
    }

    @GetMapping("/{date}")
    public DayDetail detail(@PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return diaryService.detail(SecurityUtil.currentUserId(), date);
    }

    @PostMapping("/{date}")
    public DayDetail upsert(@PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
                            @Valid @RequestBody UpsertEntryRequest req) {
        return diaryService.upsert(SecurityUtil.currentUserId(), date, req);
    }

    @DeleteMapping("/{date}")
    @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
    public void delete(@PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        diaryService.deleteEntry(SecurityUtil.currentUserId(), date);
    }

    /** 상세 화면에서 공유 사진만 추가/삭제(일기 수정창과 무관). photoUrls = 유지할 전체 목록. */
    @PutMapping("/{date}/photos")
    public DayDetail updatePhotos(@PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
                                  @Valid @RequestBody UpdatePhotosRequest req) {
        return diaryService.updateDayPhotos(SecurityUtil.currentUserId(), date, req.photoUrls());
    }

    @PutMapping("/{date}/move")
    public DayDetail move(@PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
                          @Valid @RequestBody MoveDayRequest req) {
        return diaryService.moveDay(SecurityUtil.currentUserId(), date, req.targetDate());
    }

    @GetMapping("/{date}/comments")
    public List<CommentView> comments(@PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return diaryService.comments(SecurityUtil.currentUserId(), date);
    }

    @PostMapping("/{date}/comments")
    public CommentView addComment(@PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
                                  @Valid @RequestBody CreateCommentRequest req) {
        return diaryService.addComment(SecurityUtil.currentUserId(), date, req);
    }
}
