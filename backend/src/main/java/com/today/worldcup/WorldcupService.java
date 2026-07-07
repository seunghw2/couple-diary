package com.today.worldcup;

import com.today.common.ApiException;
import com.today.common.ErrorCode;
import com.today.couple.Couple;
import com.today.couple.CoupleService;
import com.today.notification.NotificationService;
import com.today.user.User;
import com.today.worldcup.WorldcupCatalog.Cup;
import com.today.worldcup.WorldcupDtos.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class WorldcupService {

    private final CoupleService coupleService;
    private final WorldcupResultRepository resultRepository;
    private final NotificationService notificationService;

    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("yyyy.MM.dd");
    /** 표시 순서와 이름. */
    private static final int[] STAGE_ORDER = {1, 2, 4, 8, 16, 32};
    private static final Map<Integer, String> STAGE_NAME = Map.of(
            1, "우승", 2, "결승", 4, "4강", 8, "8강", 16, "16강", 32, "32강");
    /** 8강 이상 = 상위권(취향 일치율 기준). */
    private static final Set<Integer> TOP8_STAGES = Set.of(1, 2, 4, 8);

    @Transactional(readOnly = true)
    public List<CupSummary> list(Long userId) {
        Couple couple = coupleService.requireCouple(userId);
        User partner = partnerOf(couple, userId);

        Set<String> myPlayed = resultRepository.findByAuthor_Id(userId).stream()
                .map(WorldcupResult::getWorldcupKey).collect(Collectors.toSet());
        Set<String> partnerPlayed = partner == null ? Set.of()
                : resultRepository.findByAuthor_Id(partner.getId()).stream()
                        .map(WorldcupResult::getWorldcupKey).collect(Collectors.toSet());

        return WorldcupCatalog.all().stream()
                .map(c -> new CupSummary(c.key(), c.title(), c.emoji(), c.size(),
                        myPlayed.contains(c.key()), partnerPlayed.contains(c.key())))
                .toList();
    }

    @Transactional(readOnly = true)
    public CupDetail detail(Long userId, String key) {
        coupleService.requireCouple(userId);
        Cup cup = requireCup(key);
        List<ItemView> items = cup.items().stream().map(ItemView::of).toList();
        return new CupDetail(cup.key(), cup.title(), cup.emoji(), cup.size(), items);
    }

    @Transactional
    public void saveResult(Long userId, String key, ResultRequest req) {
        Couple couple = coupleService.requireCouple(userId);
        User me = memberOf(couple, userId);
        Cup cup = requireCup(key);

        if (WorldcupCatalog.item(key, req.winnerId()) == null) {
            throw new ApiException(ErrorCode.INVALID_INPUT, "우승 후보가 올바르지 않아요.");
        }
        String stages = formatStages(key, req.stages());
        if (stages.isEmpty()) throw new ApiException(ErrorCode.INVALID_INPUT, "진행 정보가 올바르지 않아요.");

        resultRepository.save(WorldcupResult.builder()
                .author(me)
                .couple(couple)
                .worldcupKey(cup.key())
                .winnerId(req.winnerId())
                .stages(stages)
                .build());

        // 완주 알림 → 상대에게(완료할 때마다). 상대 설정의 월드컵 배지에 반영된다.
        User partner = partnerOf(couple, userId);
        String winnerLabel = WorldcupCatalog.item(key, req.winnerId()).label();
        notificationService.onWorldcupCompleted(me, partner, cup.title(), winnerLabel);
    }

    /** 설정 월드컵 배지 = 아직 안 본 상대 완주 수. */
    @Transactional(readOnly = true)
    public long unseenCount(Long userId) {
        return notificationService.countUnreadWorldcup(userId);
    }

    /** 월드컵 목록 열람 시 배지 초기화. */
    @Transactional
    public void markSeen(Long userId) {
        notificationService.markWorldcupSeen(userId);
    }

    @Transactional(readOnly = true)
    public RecordsResponse records(Long userId, String key) {
        Couple couple = coupleService.requireCouple(userId);
        User partner = partnerOf(couple, userId);
        Cup cup = requireCup(key);

        List<RecordView> myRecords = resultRepository
                .findByAuthor_IdAndWorldcupKeyOrderByCreatedAtDesc(userId, key).stream()
                .map(r -> new RecordView(r.getId(),
                        ItemView.of(WorldcupCatalog.item(key, r.getWinnerId())),
                        r.getCreatedAt().format(DATE)))
                .toList();

        CompareView compare = null;
        WorldcupResult mine = latest(couple.getId(), userId, key);
        WorldcupResult theirs = partner == null ? null : latest(couple.getId(), partner.getId(), key);
        if (mine != null && theirs != null) {
            Map<Integer, List<Integer>> myMap = parseStages(mine.getStages());
            Map<Integer, List<Integer>> pMap = parseStages(theirs.getStages());
            Set<Integer> myTop8 = top8(myMap), pTop8 = top8(pMap);
            Set<Integer> shared = new LinkedHashSet<>(myTop8);
            shared.retainAll(pTop8);
            compare = new CompareView(
                    journey(key, mine.getWinnerId(), myMap),
                    journey(key, theirs.getWinnerId(), pMap),
                    partner.getNickname(),
                    mine.getWinnerId() == theirs.getWinnerId(),
                    (int) Math.round(shared.size() * 100.0 / 8),
                    shared.stream().map(id -> ItemView.of(WorldcupCatalog.item(key, id))).toList());
        }

        return new RecordsResponse(cup.key(), cup.title(), myRecords, compare);
    }

    // ─────────────── helpers ───────────────

    private WorldcupResult latest(Long coupleId, Long authorId, String key) {
        return resultRepository
                .findTopByCouple_IdAndAuthor_IdAndWorldcupKeyOrderByCreatedAtDesc(coupleId, authorId, key)
                .orElse(null);
    }

    /** 한 사람의 여정을 stage 순서대로 그룹핑. */
    private Journey journey(String key, int winnerId, Map<Integer, List<Integer>> map) {
        List<StageGroup> groups = new ArrayList<>();
        for (int stage : STAGE_ORDER) {
            List<Integer> ids = map.get(stage);
            if (ids == null || ids.isEmpty()) continue;
            List<ItemView> items = ids.stream()
                    .map(id -> ItemView.of(WorldcupCatalog.item(key, id)))
                    .filter(java.util.Objects::nonNull).toList();
            if (!items.isEmpty()) groups.add(new StageGroup(stage, STAGE_NAME.get(stage), items));
        }
        return new Journey(ItemView.of(WorldcupCatalog.item(key, winnerId)), groups);
    }

    private Set<Integer> top8(Map<Integer, List<Integer>> map) {
        Set<Integer> out = new LinkedHashSet<>();
        for (int s : TOP8_STAGES) out.addAll(map.getOrDefault(s, List.of()));
        return out;
    }

    /** 요청 map을 검증·정리해 "stage:idCsv;..." 문자열로. 카탈로그에 없는 id는 버림. */
    private String formatStages(String key, Map<Integer, List<Integer>> map) {
        List<String> groups = new ArrayList<>();
        for (int stage : STAGE_ORDER) {
            List<Integer> ids = map.get(stage);
            if (ids == null) continue;
            Set<Integer> valid = new LinkedHashSet<>();
            for (Integer id : ids) {
                if (id != null && WorldcupCatalog.item(key, id) != null) valid.add(id);
            }
            if (!valid.isEmpty()) {
                groups.add(stage + ":" + valid.stream().map(String::valueOf).collect(Collectors.joining(",")));
            }
        }
        return String.join(";", groups);
    }

    private Map<Integer, List<Integer>> parseStages(String csv) {
        Map<Integer, List<Integer>> out = new LinkedHashMap<>();
        if (csv == null || csv.isBlank()) return out;
        for (String group : csv.split(";")) {
            String[] kv = group.split(":");
            if (kv.length != 2) continue;
            try {
                int stage = Integer.parseInt(kv[0].trim());
                List<Integer> ids = new ArrayList<>();
                for (String s : kv[1].split(",")) {
                    if (!s.isBlank()) ids.add(Integer.parseInt(s.trim()));
                }
                out.put(stage, ids);
            } catch (NumberFormatException ignored) {}
        }
        return out;
    }

    private Cup requireCup(String key) {
        Cup cup = WorldcupCatalog.get(key);
        if (cup == null) throw new ApiException(ErrorCode.NOT_FOUND, "없는 월드컵이에요.");
        return cup;
    }

    private User memberOf(Couple c, Long userId) {
        if (c.getUser1().getId().equals(userId)) return c.getUser1();
        if (c.getUser2().getId().equals(userId)) return c.getUser2();
        throw new ApiException(ErrorCode.FORBIDDEN);
    }

    private User partnerOf(Couple c, Long userId) {
        if (c.getUser1().getId().equals(userId)) return c.getUser2();
        if (c.getUser2().getId().equals(userId)) return c.getUser1();
        return null;
    }
}
