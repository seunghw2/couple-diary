package com.today.couple;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface CoupleRepository extends JpaRepository<Couple, Long> {

    @Query("select c from Couple c where c.user1.id = :userId or c.user2.id = :userId")
    Optional<Couple> findByMember(@Param("userId") Long userId);

    boolean existsByUser1_IdOrUser2_Id(Long user1Id, Long user2Id);
}
