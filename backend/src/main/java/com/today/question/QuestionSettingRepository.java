package com.today.question;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface QuestionSettingRepository extends JpaRepository<QuestionSetting, Long> {

    Optional<QuestionSetting> findByCouple_Id(Long coupleId);
}
