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

    // dedup: 같은 날짜 + 같은 본문(=같은 기념일) 존재 여부.
    // 생일과 N일이 같은 날 겹쳐도 본문이 달라 둘 다 생성되게 하려고 body까지 매칭.
    // body는 D-N 없이 이름+날짜만 담아 날짜별 안정적(매일 중복 생성 안 됨).
    boolean existsByRecipient_IdAndTypeAndEntryDateAndBody(
            Long recipientId, NotificationType type, LocalDate entryDate, String body);

    // dedup: 같은 날짜 미읽음 PARTNER_WROTE (수정 시 재알림 방지)
    boolean existsByRecipient_IdAndTypeAndEntryDateAndReadFlagFalse(
            Long recipientId, NotificationType type, LocalDate entryDate);

    // POKE 스팸 방지: 최근 특정 시각 이후 sender가 recipient에게 보낸 POKE 존재 여부
    boolean existsByRecipient_IdAndTypeAndCreatedAtAfter(
            Long recipientId, NotificationType type, LocalDateTime after);

    Optional<Notification> findByIdAndRecipient_Id(Long id, Long recipientId);

    // 계정 삭제: 이 유저가 받은 모든 알림 제거.
    void deleteByRecipient_Id(Long recipientId);
}
