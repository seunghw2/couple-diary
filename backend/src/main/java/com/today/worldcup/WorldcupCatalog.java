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
        register("happy", "소확행 월드컵", "😌", new String[][]{
                {"갓 구운 빵", "🥐"}, {"주말 늦잠", "😴"}, {"첫눈", "❄️"}, {"향긋한 커피", "☕"},
                {"새 이불 냄새", "🛏️"}, {"딱 맞는 노래", "🎧"}, {"노을 산책", "🌆"}, {"반신욕", "🛁"},
                {"배달음식", "🛵"}, {"강아지 쓰다듬기", "🐶"}, {"별 보기", "✨"}, {"빗소리", "🌧️"},
                {"시원한 캔맥주", "🍺"}, {"폭신한 낮잠", "💤"}, {"넷플릭스 정주행", "🍿"}, {"갓 세탁한 수건", "🧺"},
        });
        register("power", "초능력 월드컵", "🦸", new String[][]{
                {"순간이동", "🌀"}, {"투명인간", "👻"}, {"시간 정지", "⏱️"}, {"하늘 날기", "🕊️"},
                {"독심술", "🧠"}, {"미래 보기", "🔮"}, {"순간 치유", "💊"}, {"무한 체력", "💪"},
                {"동물과 대화", "🐾"}, {"분신술", "👥"}, {"염력", "🖐️"}, {"자유자재 변신", "🦎"},
                {"날씨 조종", "🌦️"}, {"안 자도 멀쩡", "🌙"}, {"뭐든 소환", "🎁"}, {"행운 폭발", "🍀"},
        });
        register("reborn", "환생 월드컵", "🐣", new String[][]{
                {"고양이", "🐱"}, {"강아지", "🐶"}, {"돌고래", "🐬"}, {"자유로운 새", "🐦"},
                {"큰 나무", "🌳"}, {"구름", "☁️"}, {"판다", "🐼"}, {"용", "🐉"},
                {"바다거북", "🐢"}, {"다시 사람", "👶"}, {"반짝이는 별", "⭐"}, {"유니콘", "🦄"},
                {"공룡", "🦕"}, {"햄스터", "🐹"}, {"범고래", "🐳"}, {"나비", "🦋"},
        });
        register("travel", "버킷리스트 여행지 월드컵", "✈️", new String[][]{
                {"파리", "🗼"}, {"뉴욕", "🗽"}, {"제주", "🌴"}, {"도쿄", "🏯"},
                {"발리", "🏝️"}, {"스위스", "🏔️"}, {"하와이", "🌺"}, {"방콕", "🛺"},
                {"이탈리아", "🍕"}, {"산토리니", "🏛️"}, {"아이슬란드", "🌋"}, {"몰디브", "🏖️"},
                {"런던", "🎡"}, {"오로라 마을", "🌌"}, {"교토", "⛩️"}, {"다낭", "🌊"},
        });
        register("lotto", "로또 1등 월드컵", "🎰", new String[][]{
                {"건물주 되기", "🏢"}, {"세계일주", "✈️"}, {"슈퍼카", "🏎️"}, {"즉시 퇴사", "📄"},
                {"명품 쇼핑", "👜"}, {"내 집 마련", "🏠"}, {"통 큰 기부", "💝"}, {"주식·코인", "📈"},
                {"부모님 효도", "🎁"}, {"통장에 저축", "💰"}, {"한강뷰 아파트", "🌉"}, {"취미에 올인", "🎮"},
                {"반려동물 입양", "🐾"}, {"요트 파티", "🛥️"}, {"숲속 별장", "🏡"}, {"일단 펑펑", "🎉"},
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
