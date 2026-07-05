package com.today.diary;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 일기 장소의 좌표 메타데이터(지도에서 콕 찍기 기능).
 *
 * <p>기존 {@code List<String> locations}(이름만, 하위호환)와 <b>병렬</b>로 저장되는
 * 별도 컬렉션이다. 이름은 그대로 locations가 소스이고, 여기엔 그 장소의
 * lat/lng/category(모두 nullable)를 담아 지도 재현/거리계산에 쓴다.
 * name으로 locations와 매칭한다. 좌표가 없던 기존 데이터는 이 컬렉션이 비어 있고,
 * 그 경우 지도는 기존처럼 이름으로 지오코딩한다.
 */
@Embeddable
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class LocationPoint {

    @Column(name = "name", length = 100)
    private String name;

    @Column(name = "lat")
    private Double lat;

    @Column(name = "lng")
    private Double lng;

    @Column(name = "category", length = 60)
    private String category;

    public LocationPoint(String name, Double lat, Double lng, String category) {
        this.name = name;
        this.lat = lat;
        this.lng = lng;
        this.category = category;
    }
}
