package com.today.report;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface BugReportRepository extends JpaRepository<BugReport, Long> {

    /** 전역 목록(커플 무관), 최신순. reporter는 조회 시 즉시 로드. */
    List<BugReport> findAllByOrderByCreatedAtDesc();
}
