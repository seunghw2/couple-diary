package com.today.notification;

public class NotificationSettingDtos {

    /** 알림 카테고리별 on/off. GET/PUT 공용. PUT에서 null 필드는 '변경 없음'으로 처리. */
    public record SettingsView(
            Boolean diary,
            Boolean question,
            Boolean poke,
            Boolean anniversary,
            Boolean worldcup,
            Boolean saju
    ) {
        public static SettingsView of(NotificationSetting s) {
            return new SettingsView(s.isDiary(), s.isQuestion(), s.isPoke(),
                    s.isAnniversary(), s.isWorldcup(), s.isSaju());
        }
    }
}
