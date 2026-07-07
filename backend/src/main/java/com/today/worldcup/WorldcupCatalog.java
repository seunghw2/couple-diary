package com.today.worldcup;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 월드컵 정적 카탈로그. 아이템은 코드에 고정(MVP). id는 카탈로그 내 1..N 고정값이라
 * 결과 저장(winnerId/top4)에 그대로 쓸 수 있다. 아이템 추가는 목록 끝에만(기존 id 유지).
 */
public final class WorldcupCatalog {

    private WorldcupCatalog() {}

    public record Item(int id, String label, String emoji) {}

    public record Cup(String key, String title, String emoji, List<Item> items) {
        /** 강수(참가 아이템 수). */
        public int size() { return items.size(); }
    }

    private static final Map<String, Cup> CUPS = new LinkedHashMap<>();

    static {
        register("food", "음식 월드컵", "🍔", new String[][]{
                {"치킨", "🍗"}, {"피자", "🍕"}, {"삼겹살", "🥩"}, {"초밥", "🍣"},
                {"마라탕", "🍲"}, {"떡볶이", "🌶️"}, {"냉면", "🍜"}, {"파스타", "🍝"},
                {"라면", "🍜"}, {"김밥", "🍙"}, {"햄버거", "🍔"}, {"곱창", "🍢"},
                {"회", "🐟"}, {"족발", "🐷"}, {"보쌈", "🥬"}, {"국밥", "🍚"},
                {"짜장면", "🍜"}, {"짬뽕", "🌶️"}, {"탕수육", "🍤"}, {"돈까스", "🍖"},
                {"카레", "🍛"}, {"규동", "🍱"}, {"스테이크", "🥩"}, {"샐러드", "🥗"},
                {"쌀국수", "🍜"}, {"팟타이", "🍤"}, {"타코", "🌮"}, {"부리토", "🌯"},
                {"감바스", "🦐"}, {"텐동", "🍤"}, {"우동", "🍥"}, {"만두", "🥟"},
        });
        register("date", "데이트 코스 월드컵", "💑", new String[][]{
                {"영화관", "🎬"}, {"카페", "🍰"}, {"놀이공원", "🎡"}, {"한강 피크닉", "🧺"},
                {"방탈출", "🔑"}, {"전시회", "🖼️"}, {"드라이브", "🚗"}, {"볼링", "🎳"},
                {"노래방", "🎤"}, {"맛집 투어", "🍽️"}, {"캠핑", "⛺"}, {"오락실", "🕹️"},
                {"보드게임 카페", "🎲"}, {"야경 명소", "🌃"}, {"쇼핑", "🛍️"}, {"온천", "♨️"},
        });
    }

    private static void register(String key, String title, String emoji, String[][] rows) {
        List<Item> items = new java.util.ArrayList<>();
        for (int i = 0; i < rows.length; i++) {
            items.add(new Item(i + 1, rows[i][0], rows[i][1]));
        }
        CUPS.put(key, new Cup(key, title, emoji, List.copyOf(items)));
    }

    public static List<Cup> all() {
        return List.copyOf(CUPS.values());
    }

    public static Cup get(String key) {
        return CUPS.get(key);
    }

    public static Item item(String key, int id) {
        Cup cup = CUPS.get(key);
        if (cup == null) return null;
        return cup.items().stream().filter(it -> it.id() == id).findFirst().orElse(null);
    }
}
