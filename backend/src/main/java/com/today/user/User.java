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
                @UniqueConstraint(name = "uk_user_kakao_id", columnNames = "kakao_id")
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

    @Column
    private LocalDate birthday;

    @Column(name = "invite_code", nullable = false)
    private String inviteCode;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Builder
    public User(String email, String nickname, String avatarColor, String kakaoId, LocalDate birthday, String inviteCode) {
        this.email = email;
        this.nickname = nickname;
        this.avatarColor = avatarColor;
        this.kakaoId = kakaoId;
        this.birthday = birthday;
        this.inviteCode = inviteCode;
    }

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
