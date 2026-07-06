package com.today.question.admin;

import com.today.question.admin.QuestionGenerator.GeneratedQuestion;
import org.springframework.stereotype.Component;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * 배치 생성물 자동 필터(문서 25 §5-c). 통과분만 풀에 저장한다.
 * <ul>
 *   <li>중복 text 제거(배치 내 + 기존 풀 대비)</li>
 *   <li>길이 8~60자</li>
 *   <li>물음표('?')로 종결</li>
 *   <li>금칙어 간단 차단</li>
 *   <li>tone/theme 유효성</li>
 * </ul>
 */
@Component
public class QuestionFilter {

    private static final int MIN_LEN = 8;
    private static final int MAX_LEN = 60;

    private static final Set<String> VALID_TONES = Set.of("deep", "light", "fun", "context");
    private static final Set<String> VALID_THEMES = Set.of(
            "오늘/일상", "취향/선호", "서로 관찰하기", "작은 가치관", "나라는 사람",
            "다정한 부탁", "추억/함께한 시간", "마음/애정표현", "미래/약속",
            "관계 돌아보기", "상상/놀이", "맥락/기념");

    /** 금칙어(간단 차단). */
    private static final List<String> BANNED = List.of(
            "섹스", "성관계", "야한", "정치", "종교", "죽어", "혐오", "욕설");

    /**
     * 통과분만 반환. {@code existingTexts}는 기존 풀의 text(중복 제거용).
     */
    public List<GeneratedQuestion> filter(List<GeneratedQuestion> raw, Set<String> existingTexts) {
        List<GeneratedQuestion> passed = new java.util.ArrayList<>();
        Set<String> seen = new LinkedHashSet<>(existingTexts);
        for (GeneratedQuestion q : raw) {
            if (q == null || q.text() == null) continue;
            String text = q.text().trim();
            if (!accept(text, q)) continue;
            if (!seen.add(text)) continue; // 배치 내/기존 중복
            passed.add(new GeneratedQuestion(text, q.theme(), q.tone(),
                    q.depth() < 1 ? 1 : q.depth(), q.contextTrigger()));
        }
        return passed;
    }

    private boolean accept(String text, GeneratedQuestion q) {
        if (text.length() < MIN_LEN || text.length() > MAX_LEN) return false;
        if (!text.endsWith("?")) return false;
        if (q.tone() == null || !VALID_TONES.contains(q.tone())) return false;
        if (q.theme() == null || !VALID_THEMES.contains(q.theme())) return false;
        for (String bad : BANNED) {
            if (text.contains(bad)) return false;
        }
        return true;
    }
}
