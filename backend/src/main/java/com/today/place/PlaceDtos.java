package com.today.place;

import java.util.List;

/** 장소 검색(카카오 로컬 키워드) 응답 DTO. */
public final class PlaceDtos {

    /** 앱에 내려줄 간소화된 장소 결과. */
    public record PlaceResult(String name, String address, String category) {}

    public record PlacesResponse(List<PlaceResult> places) {}

    private PlaceDtos() {}
}
