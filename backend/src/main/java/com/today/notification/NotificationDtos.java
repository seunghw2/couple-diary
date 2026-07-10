package com.today.notification;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public class NotificationDtos {

    public record NotificationView(
            Long id,
            NotificationType type,
            String title,
            String body,
            LocalDate entryDate,
            String refKey,
            boolean read,
            LocalDateTime createdAt
    ) {
        public static NotificationView of(Notification n) {
            return new NotificationView(
                    n.getId(), n.getType(), n.getTitle(), n.getBody(),
                    n.getEntryDate(), n.getRefKey(), n.isReadFlag(), n.getCreatedAt());
        }
    }

    public record NotificationListResponse(
            List<NotificationView> items,
            long unreadCount
    ) {}
}
