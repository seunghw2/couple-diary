package com.today.user;

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
@Table(name = "users",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_user_email", columnNames = "email"),
                @UniqueConstraint(name = "uk_user_invite_code", columnNames = "invite_code"),
                @UniqueConstraint(name = "uk_user_kakao_id", columnNames = "kakao_id"),
                @UniqueConstraint(name = "uk_user_apple_id", columnNames = "apple_id")
        })
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String email;

    @Column(nullable = false)
    private String nickname;

    @Column(name = "avatar_color")
    private String avatarColor;

    /** 카카오 회원번호(문자열 보관). 카카오로 로그인한 유저만 채워진다. */
    @Column(name = "kakao_id")
    private String kakaoId;

    /** Apple 고유 사용자 식별자(sub). Apple로 로그인한 유저만 채워진다. */
    @Column(name = "apple_id")
    private String appleId;

    /** Apple refresh token — 계정 삭제 시 Apple 토큰 revoke(5.1.1v)에 사용. 키 설정 시에만 저장. */
    @Column(name = "apple_refresh_token", length = 512)
    private String appleRefreshToken;

    @Column
    private LocalDate birthday;

    /** 태어난 시각(0~23시). 사주 시주 계산용, 선택 입력. null이면 시주 제외. */
    @Column(name = "birth_time")
    private Integer birthTime;

    @Column(name = "invite_code", nullable = false)
    private String inviteCode;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    /** 권한. null/USER=일반, ADMIN=슈퍼 관리자. */
    @Enumerated(EnumType.STRING)
    @Column(name = "role", length = 20)
    private UserRole role;

    /** 슈퍼 관리자 여부(null=일반). */
    public boolean isAdmin() {
        return role == UserRole.ADMIN;
    }

    @Builder
    public User(String email, String nickname, String avatarColor, String kakaoId, String appleId, LocalDate birthday, String inviteCode) {
        this.email = email;
        this.nickname = nickname;
        this.avatarColor = avatarColor;
        this.kakaoId = kakaoId;
        this.appleId = appleId;
        this.birthday = birthday;
        this.inviteCode = inviteCode;
    }

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
