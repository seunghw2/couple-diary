package com.today.worldcup;

import com.today.common.ApiException;
import com.today.common.ErrorCode;
import com.today.couple.Couple;
import com.today.couple.CoupleService;
import com.today.user.User;
import com.today.worldcup.WorldcupCatalog.Cup;
import com.today.worldcup.WorldcupDtos.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class WorldcupService {

    private final CoupleService coupleService;
    private final WorldcupResultRepository resultRepository;

    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("yyyy.MM.dd");

    /** 홈 목록. 내/상대 완주 여부 포함. */
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

    /** 진행용 상세(아이템 포함). */
    @Transactional(readOnly = true)
    public CupDetail detail(Long userId, String key) {
        coupleService.requireCouple(userId); // 커플 연결 필요(결과 저장/비교 위해)
        Cup cup = requireCup(key);
        List<ItemView> items = cup.items().stream().map(ItemView::of).toList();
        return new CupDetail(cup.key(), cup.title(), cup.emoji(), cup.size(), items);
    }

    /** 완주 결과 저장. winnerId·top4를 카탈로그로 검증. */
    @Transactional
    public void saveResult(Long userId, String key, ResultRequest req) {
        Couple couple = coupleService.requireCouple(userId);
        User me = memberOf(couple, userId);
        Cup cup = requireCup(key);

        if (WorldcupCatalog.item(key, req.winnerId()) == null) {
            throw new ApiException(ErrorCode.INVALID_INPUT, "우승 후보가 올바르지 않아요.");
        }
        // 4강 id들 검증·중복 제거(순서 유지).
        Set<Integer> top4 = new LinkedHashSet<>();
        for (Integer id : req.top4()) {
            if (id != null && WorldcupCatalog.item(key, id) != null) top4.add(id);
        }
        if (top4.isEmpty()) throw new ApiException(ErrorCode.INVALID_INPUT, "4강 정보가 올바르지 않아요.");

        resultRepository.save(WorldcupResult.builder()
                .author(me)
                .couple(couple)
                .worldcupKey(cup.key())
                .winnerId(req.winnerId())
                .top4(top4.stream().map(String::valueOf).collect(Collectors.joining(",")))
                .build());
    }

    /** 내 기록 + (둘 다 완주 시) 커플 비교. */
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
        WorldcupResult mine = resultRepository
                .findTopByCouple_IdAndAuthor_IdAndWorldcupKeyOrderByCreatedAtDesc(couple.getId(), userId, key)
                .orElse(null);
        WorldcupResult theirs = partner == null ? null : resultRepository
                .findTopByCouple_IdAndAuthor_IdAndWorldcupKeyOrderByCreatedAtDesc(couple.getId(), partner.getId(), key)
                .orElse(null);
        if (mine != null && theirs != null) {
            compare = new CompareView(
                    ItemView.of(WorldcupCatalog.item(key, mine.getWinnerId())),
                    ItemView.of(WorldcupCatalog.item(key, theirs.getWinnerId())),
                    partner.getNickname(),
                    mine.getWinnerId() == theirs.getWinnerId(),
                    matchRate(mine.getTop4(), theirs.getTop4()));
        }

        return new RecordsResponse(cup.key(), cup.title(), myRecords, compare);
    }

    // ── 취향 일치율: 두 4강 집합의 겹침 / 합집합 대비가 아니라, 더 작은 4강 크기 대비 겹침(%) ──
    private int matchRate(String a, String b) {
        Set<Integer> sa = parseIds(a), sb = parseIds(b);
        if (sa.isEmpty() || sb.isEmpty()) return 0;
        Set<Integer> inter = new LinkedHashSet<>(sa);
        inter.retainAll(sb);
        int base = Math.min(sa.size(), sb.size());
        return (int) Math.round(inter.size() * 100.0 / base);
    }

    private Set<Integer> parseIds(String csv) {
        Set<Integer> out = new LinkedHashSet<>();
        if (csv == null || csv.isBlank()) return out;
        for (String s : csv.split(",")) {
            try { out.add(Integer.parseInt(s.trim())); } catch (NumberFormatException ignored) {}
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
