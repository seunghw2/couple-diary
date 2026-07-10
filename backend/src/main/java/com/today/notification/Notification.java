package com.today.notification;

import com.today.user.User;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Getter
@Setter
@Table(name = "notifications",
        indexes = @Index(name = "idx_notif_recipient_created", columnList = "recipient_id, created_at"))
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "recipient_id", nullable = false)
    private User recipient;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private NotificationType type;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false, length = 500)
    private String body;

    // 일기 관련 알림이면 해당 날짜(또는 기념일 날짜), 아니면 null
    @Column(name = "entry_date")
    private LocalDate entryDate;

    // 딥링크 참조 키(예: 월드컵 key). 특정 대상으로 바로 이동할 때 사용. 없으면 null.
    @Column(name = "ref_key", length = 100)
    private String refKey;

    @Column(name = "read_flag", nullable = false)
    private boolean readFlag = false;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Builder
    public Notification(User recipient, NotificationType type, String title, String body,
                        LocalDate entryDate, String refKey) {
        this.recipient = recipient;
        this.type = type;
        this.title = title;
        this.body = body;
        this.entryDate = entryDate;
        this.refKey = refKey;
    }

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
