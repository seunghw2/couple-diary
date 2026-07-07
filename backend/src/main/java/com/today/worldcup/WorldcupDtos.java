package com.today.worldcup;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public class WorldcupDtos {

    /** 아이템(후보). */
    public record ItemView(int id, String label, String emoji) {
        static ItemView of(WorldcupCatalog.Item it) {
            return it == null ? null : new ItemView(it.id(), it.label(), it.emoji());
        }
    }

    /** 홈 목록 항목. myPlayed/partnerPlayed로 진행 상태 표시. */
    public record CupSummary(
            String key,
            String title,
            String emoji,
            int size,
            boolean myPlayed,
            boolean partnerPlayed
    ) {}

    /** 상세(진행용 아이템 포함). */
    public record CupDetail(
            String key,
            String title,
            String emoji,
            int size,
            List<ItemView> items
    ) {}

    /** 결과 저장 요청. winnerId + 4강 진출 id들. */
    public record ResultRequest(
            @NotNull Integer winnerId,
            @NotEmpty List<Integer> top4
    ) {}

    /** 내 기록 한 건. */
    public record RecordView(
            Long id,
            ItemView winner,
            String playedAt
    ) {}

    /** 커플 비교 블록(둘 다 완주했을 때만). */
    public record CompareView(
            ItemView myWinner,
            ItemView partnerWinner,
            String partnerNickname,
            boolean sameWinner,
            int matchRate   // 4강 겹침 기반 취향 일치율(%)
    ) {}

    /** 기록 화면 응답: 내 기록 + (가능하면) 커플 비교. */
    public record RecordsResponse(
            String key,
            String title,
            List<RecordView> myRecords,
            CompareView compare
    ) {}
}
