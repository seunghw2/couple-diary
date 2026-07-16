package com.today.notification;

import com.today.notification.NotificationSettingDtos.SettingsView;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class NotificationSettingService {

    private final NotificationSettingRepository repository;

    @Transactional(readOnly = true)
    public SettingsView get(Long userId) {
        return repository.findByUserId(userId)
                .map(SettingsView::of)
                .orElseGet(() -> SettingsView.of(new NotificationSetting(userId)));
    }

    @Transactional
    public SettingsView update(Long userId, SettingsView req) {
        NotificationSetting s = repository.findByUserId(userId)
                .orElseGet(() -> repository.save(new NotificationSetting(userId)));
        s.setDiary(req.diary());
        s.setQuestion(req.question());
        s.setPoke(req.poke());
        s.setAnniversary(req.anniversary());
        s.setWorldcup(req.worldcup());
        s.setSaju(req.saju());
        return SettingsView.of(s);
    }

    /** 이 사용자에게 해당 알림 푸시를 보낼지. 카테고리 null(중요 이벤트) 또는 설정 없음이면 발송. */
    @Transactional(readOnly = true)
    public boolean pushEnabled(Long userId, NotificationType type) {
        NotificationCategory cat = type.category();
        if (cat == null) return true;
        return repository.findByUserId(userId).map(s -> s.enabled(cat)).orElse(true);
    }
}
