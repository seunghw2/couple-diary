package com.today.push;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Expo 푸시 발송기. 알림 생성 시 수신자의 모든 기기에 원격 푸시를 보낸다(앱이 꺼져 있어도 도착).
 * 발송은 @Async — 알림 저장 트랜잭션을 네트워크 대기로 붙잡지 않도록 별도 스레드에서 실행하고,
 * 실패해도 앱 흐름에 영향이 없게 조용히 로깅만 한다.
 * 참고: https://docs.expo.dev/push-notifications/sending-notifications/
 */
@Slf4j
@Component
public class PushSender {

    private final PushTokenRepository pushTokenRepository;
    private final RestClient expoClient = RestClient.builder()
            .baseUrl("https://exp.host")
            .build();

    public PushSender(PushTokenRepository pushTokenRepository) {
        this.pushTokenRepository = pushTokenRepository;
    }

    /** 특정 유저의 모든 기기에 푸시 발송. data는 알림 탭 시 딥링크용(type/refKey/entryDate 등). */
    @Async
    @Transactional
    public void sendToUser(Long userId, String title, String body, Map<String, Object> data) {
        List<PushToken> tokens = pushTokenRepository.findByUser_Id(userId);
        if (tokens.isEmpty()) return;

        List<Map<String, Object>> messages = new ArrayList<>();
        for (PushToken t : tokens) {
            Map<String, Object> m = new HashMap<>();
            m.put("to", t.getToken());
            m.put("title", title);
            m.put("body", body);
            m.put("sound", "default");
            if (data != null && !data.isEmpty()) m.put("data", data);
            messages.add(m);
        }

        try {
            ExpoPushResponse resp = expoClient.post()
                    .uri("/--/api/v2/push/send")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(messages)
                    .retrieve()
                    .body(ExpoPushResponse.class);
            cleanupInvalidTokens(tokens, resp);
        } catch (Exception e) {
            log.warn("[push] 발송 실패 userId={} : {}", userId, e.getMessage());
        }
    }

    /** 더 이상 유효하지 않은 토큰(앱 삭제·재설치 등)은 정리해 다음 발송 낭비를 막는다. */
    private void cleanupInvalidTokens(List<PushToken> tokens, ExpoPushResponse resp) {
        if (resp == null || resp.data() == null) return;
        List<Ticket> tickets = resp.data();
        for (int i = 0; i < tickets.size() && i < tokens.size(); i++) {
            Ticket t = tickets.get(i);
            if (t != null && "error".equals(t.status())
                    && t.details() != null && "DeviceNotRegistered".equals(t.details().error())) {
                pushTokenRepository.deleteByToken(tokens.get(i).getToken());
            }
        }
    }

    // Expo 응답(부분 매핑). Spring Boot 기본 Jackson은 미지의 필드를 무시.
    record ExpoPushResponse(List<Ticket> data) {}
    record Ticket(String status, String id, String message, Details details) {}
    record Details(String error) {}
}
