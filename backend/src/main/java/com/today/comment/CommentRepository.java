package com.today.comment;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CommentRepository extends JpaRepository<Comment, Long> {

    List<Comment> findByDay_IdOrderByCreatedAtAsc(Long dayId);
}
