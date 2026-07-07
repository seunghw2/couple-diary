package com.today.worldcup;

import com.today.common.SecurityUtil;
import com.today.worldcup.WorldcupDtos.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** 월드컵 미니게임. 설정 탭에서 진입. */
@RestController
@RequestMapping("/api/worldcups")
@RequiredArgsConstructor
public class WorldcupController {

    private final WorldcupService worldcupService;

    /** 홈 목록(내/상대 완주 여부 포함). */
    @GetMapping
    public List<CupSummary> list() {
        return worldcupService.list(SecurityUtil.currentUserId());
    }

    /** 설정 월드컵 배지용 — 아직 안 본 상대 완주 수. ({key}보다 먼저 매칭되도록 리터럴 경로) */
    @GetMapping("/unseen")
    public UnseenResponse unseen() {
        return new UnseenResponse(worldcupService.unseenCount(SecurityUtil.currentUserId()));
    }

    /** 월드컵 목록 열람 → 배지 초기화. */
    @PostMapping("/seen")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void seen() {
        worldcupService.markSeen(SecurityUtil.currentUserId());
    }

    public record UnseenResponse(long count) {}

    /** 진행용 상세(후보 아이템 포함). */
    @GetMapping("/{key}")
    public CupDetail detail(@PathVariable String key) {
        return worldcupService.detail(SecurityUtil.currentUserId(), key);
    }

    /** 완주 결과 저장. */
    @PostMapping("/{key}/result")
    @ResponseStatus(HttpStatus.CREATED)
    public void result(@PathVariable String key, @Valid @RequestBody ResultRequest req) {
        worldcupService.saveResult(SecurityUtil.currentUserId(), key, req);
    }

    /** 내 기록 + 커플 비교. */
    @GetMapping("/{key}/records")
    public RecordsResponse records(@PathVariable String key) {
        return worldcupService.records(SecurityUtil.currentUserId(), key);
    }
}
