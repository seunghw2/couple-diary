package com.today.couple;

import com.today.common.ApiException;
import com.today.common.ErrorCode;
import com.today.couple.CoupleDtos.*;
import com.today.notification.NotificationService;
import com.today.user.User;
import com.today.user.UserDtos.PartnerSummary;
import com.today.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
public class CoupleService {

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    private final CoupleRepository coupleRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    @Transactional(readOnly = true)
    public InviteResponse myInviteCode(Long userId) {
        User me = getUser(userId);
        return new InviteResponse(me.getInviteCode());
    }

    @Transactional
    public CoupleResponse connect(Long userId, ConnectRequest req) {
        User me = getUser(userId);

        if (coupleRepository.existsByUser1_IdOrUser2_Id(userId, userId)) {
            throw new ApiException(ErrorCode.ALREADY_COUPLED);
        }

        // 초대코드는 대문자 저장이므로, 붙여넣기/키보드로 소문자·공백이 섞여도 연결되게 정규화.
        String code = req.inviteCode() == null ? "" : req.inviteCode().trim().toUpperCase();
        User owner = userRepository.findByInviteCode(code)
                .orElseThrow(() -> new ApiException(ErrorCode.INVALID_INVITE_CODE));

        if (owner.getId().equals(userId)) {
            throw new ApiException(ErrorCode.CANNOT_CONNECT_SELF);
        }
        if (coupleRepository.existsByUser1_IdOrUser2_Id(owner.getId(), owner.getId())) {
            throw new ApiException(ErrorCode.PARTNER_ALREADY_COUPLED);
        }

        Couple couple = Couple.builder().user1(owner).user2(me).build();
        try {
            coupleRepository.saveAndFlush(couple);
        } catch (DataIntegrityViolationException e) {
            // 동시 connect 경합: 둘 중 한쪽이 이미 다른 커플로 저장됨
            throw new ApiException(ErrorCode.ALREADY_COUPLED);
        }

        // 코드 주인(user1=owner)에게 연결 알림 (연결한 상대=user2=me)
        notificationService.onCoupleConnected(owner, me);

        return toResponse(couple);
    }

    @Transactional(readOnly = true)
    public CoupleResponse myCouple(Long userId) {
        return toResponse(requireCouple(userId));
    }

    @Transactional
    public CoupleResponse setAnniversary(Long userId, AnniversaryRequest req) {
        Couple couple = requireCouple(userId);
        if (req.anniversaryDate() != null && req.anniversaryDate().isAfter(LocalDate.now(KST))) {
            throw new ApiException(ErrorCode.INVALID_INPUT, "처음 만난 날은 미래일 수 없어요.");
        }
        couple.setAnniversaryDate(req.anniversaryDate());
        return toResponse(couple);
    }

    /**
     * 기념일 계산 목록. 오늘(Asia/Seoul) 기준 다가오는(오늘 포함) 항목만, 날짜순 정렬.
     *  - 100일 단위(100·200·…): anniversaryDate 기준, 약 5주년(≈1900일) 범위까지
     *  - N주년(1·2·3…): anniversaryDate 기준, 5주년까지
     *  - 두 유저의 다가오는 생일(올해/내년 중 가까운 것)
     * anniversaryDate 미설정이면 생일만.
     */
    @Transactional(readOnly = true)
    public AnniversaryListResponse anniversaries(Long userId) {
        Couple couple = requireCouple(userId);
        LocalDate today = LocalDate.now(KST);
        List<AnniversaryItem> items = new ArrayList<>();

        LocalDate anniv = couple.getAnniversaryDate();
        if (anniv != null) {
            // 만난 날 = 1일차 관례. 100·200…일 = anniv + (n-1)일.
            for (int n = 100; n <= 1900; n += 100) {
                LocalDate d = anniv.plusDays(n - 1L);
                if (!d.isBefore(today)) {
                    items.add(new AnniversaryItem(n + "일", d, ChronoUnit.DAYS.between(today, d)));
                }
            }
            // N주년 = anniv + N년.
            for (int y = 1; y <= 5; y++) {
                LocalDate d = anniv.plusYears(y);
                if (!d.isBefore(today)) {
                    items.add(new AnniversaryItem(y + "주년", d, ChronoUnit.DAYS.between(today, d)));
                }
            }
        }

        // 두 유저 생일(다가오는 것)
        addBirthday(items, couple.getUser1(), today);
        addBirthday(items, couple.getUser2(), today);

        items.sort(Comparator.comparing(AnniversaryItem::date));
        return new AnniversaryListResponse(items);
    }

    // 유저 생일이 있으면 올해/내년 중 다가오는(오늘 포함) 날짜로 추가.
    private void addBirthday(List<AnniversaryItem> items, User user, LocalDate today) {
        if (user == null || user.getBirthday() == null) return;
        LocalDate b = user.getBirthday();
        LocalDate next = birthdayInYear(b, today.getYear());
        if (next.isBefore(today)) {
            next = birthdayInYear(b, today.getYear() + 1);
        }
        String label = user.getNickname() + "님 생일";
        items.add(new AnniversaryItem(label, next, ChronoUnit.DAYS.between(today, next)));
    }

    // 2/29 생일은 평년엔 2/28로 보정.
    private LocalDate birthdayInYear(LocalDate birthday, int year) {
        try {
            return birthday.withYear(year);
        } catch (java.time.DateTimeException e) {
            return LocalDate.of(year, 2, 28);
        }
    }

    public Couple requireCouple(Long userId) {
        return coupleRepository.findByMember(userId)
                .orElseThrow(() -> new ApiException(ErrorCode.COUPLE_NOT_FOUND));
    }

    private CoupleResponse toResponse(Couple c) {
        Long dday = c.getAnniversaryDate() == null ? null
                : ChronoUnit.DAYS.between(c.getAnniversaryDate(), LocalDate.now()) + 1;
        return new CoupleResponse(
                c.getId(),
                PartnerSummary.of(c.getUser1()),
                PartnerSummary.of(c.getUser2()),
                c.getAnniversaryDate(),
                dday);
    }

    private User getUser(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(ErrorCode.USER_NOT_FOUND));
    }
}
