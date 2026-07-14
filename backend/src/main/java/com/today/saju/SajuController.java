package com.today.saju;

import com.today.common.SecurityUtil;
import com.today.saju.SajuDtos.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

/** 우리 사주 궁합 미니게임. 설정 탭에서 진입. */
@RestController
@RequestMapping("/api/saju")
@RequiredArgsConstructor
public class SajuController {

    private final SajuService sajuService;

    /** 허브 카드 상태(생일/상대 유무). */
    @GetMapping("/hub")
    public HubStatus hub() {
        return sajuService.hub(SecurityUtil.currentUserId());
    }

    /** 배지용 — 아직 안 본 사주 알림 수. ({...} 리터럴 경로 우선. */
    @GetMapping("/unseen")
    public UnseenView unseen() {
        return new UnseenView(sajuService.unseenCount(SecurityUtil.currentUserId()));
    }

    /** 사주 화면 열람 → 배지 초기화. */
    @PostMapping("/seen")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void seen() {
        sajuService.markSeen(SecurityUtil.currentUserId());
    }

    /** 내 사주. */
    @GetMapping("/me")
    public PersonalResult me() {
        return sajuService.me(SecurityUtil.currentUserId());
    }

    /** 연인 사주. */
    @GetMapping("/partner")
    public PersonalResult partner() {
        return sajuService.partner(SecurityUtil.currentUserId());
    }

    /** 오늘의 운세. */
    @GetMapping("/daily")
    public DailyView daily() {
        return sajuService.daily(SecurityUtil.currentUserId());
    }

    /** 생시(태어난 시각) 저장. hour=null이면 '모름'. */
    @PutMapping("/birth-time")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void birthTime(@RequestBody BirthTimeRequest req) {
        sajuService.setBirthTime(SecurityUtil.currentUserId(), req.hour());
    }

    /** 커플 궁합. */
    @GetMapping("/couple")
    public CoupleResult couple() {
        return sajuService.couple(SecurityUtil.currentUserId());
    }

    /** 상대에게 생일 입력 요청 알림. */
    @PostMapping("/request-birthday")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void requestBirthday() {
        sajuService.requestBirthday(SecurityUtil.currentUserId());
    }
}
