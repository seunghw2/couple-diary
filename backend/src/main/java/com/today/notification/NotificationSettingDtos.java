package com.today.notification;

public class NotificationSettingDtos {

    /** 알림 카테고리별 on/off. GET/PUT 공용. */
    public record SettingsView(
            boolean diary,
            boolean question,
            boolean poke,
            boolean anniversary,
            boolean worldcup,
            boolean saju
    ) {
        public static SettingsView of(NotificationSetting s) {
            return new SettingsView(s.isDiary(), s.isQuestion(), s.isPoke(),
                    s.isAnniversary(), s.isWorldcup(), s.isSaju());
        }
    }
}
