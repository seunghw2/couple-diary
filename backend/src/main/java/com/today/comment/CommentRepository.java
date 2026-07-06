package com.today.comment;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CommentRepository extends JpaRepository<Comment, Long> {

    List<Comment> findByDay_IdOrderByCreatedAtAsc(Long dayId);

    void deleteByDay_Id(Long dayId);

    // 계정 삭제: 여러 day에 달린 댓글 일괄 제거.
    void deleteByDay_IdIn(List<Long> dayIds);
}
