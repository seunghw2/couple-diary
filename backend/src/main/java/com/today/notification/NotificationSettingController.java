package com.today.notification;

import com.today.common.SecurityUtil;
import com.today.notification.NotificationSettingDtos.SettingsView;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 알림 수신 설정(카테고리별 on/off). */
@RestController
@RequestMapping("/api/notification-settings")
@RequiredArgsConstructor
public class NotificationSettingController {

    private final NotificationSettingService service;

    @GetMapping
    public SettingsView get() {
        return service.get(SecurityUtil.currentUserId());
    }

    @PutMapping
    public SettingsView update(@RequestBody SettingsView req) {
        return service.update(SecurityUtil.currentUserId(), req);
    }
}
