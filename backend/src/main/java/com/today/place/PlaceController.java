package com.today.place;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 장소 키워드 검색(카카오 로컬 프록시). 일기 작성 시 다녀온 곳 검색에 사용. */
@RestController
@RequestMapping("/api/places")
@RequiredArgsConstructor
public class PlaceController {

    private final PlaceService placeService;

    @GetMapping
    public PlaceDtos.PlacesResponse search(
            @RequestParam String query,
            @RequestParam(defaultValue = "12") int size) {
        return new PlaceDtos.PlacesResponse(placeService.search(query, size));
    }
}
