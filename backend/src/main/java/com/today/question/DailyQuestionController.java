package com.today.question;

import com.today.common.SecurityUtil;
import com.today.question.DailyQuestionDtos.ArchiveDetailResponse;
import com.today.question.DailyQuestionDtos.ArchiveResponse;
import com.today.question.DailyQuestionDtos.AnswerRequest;
import com.today.question.DailyQuestionDtos.ChooseRequest;
import com.today.question.DailyQuestionDtos.SettingsRequest;
import com.today.question.DailyQuestionDtos.SettingsResponse;
import com.today.question.DailyQuestionDtos.TodayResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

/**
 * 오늘의 질문(Daily Question) API.
 * (별개 '20문답' 기능이 {@code /api/questions}를 쓰고 있어 하위 경로 {@code /api/questions/daily}로 분리.)
 */
@RestController
@RequestMapping("/api/questions/daily")
@RequiredArgsConstructor
public class DailyQuestionController {

    private final QuestionService questionService;

    /** 오늘 상태(도착 전/선택 필요/답 필요/대기/오픈). */
    @GetMapping("/today")
    public TodayResponse today() {
        return questionService.today(SecurityUtil.currentUserId());
    }

    /** 후보 2개 중 하나 선택. */
    @PostMapping("/today/choose")
    public TodayResponse choose(@Valid @RequestBody ChooseRequest req) {
        return questionService.choose(SecurityUtil.currentUserId(), req.questionId());
    }

    /** 내 답 작성 후 즉시 봉인. */
    @PostMapping("/today/answer")
    public TodayResponse answer(@Valid @RequestBody AnswerRequest req) {
        return questionService.answer(SecurityUtil.currentUserId(), req.text());
    }

    /** 상대 답에 하트 토글. */
    @PostMapping("/answers/{answerId}/react")
    public ResponseEntity<Void> react(@PathVariable Long answerId) {
        questionService.react(SecurityUtil.currentUserId(), answerId);
        return ResponseEntity.noContent().build();
    }

    /** 오늘의 질문 '별로예요' 신고(내 커플로 1회). 서로 다른 커플 3팀 이상이면 자동 비활성. */
    @PostMapping("/{questionId}/report")
    public ResponseEntity<Void> report(@PathVariable Long questionId) {
        questionService.report(SecurityUtil.currentUserId(), questionId);
        return ResponseEntity.noContent().build();
    }

    /** 과거 오픈된 편지 목록(날짜 내림차순, 커서 페이지네이션). */
    @GetMapping("/archive")
    public ArchiveResponse archive(
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "20") int limit) {
        return questionService.archive(SecurityUtil.currentUserId(), cursor, limit);
    }

    /** 특정 날짜의 편지 상세. */
    @GetMapping("/archive/{date}")
    public ArchiveDetailResponse archiveDetail(
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return questionService.archiveDetail(SecurityUtil.currentUserId(), date);
    }

    /** 오늘의 질문 설정 조회. */
    @GetMapping("/settings")
    public SettingsResponse settings() {
        return questionService.getSettings(SecurityUtil.currentUserId());
    }

    /** 오늘의 질문 설정 변경. */
    @PutMapping("/settings")
    public SettingsResponse updateSettings(@Valid @RequestBody SettingsRequest req) {
        return questionService.updateSettings(SecurityUtil.currentUserId(),
                req.notifyOn(), req.arrivalTime(), req.showStreak(), req.milestoneOn());
    }
}
