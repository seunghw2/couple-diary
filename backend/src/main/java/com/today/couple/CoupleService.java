package com.today.couple;

import com.today.common.ApiException;
import com.today.common.ErrorCode;
import com.today.couple.CoupleDtos.*;
import com.today.user.User;
import com.today.user.UserDtos.PartnerSummary;
import com.today.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

@Service
@RequiredArgsConstructor
public class CoupleService {

    private final CoupleRepository coupleRepository;
    private final UserRepository userRepository;

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

        User owner = userRepository.findByInviteCode(req.inviteCode())
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
        return toResponse(couple);
    }

    @Transactional(readOnly = true)
    public CoupleResponse myCouple(Long userId) {
        return toResponse(requireCouple(userId));
    }

    @Transactional
    public CoupleResponse setAnniversary(Long userId, AnniversaryRequest req) {
        Couple couple = requireCouple(userId);
        couple.setAnniversaryDate(req.anniversaryDate());
        return toResponse(couple);
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
