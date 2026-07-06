package com.today.question;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface QuestionSettingRepository extends JpaRepository<QuestionSetting, Long> {

    Optional<QuestionSetting> findByCouple_Id(Long coupleId);

    // 계정 삭제: 커플의 질문 설정 제거.
    void deleteByCouple_Id(Long coupleId);
}
