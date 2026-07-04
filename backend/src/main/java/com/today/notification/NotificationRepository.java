package com.today.notification;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

    List<Notification> findByRecipient_IdOrderByCreatedAtDesc(Long recipientId, Pageable pageable);

    long countByRecipient_IdAndReadFlagFalse(Long recipientId);

    List<Notification> findByRecipient_IdAndReadFlagFalse(Long recipientId);

    // dedup: 같은 날짜 ENTRY_OPENED 존재 여부 (recipient 무관 — 둘 중 하나라도 있으면 그 날짜는 이미 열림 처리)
    boolean existsByRecipient_IdAndTypeAndEntryDate(Long recipientId, NotificationType type, LocalDate entryDate);

    // dedup: 같은 날짜 미읽음 PARTNER_WROTE (수정 시 재알림 방지)
    boolean existsByRecipient_IdAndTypeAndEntryDateAndReadFlagFalse(
            Long recipientId, NotificationType type, LocalDate entryDate);

    // POKE 스팸 방지: 최근 특정 시각 이후 sender가 recipient에게 보낸 POKE 존재 여부
    boolean existsByRecipient_IdAndTypeAndCreatedAtAfter(
            Long recipientId, NotificationType type, LocalDateTime after);

    Optional<Notification> findByIdAndRecipient_Id(Long id, Long recipientId);
}
