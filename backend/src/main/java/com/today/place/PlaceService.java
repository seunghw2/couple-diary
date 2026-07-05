package com.today.place;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.List;

/**
 * 카카오 로컬 REST API(키워드 검색) 프록시. REST 키는 서버에서만 보관하고
 * 클라이언트엔 간소화된 결과({name,address,category})만 내려준다.
 */
@Service
public class PlaceService {

    private final RestClient client;

    public PlaceService(@Value("${app.kakao.rest-key}") String restKey) {
        this.client = RestClient.builder()
                .baseUrl("https://dapi.kakao.com")
                .defaultHeader("Authorization", "KakaoAK " + restKey)
                .build();
    }

    public List<PlaceDtos.PlaceResult> search(String query, int size) {
        if (query == null || query.isBlank()) return List.of();
        int limit = Math.min(Math.max(size, 1), 15);
        KakaoKeywordResponse resp;
        try {
            resp = client.get()
                    .uri(uri -> uri.path("/v2/local/search/keyword.json")
                            .queryParam("query", query.trim())
                            .queryParam("size", limit)
                            .build())
                    .retrieve()
                    .body(KakaoKeywordResponse.class);
        } catch (RuntimeException e) {
            // 외부 API 실패는 빈 결과로 처리(작성 흐름을 막지 않음).
            return List.of();
        }
        if (resp == null || resp.documents() == null) return List.of();
        return resp.documents().stream()
                .map(d -> new PlaceDtos.PlaceResult(
                        d.place_name(),
                        (d.road_address_name() != null && !d.road_address_name().isBlank())
                                ? d.road_address_name()
                                : d.address_name(),
                        d.category_group_name()))
                .toList();
    }

    // ---- 카카오 응답 매핑(필요 필드만; 나머지는 무시) ----
    record KakaoKeywordResponse(List<Doc> documents) {}

    record Doc(String place_name, String address_name, String road_address_name, String category_group_name) {}
}
