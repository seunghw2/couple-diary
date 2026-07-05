package com.today.diary;

import com.today.common.SecurityUtil;
import com.today.diary.DiaryDtos.LocationsResponse;
import com.today.diary.DiaryDtos.PlaceDetailResponse;
import com.today.diary.DiaryDtos.PlaceNicknameRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/locations")
@RequiredArgsConstructor
public class LocationController {

    private final DiaryService diaryService;

    /** 내 커플의 과거 entry들에서 사용된 distinct 장소 목록(최근순, 최대 20) + 별명 목록. */
    @GetMapping
    public LocationsResponse locations() {
        return diaryService.recentLocations(SecurityUtil.currentUserId());
    }

    /** 장소 별명 upsert. nickname이 비면 별명 삭제(clear). */
    @PutMapping("/nickname")
    public void setNickname(@Valid @RequestBody PlaceNicknameRequest req) {
        diaryService.setNickname(SecurityUtil.currentUserId(), req.name(), req.nickname());
    }

    /** 한 장소에 쌓인 기록(날짜별 1항목, 최신순) + 별명. */
    @GetMapping("/detail")
    public PlaceDetailResponse detail(@RequestParam String name) {
        return diaryService.placeDetail(SecurityUtil.currentUserId(), name);
    }
}
