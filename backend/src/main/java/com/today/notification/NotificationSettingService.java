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
        // null 필드는 건드리지 않는다(부분 업데이트로 나머지 카테고리가 조용히 꺼지는 사고 방지).
        if (req.diary() != null) s.setDiary(req.diary());
        if (req.question() != null) s.setQuestion(req.question());
        if (req.poke() != null) s.setPoke(req.poke());
        if (req.anniversary() != null) s.setAnniversary(req.anniversary());
        if (req.worldcup() != null) s.setWorldcup(req.worldcup());
        if (req.saju() != null) s.setSaju(req.saju());
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
