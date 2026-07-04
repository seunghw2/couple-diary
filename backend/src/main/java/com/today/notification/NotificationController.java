package com.today.notification;

import com.today.common.SecurityUtil;
import com.today.notification.NotificationDtos.NotificationListResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;

    @GetMapping("/api/notifications")
    public NotificationListResponse list() {
        return notificationService.list(SecurityUtil.currentUserId());
    }

    @PostMapping("/api/notifications/{id}/read")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void read(@PathVariable Long id) {
        notificationService.markRead(SecurityUtil.currentUserId(), id);
    }

    @PostMapping("/api/notifications/read-all")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void readAll() {
        notificationService.markAllRead(SecurityUtil.currentUserId());
    }

    @PostMapping("/api/poke")
    @ResponseStatus(HttpStatus.OK)
    public void poke() {
        notificationService.poke(SecurityUtil.currentUserId());
    }
}
