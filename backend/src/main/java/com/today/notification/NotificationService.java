package com.today.notification;

import com.today.common.ApiException;
import com.today.common.ErrorCode;
import com.today.couple.Couple;
import com.today.couple.CoupleRepository;
import com.today.notification.NotificationDtos.NotificationListResponse;
import com.today.notification.NotificationDtos.NotificationView;
import com.today.push.PushSender;
import com.today.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.MonthDay;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final CoupleRepository coupleRepository;
    private final PushSender pushSender;

    private static final int LIST_LIMIT = 50;
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private static final DateTimeFormatter MD = DateTimeFormatter.ofPattern("M월 d일");
    private static final long POKE_COOLDOWN_HOURS = 1;
    private static final int ANNIVERSARY_HORIZON_DAYS = 7;

    /**
     * 알림 저장 + 원격 푸시 발송(앱이 꺼져 있어도 도착). 모든 알림 생성은 이 메서드를 거친다.
     * 푸시는 @Async라 여기서는 비동기로 위임만 하고 트랜잭션을 붙잡지 않는다.
     */
    private Notification persist(Notification n) {
        Notification saved = notificationRepository.save(n);
        Map<String, Object> data = new HashMap<>();
        data.put("type", n.getType().name());
        if (n.getRefKey() != null) data.put("refKey", n.getRefKey());
        if (n.getEntryDate() != null) data.put("entryDate", n.getEntryDate().toString());
        pushSender.sendToUser(n.getRecipient().getId(), n.getTitle(), n.getBody(), data);
        return saved;
    }

    // ===================== 트리거 헬퍼 (기존 서비스 트랜잭션 내에서 호출) =====================

    /** 일기 저장 후 그날이 방금 OPEN이면 양쪽에 ENTRY_OPENED, 아직 LOCKED면 상대에게 PARTNER_WROTE. */
    @Transactional
    public void onEntryUpsert(User me, User partner, LocalDate date, boolean nowOpen) {
        if (partner == null) return; // 커플 미연결/상대 없음

        if (nowOpen) {
            String md = date.format(MD);
            String title = "일기가 열렸어요";
            String body = "오늘(" + md + ") 일기가 열렸어요 💌";
            // 이미 그 날짜 ENTRY_OPENED 있으면 중복 생성 금지 (수신자별 확인)
            createIfAbsentEntryOpened(me, date, title, body);
            createIfAbsentEntryOpened(partner, date, title, body);
        } else {
            // 아직 LOCKED: 상대에게 PARTNER_WROTE (같은 날짜 미읽음 있으면 skip)
            if (notificationRepository.existsByRecipient_IdAndTypeAndEntryDateAndReadFlagFalse(
                    partner.getId(), NotificationType.PARTNER_WROTE, date)) {
                return;
            }
            persist(Notification.builder()
                    .recipient(partner)
                    .type(NotificationType.PARTNER_WROTE)
                    .title("오늘 일기가 도착했어요")
                    .body(me.getNickname() + "님이 오늘 일기를 썼어요 — 나도 쓰면 열려요")
                    .entryDate(date)
                    .build());
        }
    }

    private void createIfAbsentEntryOpened(User recipient, LocalDate date, String title, String body) {
        if (notificationRepository.existsByRecipient_IdAndTypeAndEntryDate(
                recipient.getId(), NotificationType.ENTRY_OPENED, date)) {
            return;
        }
        persist(Notification.builder()
                .recipient(recipient)
                .type(NotificationType.ENTRY_OPENED)
                .title(title)
                .body(body)
                .entryDate(date)
                .build());
    }

    /** 댓글 작성 후 그 일기의 상대 작성자에게 COMMENT 알림. */
    @Transactional
    public void onComment(User me, User recipient, LocalDate date, String commentText) {
        if (recipient == null) return;
        String preview = commentText == null ? "" : commentText.strip();
        if (preview.length() > 20) preview = preview.substring(0, 20);
        persist(Notification.builder()
                .recipient(recipient)
                .type(NotificationType.COMMENT)
                .title("새 댓글")
                .body(me.getNickname() + "님이 댓글을 남겼어요: " + preview)
                .entryDate(date)
                .build());
    }

    /** 커플 연결 성사 시 코드 주인(owner)에게 알림. entryDate=null. */
    @Transactional
    public void onCoupleConnected(User owner, User partner) {
        if (owner == null || partner == null) return;
        persist(Notification.builder()
                .recipient(owner)
                .type(NotificationType.COUPLE_CONNECTED)
                .title("커플 연결 완료")
                .body(partner.getNickname() + "님과 연결됐어요 💞")
                .entryDate(null)
                .build());
    }

    // ===================== 오늘의 질문 알림 =====================

    /** 같은 날짜·타입 알림이 이미 있으면 생성 안 함(중복 방지). */
    private void createIfAbsent(User recipient, NotificationType type, String title, String body, LocalDate date) {
        if (recipient == null) return;
        if (notificationRepository.existsByRecipient_IdAndTypeAndEntryDate(recipient.getId(), type, date)) {
            return;
        }
        persist(Notification.builder()
                .recipient(recipient).type(type).title(title).body(body).entryDate(date).build());
    }

    /** 도착시간: 오늘의 질문 두 통 도착 — 양쪽에게. */
    @Transactional
    public void onQuestionArrived(User a, User b, LocalDate date) {
        createIfAbsent(a, NotificationType.QUESTION_ARRIVED, "오늘의 편지가 도착했어요",
                "오늘의 질문 두 통이 왔어요 — 하나 골라 답장해요 💌", date);
        createIfAbsent(b, NotificationType.QUESTION_ARRIVED, "오늘의 편지가 도착했어요",
                "오늘의 질문 두 통이 왔어요 — 하나 골라 답장해요 💌", date);
    }

    /** 상대가 오늘 질문을 골랐어요 — 고르지 않은 상대에게. */
    @Transactional
    public void onQuestionChosen(User chooser, User partner, LocalDate date) {
        if (chooser == null || partner == null) return;
        createIfAbsent(partner, NotificationType.QUESTION_CHOSEN, "오늘의 질문이 정해졌어요",
                chooser.getNickname() + "님이 오늘 질문을 골랐어요 — 답장해 볼까요?", date);
    }

    /** 상대가 답장을 남겼는데 아직 내 차례일 때 — 아직 안 쓴 상대에게. */
    @Transactional
    public void onQuestionAnswered(User answerer, User partner, LocalDate date) {
        if (answerer == null || partner == null) return;
        createIfAbsent(partner, NotificationType.QUESTION_ANSWERED, "상대가 답장했어요",
                answerer.getNickname() + "님이 답장을 남겼어요 — 나도 쓰면 편지가 열려요", date);
    }

    /** 둘 다 답해 편지가 열렸어요 — 양쪽에게. */
    @Transactional
    public void onQuestionOpened(User a, User b, LocalDate date) {
        createIfAbsent(a, NotificationType.QUESTION_OPENED, "편지가 열렸어요", "오늘의 편지가 서로 열렸어요 💗", date);
        createIfAbsent(b, NotificationType.QUESTION_OPENED, "편지가 열렸어요", "오늘의 편지가 서로 열렸어요 💗", date);
    }

    /** 오늘의 편지에 댓글 — 상대에게(여러 개 허용, 중복 방지 없음). */
    @Transactional
    public void onQuestionComment(User me, User partner, LocalDate date, String preview) {
        if (me == null || partner == null) return;
        String p = preview == null ? "" : preview.strip();
        if (p.length() > 20) p = p.substring(0, 20);
        persist(Notification.builder()
                .recipient(partner)
                .type(NotificationType.QUESTION_COMMENT)
                .title("오늘의 편지에 댓글")
                .body(me.getNickname() + "님이 댓글을 남겼어요: " + p)
                .entryDate(date)
                .build());
    }

    /** 자정 마감: 어제 편지가 열리지 못하고 지나갔어요 — 양쪽에게. */
    @Transactional
    public void onQuestionMissed(User a, User b, LocalDate date) {
        createIfAbsent(a, NotificationType.QUESTION_MISSED, "편지가 지나갔어요",
                "어제 편지는 답장이 다 오지 않아 열리지 않았어요", date);
        createIfAbsent(b, NotificationType.QUESTION_MISSED, "편지가 지나갔어요",
                "어제 편지는 답장이 다 오지 않아 열리지 않았어요", date);
    }

    // ===================== 엔드포인트 =====================

    @Transactional
    public NotificationListResponse list(Long userId) {
        // ANNIVERSARY 지연 생성 (커플 연결 시에만)
        coupleRepository.findByMember(userId)
                .ifPresent(couple -> generateUpcomingAnniversaries(couple));

        List<Notification> items = notificationRepository
                .findByRecipient_IdOrderByCreatedAtDesc(userId, PageRequest.of(0, LIST_LIMIT));
        long unread = notificationRepository.countByRecipient_IdAndReadFlagFalse(userId);
        List<NotificationView> views = items.stream().map(NotificationView::of).toList();
        return new NotificationListResponse(views, unread);
    }

    @Transactional
    public void markRead(Long userId, Long notificationId) {
        Notification n = notificationRepository.findByIdAndRecipient_Id(notificationId, userId)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND));
        n.setReadFlag(true);
    }

    @Transactional
    public void markAllRead(Long userId) {
        List<Notification> unread = notificationRepository.findByRecipient_IdAndReadFlagFalse(userId);
        for (Notification n : unread) n.setReadFlag(true);
    }

    // ===================== 월드컵 알림·배지 =====================

    private static final List<NotificationType> WORLDCUP_TYPES =
            List.of(NotificationType.WORLDCUP_COMPLETED, NotificationType.WORLDCUP_COMPARABLE);

    /**
     * 상대가 월드컵을 완주했을 때 — 완주자의 상대에게. 완료할 때마다 하나씩.
     * comparable=true(상대가 이미 이 월드컵을 완주해 둘 다 끝남)면 '비교 가능' 알림으로.
     * refKey에 월드컵 key를 담아 알림 탭 시 해당 결과로 바로 이동한다.
     */
    @Transactional
    public void onWorldcupCompleted(User me, User partner, String cupTitle, String winnerLabel,
                                    String worldcupKey, boolean comparable) {
        if (me == null || partner == null) return;
        String title, body;
        NotificationType type;
        if (comparable) {
            type = NotificationType.WORLDCUP_COMPARABLE;
            title = "결과를 비교할 수 있어요";
            body = "이제 " + me.getNickname() + "님과 " + cupTitle + " 결과를 비교해봐요 🏆";
        } else {
            type = NotificationType.WORLDCUP_COMPLETED;
            title = me.getNickname() + "님이 월드컵을 완주했어요";
            body = "🏆 " + cupTitle + " · 우승 " + winnerLabel;
        }
        persist(Notification.builder()
                .recipient(partner).type(type).title(title).body(body)
                .entryDate(null).refKey(worldcupKey).build());
    }

    /** 설정의 월드컵 행 배지 = 아직 안 본 상대 완주/비교가능 수. */
    @Transactional(readOnly = true)
    public long countUnreadWorldcup(Long userId) {
        return notificationRepository.countByRecipient_IdAndTypeInAndReadFlagFalse(userId, WORLDCUP_TYPES);
    }

    /** 월드컵 목록을 열면 배지 초기화(해당 알림 읽음 처리). */
    @Transactional
    public void markWorldcupSeen(Long userId) {
        List<Notification> unread = notificationRepository
                .findByRecipient_IdAndTypeInAndReadFlagFalse(userId, WORLDCUP_TYPES);
        for (Notification n : unread) n.setReadFlag(true);
    }

    // ===================== 사주 궁합 알림·배지 =====================

    private static final List<NotificationType> SAJU_TYPES =
            List.of(NotificationType.SAJU_BIRTHDAY_REQUEST, NotificationType.SAJU_COMPATIBILITY_READY);

    /** 상대에게 "생일 넣어줘, 궁합 보고 싶어" 요청 알림. refKey=couple로 궁합 화면 딥링크. */
    @Transactional
    public void onSajuBirthdayRequest(User me, User partner) {
        if (me == null || partner == null) return;
        persist(Notification.builder()
                .recipient(partner)
                .type(NotificationType.SAJU_BIRTHDAY_REQUEST)
                .title("우리 궁합 보고 싶대요")
                .body(me.getNickname() + "님이 사주 궁합을 보고 싶어해요 — 생일을 넣어줄래요? 🔮")
                .entryDate(null)
                .refKey("couple")
                .build());
    }

    /** 내가 생일을 채워 이제 궁합을 볼 수 있음 — 상대에게. refKey=couple 딥링크. */
    @Transactional
    public void onSajuCompatibilityReady(User me, User partner) {
        if (me == null || partner == null) return;
        persist(Notification.builder()
                .recipient(partner)
                .type(NotificationType.SAJU_COMPATIBILITY_READY)
                .title("이제 궁합을 볼 수 있어요")
                .body(me.getNickname() + "님이 생일을 입력했어요 — 우리 사주 궁합을 확인해봐요 💞")
                .entryDate(null)
                .refKey("couple")
                .build());
    }

    /** 설정 사주 행 배지 = 아직 안 본 사주 알림 수. */
    @Transactional(readOnly = true)
    public long countUnreadSaju(Long userId) {
        return notificationRepository.countByRecipient_IdAndTypeInAndReadFlagFalse(userId, SAJU_TYPES);
    }

    /** 사주 화면 열람 시 배지 초기화. */
    @Transactional
    public void markSajuSeen(Long userId) {
        List<Notification> unread = notificationRepository
                .findByRecipient_IdAndTypeInAndReadFlagFalse(userId, SAJU_TYPES);
        for (Notification n : unread) n.setReadFlag(true);
    }

    @Transactional
    public void poke(Long userId) {
        // 커플 미연결이면 400
        Couple couple = coupleRepository.findByMember(userId)
                .orElseThrow(() -> new ApiException(ErrorCode.INVALID_INPUT));
        User me = memberOf(couple, userId);
        User partner = partnerOf(couple, userId);
        if (partner == null) throw new ApiException(ErrorCode.COUPLE_NOT_FOUND);

        // 스팸 방지: 최근 1시간 내 상대에게 보낸 POKE 있으면 무시(중복 생성 안 함)
        LocalDateTime since = LocalDateTime.now().minusHours(POKE_COOLDOWN_HOURS);
        if (notificationRepository.existsByRecipient_IdAndTypeAndCreatedAtAfter(
                partner.getId(), NotificationType.POKE, since)) {
            return; // 200 + 무시
        }
        persist(Notification.builder()
                .recipient(partner)
                .type(NotificationType.POKE)
                .title("콕!")
                .body(me.getNickname() + "님이 콕 찔렀어요 👉 — 오늘 일기 쓰라고!")
                .entryDate(null)
                .build());
    }

    // ===================== ANNIVERSARY 생성 =====================

    private void generateUpcomingAnniversaries(Couple couple) {
        LocalDate today = LocalDate.now(KST);
        LocalDate horizon = today.plusDays(ANNIVERSARY_HORIZON_DAYS);
        User u1 = couple.getUser1();
        User u2 = couple.getUser2();

        List<Anniv> candidates = new ArrayList<>();

        // 사귄 날 기준 100일 단위(100, 200, 300, ...) 다가오는 것
        if (couple.getAnniversaryDate() != null) {
            LocalDate base = couple.getAnniversaryDate();
            // D-day 표기: 사귄 첫날이 1일 → n일째 = base + (n-1)일
            for (int milestone = 100; milestone <= 100000; milestone += 100) {
                LocalDate d = base.plusDays(milestone - 1L);
                if (d.isBefore(today)) continue;
                if (d.isAfter(horizon)) break;
                candidates.add(new Anniv(d, milestone + "일"));
            }
        }

        // 두 유저 생일 (올해/내년 중 다가오는 것)
        addBirthday(candidates, u1, today, horizon);
        addBirthday(candidates, u2, today, horizon);

        for (Anniv a : candidates) {
            long dday = ChronoUnit.DAYS.between(today, a.date);
            String title = "D-" + dday + " " + a.name;
            String body = a.name + "이(가) " + a.date.format(MD) + "에 다가와요";
            createAnniversaryIfAbsent(u1, a.date, title, body);
            createAnniversaryIfAbsent(u2, a.date, title, body);
        }
    }

    private void addBirthday(List<Anniv> out, User u, LocalDate today, LocalDate horizon) {
        if (u.getBirthday() == null) return;
        MonthDay md;
        try {
            md = MonthDay.from(u.getBirthday());
        } catch (Exception e) {
            return;
        }
        LocalDate next = nextOccurrence(md, today);
        if (!next.isAfter(horizon)) {
            out.add(new Anniv(next, u.getNickname() + "님 생일"));
        }
    }

    private LocalDate nextOccurrence(MonthDay md, LocalDate today) {
        LocalDate thisYear = safeAtYear(md, today.getYear());
        if (!thisYear.isBefore(today)) return thisYear;
        return safeAtYear(md, today.getYear() + 1);
    }

    private LocalDate safeAtYear(MonthDay md, int year) {
        // 2월 29일 등 비윤년 처리
        try {
            return md.atYear(year);
        } catch (Exception e) {
            return LocalDate.of(year, md.getMonthValue(), 28);
        }
    }

    private void createAnniversaryIfAbsent(User recipient, LocalDate annivDate, String title, String body) {
        // dedup: 같은 (type=ANNIVERSARY, entryDate=기념일날짜, body=기념일, recipient) 있으면 skip.
        // body까지 매칭해서 같은 날 생일과 N일이 겹쳐도 둘 다 생성(하나만 뜨던 문제 해결).
        if (notificationRepository.existsByRecipient_IdAndTypeAndEntryDateAndBody(
                recipient.getId(), NotificationType.ANNIVERSARY, annivDate, body)) {
            return;
        }
        persist(Notification.builder()
                .recipient(recipient)
                .type(NotificationType.ANNIVERSARY)
                .title(title)
                .body(body)
                .entryDate(annivDate)
                .build());
    }

    private User memberOf(Couple c, Long userId) {
        if (c.getUser1().getId().equals(userId)) return c.getUser1();
        if (c.getUser2().getId().equals(userId)) return c.getUser2();
        return null;
    }

    private User partnerOf(Couple c, Long userId) {
        if (c.getUser1().getId().equals(userId)) return c.getUser2();
        if (c.getUser2().getId().equals(userId)) return c.getUser1();
        return null;
    }

    private record Anniv(LocalDate date, String name) {}
}
