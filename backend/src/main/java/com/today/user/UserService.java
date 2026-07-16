package com.today.user;

import com.today.auth.AppleClient;
import com.today.auth.AppleClient.AppleUser;
import com.today.auth.JwtTokenProvider;
import com.today.auth.KakaoClient;
import com.today.auth.KakaoClient.KakaoUser;
import com.today.comment.CommentRepository;
import com.today.common.ApiException;
import com.today.common.ErrorCode;
import com.today.common.InviteCodes;
import com.today.couple.Couple;
import com.today.couple.CoupleRepository;
import com.today.diary.CalendarMarkRepository;
import com.today.diary.DiaryDay;
import com.today.diary.DiaryDayRepository;
import com.today.diary.DiaryEntry;
import com.today.diary.DiaryEntryRepository;
import com.today.diary.EntryAnswerRepository;
import com.today.diary.PhotoRepository;
import com.today.diary.PlaceNicknameRepository;
import com.today.notification.NotificationRepository;
import com.today.question.DailyQuestion;
import com.today.question.DailyQuestionRepository;
import com.today.question.QuestionAnswer;
import com.today.question.QuestionAnswerRepository;
import com.today.question.QuestionCommentRepository;
import com.today.question.QuestionReactionRepository;
import com.today.question.QuestionReportRepository;
import com.today.question.QuestionSettingRepository;
import com.today.user.UserDtos.*;
import com.today.worldcup.WorldcupResultRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final CoupleRepository coupleRepository;
    private final JwtTokenProvider jwtTokenProvider;
    private final KakaoClient kakaoClient;
    private final AppleClient appleClient;

    // 계정 삭제 시 관련 데이터를 FK 안전 순서로 정리하기 위한 리포지토리들.
    private final DiaryDayRepository diaryDayRepository;
    private final DiaryEntryRepository diaryEntryRepository;
    private final PhotoRepository photoRepository;
    private final EntryAnswerRepository entryAnswerRepository;
    private final CommentRepository commentRepository;
    private final CalendarMarkRepository calendarMarkRepository;
    private final PlaceNicknameRepository placeNicknameRepository;
    private final DailyQuestionRepository dailyQuestionRepository;
    private final QuestionAnswerRepository questionAnswerRepository;
    private final QuestionReactionRepository questionReactionRepository;
    private final QuestionCommentRepository questionCommentRepository;
    private final QuestionReportRepository questionReportRepository;
    private final QuestionSettingRepository questionSettingRepository;
    private final NotificationRepository notificationRepository;
    private final WorldcupResultRepository worldcupResultRepository;
    private final com.today.push.PushTokenRepository pushTokenRepository;
    private final com.today.notification.NotificationService notificationService;

    private static final String[] AVATAR_COLORS =
            {"#FF6B6B", "#4ECDC4", "#FFD93D", "#6C5CE7", "#FF8CC8", "#38B000"};

    @Transactional
    public AuthResponse devLogin(DevLoginRequest req) {
        // email이 없거나 빈 값이면 닉네임 기반 결정적 email 생성 → 같은 닉네임=같은 유저.
        String email = (req.email() == null || req.email().isBlank())
                ? emailFor(req.nickname())
                : req.email().trim();
        User user = userRepository.findByEmail(email)
                .orElseGet(() -> createUser(email, req.nickname(), null));
        String token = jwtTokenProvider.createAccessToken(user.getId());
        return new AuthResponse(token, UserSummary.of(user));
    }

    /**
     * 카카오 인가 코드 로그인. code→카카오 토큰→사용자정보 조회 후 kakaoId로 upsert.
     * dev-login과 동일하게 우리 JWT access token을 발급한다.
     */
    @Transactional
    public AuthResponse kakaoLogin(KakaoLoginRequest req) {
        String kakaoAccessToken = kakaoClient.exchangeToken(req.code(), req.redirectUri());
        KakaoUser kakaoUser = kakaoClient.fetchUser(kakaoAccessToken);

        User user = userRepository.findByKakaoId(kakaoUser.kakaoId())
                .orElseGet(() -> createKakaoUser(kakaoUser));
        String token = jwtTokenProvider.createAccessToken(user.getId());
        return new AuthResponse(token, UserSummary.of(user));
    }

    /**
     * Apple 로그인. identityToken을 검증해 sub(appleId)로 upsert 후 우리 JWT를 발급한다.
     * Apple은 이메일/이름을 최초 1회만 주므로, 재로그인 시엔 저장된 유저를 그대로 쓴다.
     */
    @Transactional
    public AuthResponse appleLogin(AppleLoginRequest req) {
        AppleUser appleUser = appleClient.verify(req.identityToken());
        User user = userRepository.findByAppleId(appleUser.appleId())
                .orElseGet(() -> createAppleUser(appleUser, req.fullName()));
        // 계정 삭제 시 Apple 토큰 revoke(5.1.1v)를 위해 refresh_token 확보(Apple 키 설정 시에만 동작).
        String refresh = appleClient.exchangeRefreshToken(req.authorizationCode());
        if (refresh != null) user.setAppleRefreshToken(refresh);
        String token = jwtTokenProvider.createAccessToken(user.getId());
        return new AuthResponse(token, UserSummary.of(user));
    }

    private User createAppleUser(AppleUser appleUser, String fullName) {
        // email은 NOT NULL & unique → Apple이 미제공(비공개 릴레이 거부 등)하면 결정적 대체값.
        String email = (appleUser.email() != null && !appleUser.email().isBlank())
                ? appleUser.email().trim()
                : "apple_" + appleUser.appleId() + "@today.local";
        if (userRepository.findByEmail(email).isPresent()) {
            email = "apple_" + appleUser.appleId() + "@today.local";
        }
        String nickname = (fullName != null && !fullName.isBlank()) ? fullName.trim() : "친구";
        String color = AVATAR_COLORS[Math.abs(appleUser.appleId().hashCode()) % AVATAR_COLORS.length];
        User user = User.builder()
                .email(email)
                .nickname(nickname)
                .avatarColor(color)
                .appleId(appleUser.appleId())
                .inviteCode(uniqueInviteCode())
                .build();
        return userRepository.save(user);
    }

    private User createKakaoUser(KakaoUser kakaoUser) {
        // email은 스키마상 NOT NULL & unique → 카카오가 이메일 미제공/동의거부 시 결정적 대체값 사용.
        String email = (kakaoUser.email() != null && !kakaoUser.email().isBlank())
                ? kakaoUser.email().trim()
                : "kakao_" + kakaoUser.kakaoId() + "@today.local";
        // 이메일이 이미 dev-login 등으로 존재하면 충돌을 피하려 카카오 결정적 이메일로 강제.
        if (userRepository.findByEmail(email).isPresent()) {
            email = "kakao_" + kakaoUser.kakaoId() + "@today.local";
        }
        String nickname = (kakaoUser.nickname() != null && !kakaoUser.nickname().isBlank())
                ? kakaoUser.nickname().trim()
                : "카카오친구";
        String color = AVATAR_COLORS[Math.abs(kakaoUser.kakaoId().hashCode()) % AVATAR_COLORS.length];
        User user = User.builder()
                .email(email)
                .nickname(nickname)
                .avatarColor(color)
                .kakaoId(kakaoUser.kakaoId())
                .inviteCode(uniqueInviteCode())
                .build();
        return userRepository.save(user);
    }

    /** 닉네임 기반 결정적 email. 기존 unique(email) 스키마 재사용. */
    private String emailFor(String nickname) {
        return nickname.trim() + "@today.local";
    }

    private User createUser(String email, String nickname, String kakaoId) {
        String color = AVATAR_COLORS[Math.abs(email.hashCode()) % AVATAR_COLORS.length];
        User user = User.builder()
                .email(email)
                .nickname(nickname)
                .avatarColor(color)
                .kakaoId(kakaoId)
                .inviteCode(uniqueInviteCode())
                .build();
        return userRepository.save(user);
    }

    private String uniqueInviteCode() {
        String code;
        do {
            code = InviteCodes.generate();
        } while (userRepository.existsByInviteCode(code));
        return code;
    }

    @Transactional(readOnly = true)
    public MeResponse me(Long userId) {
        User user = getUser(userId);
        return coupleRepository.findByMember(userId)
                .map(c -> {
                    User partner = partnerOf(c, userId);
                    return new MeResponse(UserSummary.of(user), true, c.getId(),
                            partner == null ? null : PartnerSummary.of(partner), user.isAdmin());
                })
                .orElseGet(() -> new MeResponse(UserSummary.of(user), false, null, null, user.isAdmin()));
    }

    @Transactional
    public UserSummary updateMe(Long userId, UpdateMeRequest req) {
        User user = getUser(userId);
        // 부분 업데이트지만 넘어온 값은 검증(빈 닉네임·이상한 색·미래 생일 방지).
        if (req.nickname() != null) {
            // HTML 태그/꺾쇠 제거(저장형 XSS 방어) 후 검증.
            String nick = req.nickname().replaceAll("<[^>]*>", "").replace("<", "").replace(">", "").trim();
            if (nick.isEmpty()) throw new ApiException(ErrorCode.INVALID_INPUT, "닉네임을 입력해 주세요.");
            if (nick.length() > 30) throw new ApiException(ErrorCode.INVALID_INPUT, "닉네임은 30자 이하로 해 주세요.");
            user.setNickname(nick);
        }
        if (req.avatarColor() != null) {
            String color = req.avatarColor().trim();
            if (!color.matches("^#[0-9a-fA-F]{6}$")) {
                throw new ApiException(ErrorCode.INVALID_INPUT, "색상 형식이 올바르지 않아요.");
            }
            user.setAvatarColor(color);
        }
        if (req.avatar() != null) {
            // 아이콘 아바타(예: "ph:game-controller"). 빈 문자열이면 해제(이니셜 폴백). 너무 길면 비정상 입력이라 무시.
            String av = req.avatar().trim();
            if (av.isEmpty()) user.setAvatar(null);
            else if (av.length() <= 30) user.setAvatar(av);
        }
        if (req.birthday() != null) {
            if (req.birthday().isAfter(java.time.LocalDate.now())) {
                throw new ApiException(ErrorCode.INVALID_INPUT, "생일은 미래일 수 없어요.");
            }
            boolean wasEmpty = user.getBirthday() == null;
            user.setBirthday(req.birthday());
            // 생일을 처음 채우면, 커플 상대에게 '이제 궁합 볼 수 있어요' 알림(요청→충족 루프).
            if (wasEmpty) {
                coupleRepository.findByMember(userId).ifPresent(couple -> {
                    User partner = partnerOf(couple, userId);
                    if (partner != null) notificationService.onSajuCompatibilityReady(user, partner);
                });
            }
        }
        return UserSummary.of(user);
    }

    public User getUser(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(ErrorCode.USER_NOT_FOUND));
    }

    private User partnerOf(Couple c, Long userId) {
        if (c.getUser1().getId().equals(userId)) return c.getUser2();
        if (c.getUser2().getId().equals(userId)) return c.getUser1();
        return null;
    }

    /**
     * 계정 삭제 (Apple 5.1.1(v) 필수). 내 계정과 관련 데이터를 하나의 트랜잭션에서 FK 안전 순서로 하드 삭제한다.
     *
     * 커플이 있으면 커플 범위 공유 데이터(오늘의 질문/답/하트/댓글/신고/설정, 일기 day/entry/사진/답/댓글,
     * 캘린더 마커, 장소 별명)를 먼저 지우고 커플을 삭제한다. couple은 user1/user2 NOT NULL FK라 유저보다 먼저 정리.
     * 상대 유저 레코드는 남기되, 커플이 사라져 '미연결' 상태가 된다.
     *
     * 삭제 순서(자식 → 부모)를 지키지 않으면 FK 위반이 난다.
     */
    @Transactional
    public void deleteAccount(Long userId) {
        User user = getUser(userId);

        // Apple 로그인 유저면 Apple 토큰 revoke(5.1.1v). 실패해도 계정 삭제는 계속 진행.
        if (user.getAppleRefreshToken() != null) {
            appleClient.revoke(user.getAppleRefreshToken());
        }

        coupleRepository.findByMember(userId).ifPresent(couple -> {
            Long coupleId = couple.getId();

            // ── 오늘의 질문(편지) 트리: reaction → answer/comment → daily_question ──
            List<DailyQuestion> dailyQuestions = dailyQuestionRepository.findByCouple_Id(coupleId);
            List<Long> dqIds = dailyQuestions.stream().map(DailyQuestion::getId).toList();
            if (!dqIds.isEmpty()) {
                List<QuestionAnswer> answers = questionAnswerRepository.findByDailyQuestion_IdIn(dqIds);
                List<Long> answerIds = answers.stream().map(QuestionAnswer::getId).toList();
                if (!answerIds.isEmpty()) {
                    questionReactionRepository.deleteByAnswer_IdIn(answerIds);
                }
                questionCommentRepository.deleteByDailyQuestion_IdIn(dqIds);
                questionAnswerRepository.deleteByDailyQuestion_IdIn(dqIds);
            }
            // chosen_by(user FK)까지 포함해 커플의 daily_question 전부 삭제.
            dailyQuestionRepository.deleteByCouple_Id(coupleId);
            questionReportRepository.deleteByCouple_Id(coupleId);
            questionSettingRepository.deleteByCouple_Id(coupleId);

            // ── 일기 트리: photo/entry_answer → entry → comment → day ──
            List<DiaryDay> days = diaryDayRepository.findByCouple_Id(coupleId);
            List<Long> dayIds = days.stream().map(DiaryDay::getId).toList();
            if (!dayIds.isEmpty()) {
                List<DiaryEntry> entries = diaryEntryRepository.findByDay_IdIn(dayIds);
                List<Long> entryIds = entries.stream().map(DiaryEntry::getId).toList();
                if (!entryIds.isEmpty()) {
                    photoRepository.deleteByEntry_IdIn(entryIds);
                    entryAnswerRepository.deleteByEntry_IdIn(entryIds);
                    // entry는 element collection(locations, locationPoints)을 가지므로 엔티티 삭제로 정리.
                    diaryEntryRepository.deleteAll(entries);
                }
                commentRepository.deleteByDay_IdIn(dayIds);
                // day는 element collection(questionIds)을 가지므로 엔티티 삭제로 정리.
                diaryDayRepository.deleteAll(days);
            }

            // 커플 범위 기타 데이터.
            calendarMarkRepository.deleteByCouple_Id(coupleId);
            placeNicknameRepository.deleteByCouple_Id(coupleId);
            // 월드컵 결과(양쪽 멤버 것 모두) — couple FK라 커플 삭제 전에 정리.
            worldcupResultRepository.deleteByCouple_Id(coupleId);

            // 마지막으로 커플 삭제 → 상대는 '미연결' 상태가 된다.
            coupleRepository.delete(couple);
        });

        // 내 알림 삭제.
        notificationRepository.deleteByRecipient_Id(userId);

        // 내 푸시 토큰 삭제.
        pushTokenRepository.deleteByUser_Id(userId);

        // 마지막으로 User 삭제.
        userRepository.delete(user);
    }
}
