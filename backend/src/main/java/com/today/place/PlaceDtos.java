package com.today.place;

import java.util.List;

/** 장소 검색(카카오 로컬 키워드) 응답 DTO. */
public final class PlaceDtos {

    /**
     * 앱에 내려줄 간소화된 장소 결과.
     * lat/lng는 카카오 로컬 API의 y/x(위도/경도)를 통과시킨 값(없을 수 있음).
     */
    public record PlaceResult(String name, String address, String category, Double lat, Double lng) {}

    public record PlacesResponse(List<PlaceResult> places) {}

    private PlaceDtos() {}
}
