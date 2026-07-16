# 출시 전 보안 심의 (2026-07-16)

## 방법
서브에이전트 3개가 병렬로: ①인가/IDOR/JWT 실침투(서로 다른 커플 2팀으로 교차 접근) ②비밀·설정·인프라 코드리뷰 ③인젝션/XSS/SSRF/남용(코드+라이브). 테스트 계정·데이터는 전량 정리.

## 총평
**출시 차단급(Critical) 결함 없음.**
- **IDOR/인가/권한상승/JWT 위조: 0건.** 커플1 토큰으로 커플2의 일기·댓글·알림·답변·월드컵·캘린더·사주 어디에도 접근/수정/삭제 불가(전부 401/403/404). JWT 위조(alg:none·sub조작·서명제거·다운그레이드) 전부 거부. 모든 요청이 JWT sub로만 사용자 식별 + 일관된 커플 스코프 + 숫자 id 소유권 재검증.
- **깃에 커밋된 실 시크릿 없음.** JWT·DB·카카오 client-secret·애플 키 전부 환경변수 주입, 약한 JWT면 부팅 차단.
- **SQLi 없음**(전 쿼리 @Param 바인딩), **SSRF 없음**(카카오 프록시 host/path 고정), **에러 정보노출 없음**(고정 메시지 마스킹).

## 수정 완료

| 심각도 | 문제 | 수정 | 재검증 |
|---|---|---|---|
| High | prod CORS가 개발용 origin(`exp://*`, `*.trycloudflare.com`, localhost)까지 credentials 허용 | prod 프로파일 CORS를 서비스 도메인만으로 축소(`CORS_ORIGINS` env로 override 가능) | trycloudflare origin → 허용헤더 없음(차단), 서비스도메인 → 허용 |
| High | 무제한 리스트로 DoS/대량삽입(answers 10만개 → 8.4초·10만행 저장) | UpsertEntryRequest 리스트 개수 상한(@Size: answers 50, photos 30, locations 30, questionIds 20) | answers 10만개 → 400 |
| High | 카카오맵 WebView가 장소명을 인라인 `<script>`에 JSON 삽입 → `</script>` 태그 탈출 여지(저장형 XSS 실행 경로) | 삽입용 JSON을 `<`·`>` 이스케이프(safeJson)로 태그 탈출 차단 | 코드 반영(tsc 통과) |

## 보류(권고) — 후속 처리 대상

- **카카오 REST 키 하드코딩**(High): app.json·application.yml에 평문. OAuth client_id라 반쯤 공개값이지만, **콘솔에서 키 로테이션 + 환경변수 주입** 권장(코드만으론 완결 불가한 운영 작업).
- **사진 무인증 접근**(Medium): `/files/**`·`/api/photos/thumb`가 UUID 난독화로만 보호(공개 GET). 민감 사진이므로 **서명 URL 또는 소유권 게이트** 도입 권장. (현재는 랜덤 UUID로 추측 방어)
- **저장형 XSS 서버 무필터**(Medium, 잠재): mood·댓글·답장·feedback 등 자유텍스트를 서버가 필터 없이 저장. **현재 RN `<Text>`/WebView textContent 렌더라 실행 안 됨.** 자유텍스트를 입력단에서 전부 제거하면 "<3" 같은 정상 문자가 깨지므로, **출력 인코딩(현행)을 유지**하고 향후 HTML/메일/웹뷰 innerHTML 경로 추가 시 그 지점에서 이스케이프 필수(닉네임은 이미 서버 필터).
- **레이트리밋 전무**(Medium): connect·feedback·comment 등 쓰기 무제한. 스팸·무차별 방어용 IP/유저 레이트리밋(Bucket4j 등) 도입 권장.
- **JWT 서버측 폐기 불가**(Medium): 30일 TTL·무상태. `tokenVersion` 컬럼으로 계정삭제/강제로그아웃 시 즉시 무효화 권장. (현재 삭제 유저는 조회 null로 우연히 차단됨)
- **초대코드 응답 오라클**(Low): 실패 상태코드가 갈려 코드 존재여부 추정 가능. 키스페이스 36^8이라 실질 위험 낮음. 응답 통일 권장.
- **기타 Low**: admin 토큰 상수시간 비교, prod `ddl-auto:update`→validate, 업로드 매직바이트 검증.

## 정리
보안 테스트용 계정·커플·데이터는 전량 삭제(사용자 수 원복). 실사용 데이터 영향 없음.
