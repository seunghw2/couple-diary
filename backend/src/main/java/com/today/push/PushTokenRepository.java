package com.today.push;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PushTokenRepository extends JpaRepository<PushToken, Long> {

    Optional<PushToken> findByToken(String token);

    List<PushToken> findByUser_Id(Long userId);

    void deleteByToken(String token);

    // 로그아웃 등: 본인 소유 토큰만 해제(소유권 검증).
    void deleteByTokenAndUser_Id(String token, Long userId);

    // 계정 삭제 시 이 유저의 모든 토큰 제거.
    void deleteByUser_Id(Long userId);
}
