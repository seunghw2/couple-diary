package com.today.diary;

import com.today.common.SecurityUtil;
import com.today.diary.DiaryDtos.LocationsResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/locations")
@RequiredArgsConstructor
public class LocationController {

    private final DiaryService diaryService;

    /** 내 커플의 과거 entry들에서 사용된 distinct 장소 목록(최근순, 최대 20). */
    @GetMapping
    public LocationsResponse locations() {
        return diaryService.recentLocations(SecurityUtil.currentUserId());
    }
}
