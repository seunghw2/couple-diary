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
