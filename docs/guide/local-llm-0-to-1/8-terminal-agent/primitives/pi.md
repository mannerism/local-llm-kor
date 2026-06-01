---
tags: [tool, coding-agent, terminal]
last_updated: 2026-05-10
---

# Pi
![[Xnip2026-05-10_19-30-12.png]]
## 이게 뭐예요?
**최소 터미널 코딩 harness예요.** 다른 도구들이 "기능 풀세트"를 제공한다면 Pi는 **"primitives, not features"** 철학으로 미니멀하게 시작해서 본인 워크플로에 맞춰 확장하는 접근입니다.

- 공식: https://pi.dev
- 라이선스: MIT
- 만든 곳: Earendil Inc.

## 강점

- **미니멀 — 본인이 원하는 만큼만 빌드**
- **TypeScript 확장 가능** — extensions, skills, prompt templates, themes 다 커스텀
- **4가지 동작 모드**:
  - 인터랙티브 TUI
  - print/JSON 출력 (CI·자동화 용)
  - RPC
  - SDK (다른 도구에 임베드)
- **트리 구조 세션 히스토리** — 대화를 트리로 분기·병합
- **15+ provider** + **custom provider 직접 추가 가능** ← llama-server 직접 연결 OK
- **Mid-session 모델 전환** — 대화 중 모델 바꾸기

## 약점

- **러닝 커브** — "다 직접 빌드"라 처음엔 황량함
- **사용자 베이스 작음** — 신생 도구
- **plan mode·permission system 같은 사전 빌드 기능 없음** — 직접 만들어야 함
## 우리가 Pi를 고른 이유

Pi가 후보 중에서 **가장 미니멀하고, 개발이 깔끔하게 잘 된 느낌**이라서 골랐어요. OpenCode를 잠깐 써봤는데 코드베이스에 쓸데없는 게 덕지덕지 붙어 있어서 살짝 무겁고 느리다는 인상을 받았어요. Pi는 그 반대로, **필요한 걸 하나씩 직접 붙여 가는 구조**라 그 과정에서 배우는 것도 많을 거라고 봅니다. 그래서 이 시리즈는 Pi로 갑니다.
