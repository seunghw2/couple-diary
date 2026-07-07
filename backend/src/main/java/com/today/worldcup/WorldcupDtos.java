package com.today.worldcup;

import jakarta.validation.constraints.NotNull;

import java.util.List;
import java.util.Map;

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

    /**
     * 결과 저장 요청. winnerId + 라운드별 탈락 아이템 전체.
     * stages: 라운드사이즈(문자열) → 그 라운드에서 탈락한 아이템 id들. 예 {"1":[5],"2":[12],"4":[3,9],...}
     */
    public record ResultRequest(
            @NotNull Integer winnerId,
            @NotNull Map<Integer, List<Integer>> stages
    ) {}

    /** 내 기록 한 건. */
    public record RecordView(
            Long id,
            ItemView winner,
            String playedAt
    ) {}

    /** 한 라운드(우승/결승/4강/…)에 놓인 아이템들. stage=1 우승 … 32 첫판 탈락. */
    public record StageGroup(int stage, String stageName, List<ItemView> items) {}

    /** 한 사람의 전체 여정. */
    public record Journey(ItemView winner, List<StageGroup> stages) {}

    /** 커플 비교 블록(둘 다 완주했을 때만). */
    public record CompareView(
            Journey me,
            Journey partner,
            String partnerNickname,
            boolean sameWinner,
            int matchRate,             // 8강 이상 겹침 기반 취향 일치율(%)
            List<ItemView> sharedTop8  // 둘 다 8강 이상에 올린 아이템
    ) {}

    /** 기록 화면 응답: 내 기록 + (가능하면) 커플 비교. */
    public record RecordsResponse(
            String key,
            String title,
            List<RecordView> myRecords,
            CompareView compare
    ) {}
}
