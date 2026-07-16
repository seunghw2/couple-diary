package com.today.notification;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** 사용자별 알림 수신 설정(카테고리 on/off). 행이 없으면 전부 켜짐으로 간주. */
@Entity
@Getter
@Setter
@Table(name = "notification_settings",
        uniqueConstraints = @UniqueConstraint(name = "uk_notif_setting_user", columnNames = "user_id"))
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class NotificationSetting {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false, unique = true)
    private Long userId;

    @Column(nullable = false)
    private boolean diary = true;

    @Column(nullable = false)
    private boolean question = true;

    @Column(nullable = false)
    private boolean poke = true;

    @Column(nullable = false)
    private boolean anniversary = true;

    @Column(nullable = false)
    private boolean worldcup = true;

    @Column(nullable = false)
    private boolean saju = true;

    public NotificationSetting(Long userId) {
        this.userId = userId;
    }

    public boolean enabled(NotificationCategory c) {
        return switch (c) {
            case DIARY -> diary;
            case QUESTION -> question;
            case POKE -> poke;
            case ANNIVERSARY -> anniversary;
            case WORLDCUP -> worldcup;
            case SAJU -> saju;
        };
    }
}
