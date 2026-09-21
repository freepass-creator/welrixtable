# 프로모션 복귀 동선

- 모바일 견적기 상단 왼쪽 화살표는 프로모션으로 복귀한다.
- `returnCar`에 허용된 25차종 이름이 있으면 해당 프로모션 상세로, 없으면 목록으로 이동한다.
- 목적지는 `https://welrix-rent.web.app/`로 고정하며 외부 redirect URL은 받지 않는다.
- 프로모션은 `/mobile.html?force=mobile&from=promotion`으로 연결하고 기존 b/m/t를 유지한다.
- 320/390/1280px 목록→견적→목록, 차량 상세→견적→같은 상세, 직접 진입, 잘못된 복귀값, 헤더 겹침 검증 PASS.
- 빌드 및 quote contract 검사 PASS. Cursor 자문은 고정 목적지/allowlist 방향에 동의. Claude/Gemini는 앞선 인증 장애로 UNAVAILABLE이며 검토 PASS가 아니다.
