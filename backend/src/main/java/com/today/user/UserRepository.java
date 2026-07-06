package com.today.user;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmail(String email);

    Optional<User> findByKakaoId(String kakaoId);

    Optional<User> findByAppleId(String appleId);

    Optional<User> findByInviteCode(String inviteCode);

    boolean existsByInviteCode(String inviteCode);
}
