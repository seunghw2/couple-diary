package com.today.question;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.type.CollectionType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * 오늘의 질문 풀({@link QuestionPool}) 시드.
 *
 * <p>{@code question-seed.json}이 있으면 <b>text 기준 upsert</b>: 같은 text가 있으면 태그
 * (theme/tone/depth/contextTrigger/isTemplate) 갱신 + active=true, 없으면 insert(source='seed').
 * JSON에 없는 기존 source='seed' 행은 삭제하지 않고 active=false 로만 내린다(FK 보존).</p>
 *
 * <p>JSON이 없으면 기존 동작(풀이 비었을 때만 하드코딩 시드 삽입)을 유지한다.</p>
 * (별개 '20문답' 시더 {@code com.today.config.QuestionSeeder}와 무관.)
 */
@Slf4j
@Order(2)
@Component
@RequiredArgsConstructor
public class QuestionPoolSeeder implements CommandLineRunner {

    private static final String SEED_JSON = "question-seed.json";

    private final QuestionPoolRepository poolRepository;
    private final ObjectMapper objectMapper;

    /** question-seed.json 한 항목. */
    record SeedRow(String text, String theme, String tone, Integer depth,
                  String contextTrigger, Boolean isTemplate) {}

    @Override
    public void run(String... args) {
        List<SeedRow> rows = loadSeedJson();
        if (rows != null) {
            upsertFromJson(rows);
        } else if (poolRepository.count() == 0) {
            legacySeed();
        }
    }

    private List<SeedRow> loadSeedJson() {
        ClassPathResource resource = new ClassPathResource(SEED_JSON);
        if (!resource.exists()) return null;
        try (InputStream in = resource.getInputStream()) {
            CollectionType type = objectMapper.getTypeFactory()
                    .constructCollectionType(List.class, SeedRow.class);
            List<SeedRow> rows = objectMapper.readValue(in, type);
            return rows == null ? List.of() : rows;
        } catch (Exception e) {
            log.warn("Failed to read {} — skipping seed upsert", SEED_JSON, e);
            return null;
        }
    }

    private void upsertFromJson(List<SeedRow> rows) {
        Set<String> jsonTexts = new HashSet<>();
        int inserted = 0, updated = 0;

        for (SeedRow row : rows) {
            if (row == null || row.text() == null || row.text().isBlank()) continue;
            String text = row.text().trim();
            jsonTexts.add(text);
            int depth = row.depth() == null ? 1 : row.depth();

            QuestionPool existing = poolRepository.findFirstByText(text).orElse(null);
            if (existing != null) {
                existing.setTheme(row.theme());
                existing.setTone(row.tone());
                existing.setDepth(depth < 1 ? 1 : depth);
                existing.setContextTrigger(row.contextTrigger());
                existing.setTemplate(row.isTemplate() != null && row.isTemplate());
                existing.setActive(true);
                updated++;
            } else {
                poolRepository.save(QuestionPool.builder()
                        .text(text)
                        .theme(row.theme())
                        .tone(row.tone())
                        .depth(depth)
                        .contextTrigger(row.contextTrigger())
                        .isTemplate(row.isTemplate() != null && row.isTemplate())
                        .active(true)
                        .source("seed")
                        .build());
                inserted++;
            }
        }

        // JSON에 없는 기존 seed 행은 비활성(삭제 금지 — FK 보존).
        int deactivated = 0;
        for (QuestionPool p : poolRepository.findBySource("seed")) {
            if (p.isActive() && !jsonTexts.contains(p.getText())) {
                p.setActive(false);
                deactivated++;
            }
        }

        log.info("Seed upsert from {}: inserted={}, updated={}, deactivated={}",
                SEED_JSON, inserted, updated, deactivated);
    }

    /** 시드 JSON이 없을 때의 기존 하드코딩 시드(풀이 비었을 때만). */
    private void legacySeed() {
        List<QuestionPool> seed = new ArrayList<>();
        // category ∈ 일상/추억/미래/마음/취향, depth 1(가벼움)~3(깊음)
        add(seed, "우리가 처음 만난 날, 솔직한 첫인상은?", "추억", 2);
        add(seed, "요즘 나를 가장 웃게 한 순간은?", "일상", 1);
        add(seed, "오늘 하루 중 제일 좋았던 순간은?", "일상", 1);
        add(seed, "서로에게 가장 고마웠던 순간은?", "마음", 2);
        add(seed, "우리가 같이 가고 싶은 여행지 하나만 꼽는다면?", "미래", 1);
        add(seed, "10년 뒤 우리는 어디서 뭘 하고 있을까?", "미래", 3);
        add(seed, "내가 요즘 가장 스트레스 받는 건 뭘까 맞혀봐", "마음", 2);
        add(seed, "최근에 내가 한 말 중 기억에 남는 게 있어?", "추억", 2);
        add(seed, "우리 관계에서 제일 소중한 게 뭐라고 생각해?", "마음", 3);
        add(seed, "다시 태어나도 나를 만날 거야?", "마음", 2);
        add(seed, "네가 생각하는 나의 가장 큰 매력은?", "마음", 2);
        add(seed, "오늘 나에게 해주고 싶은 말이 있다면?", "마음", 1);
        add(seed, "우리 100일 때로 돌아간다면 뭘 하고 싶어?", "추억", 2);
        add(seed, "요즘 내가 예전과 달라진 점이 있을까?", "마음", 2);
        add(seed, "같이 살면 꼭 지키고 싶은 규칙 하나는?", "미래", 2);
        add(seed, "내가 아플 때 네가 해줬으면 하는 건?", "마음", 2);
        add(seed, "우리만 아는 웃긴 추억 하나 말해줘", "추억", 1);
        add(seed, "네가 힘들 때 나한테 바라는 건?", "마음", 3);
        add(seed, "서로에게 새로 도전해보고 싶은 게 있어?", "미래", 2);
        add(seed, "가장 최근에 내 생각이 났던 순간은?", "일상", 1);
        add(seed, "우리 사이 애칭을 새로 짓는다면?", "취향", 1);
        add(seed, "내가 해준 것 중 가장 기억에 남는 건?", "추억", 2);
        add(seed, "요즘 우리에게 필요한 건 뭘까?", "마음", 3);
        add(seed, "네가 나에게 미안했던 적이 있어?", "마음", 3);
        add(seed, "오늘 못다 한 말이 있다면?", "일상", 1);
        add(seed, "우리 첫 데이트를 한 단어로 표현하면?", "추억", 1);
        add(seed, "내가 어떤 사람으로 남고 싶은지 알아?", "마음", 3);
        add(seed, "같이 늙어간다는 건 너에게 어떤 의미야?", "미래", 3);
        add(seed, "네가 요즘 가장 바라는 소원은?", "마음", 2);
        add(seed, "우리가 함께한 시간 중 다시 살고 싶은 하루는?", "추억", 2);

        poolRepository.saveAll(seed);
        log.info("Seeded {} daily question pool entries (legacy)", seed.size());
    }

    private void add(List<QuestionPool> list, String text, String category, int depth) {
        list.add(QuestionPool.builder()
                .text(text)
                .category(category)
                .depth(depth)
                .active(true)
                .source("seed")
                .build());
    }
}
