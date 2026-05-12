# Local LLM 가이드

> **맥북에서 로컬 LLM 굴리기** — M4 Max 맥북으로 Claude Code 대용 로컬 LLM 환경을 만드는 한국어 입문 가이드.

📖 **사이트**: _배포 준비 중 (Vercel)_

---

## 누구를 위한 가이드인가요?

- 맥북(특히 **M4 Max**)에서 **Claude Code 대용**으로 로컬 LLM 을 굴려 보고 싶으신 분
- 터미널·llama.cpp·모델 파일이 생소한 **입문자** — "한국 중학생도 따라올 수 있는 수준" 을 목표로 썼어요
- 모델 이름 읽기, 속도 결정 요인, MTP 같은 개념도 비유로 풀어서 설명합니다
- 영어로 된 r/LocalLLaMA·Hugging Face 글을 매번 번역해 읽는 게 번거로우신 분

## 시리즈 구성 (9편)

| #   | 제목               | 다루는 것                                             |
| --- | ------------------ | ----------------------------------------------------- |
| 1   | 사전 준비          | WezTerm + Homebrew 환경 셋업                          |
| 2   | llama.cpp 설치     | Homebrew 로 추론 엔진 깔기                            |
| 3   | llama.cpp vs MLX   | 두 엔진 비교, 왜 llama.cpp 로 갔는지                  |
| 4   | 모델 이름 읽기     | `Qwen3.6-27B-Instruct-Q5_K_M.gguf` 같은 이름 해석법   |
| 5   | 속도 결정 요인     | 메모리 대역폭·KV 캐시·양자화가 속도를 어떻게 바꾸는지 |
| 6   | 모델 고르기        | Qwen 3.6 27B MTP 선택 이유                            |
| 7   | 빌드·다운로드·실행 | llama.cpp PR 빌드, 모델 받기, MTP 가속                |
| 8   | 터미널 에이전트    | Pi 셋업, llama-server 원격 연결, 속도 최적화          |
| 9   | Qwen 3.6 35B A3B   | 듀얼 모델 운영 (품질 vs 속도)                         |

각 편은 **결정 지점마다 "왜 이걸 골랐는지"** 한 문단을 같이 둡니다. 명령조로 던지지 않아요.

## 기여하기

오타·표현 보완·새 편·번역 모두 환영합니다.

가장 빠른 길:

1. 사이트에서 고치고 싶은 페이지 열기
2. 페이지 하단 **"이 페이지를 GitHub에서 수정하기"** 클릭
3. GitHub 웹 에디터에서 바로 수정 → PR

더 깊은 기여(새 편 추가, primitive 만들기, 톤·구조 변경 등) 는 [CONTRIBUTING.md](./CONTRIBUTING.md) 를 먼저 읽어주세요. 글의 톤·문체·구조 규칙(존댓말, 비유, "왜 이걸 골랐는지" 한 문단)도 거기 정리돼 있어요.

PR 제출 시 [기여자 라이선스 동의(CLA)](./CONTRIBUTING.md#3-라이선스-및-기여자-동의-중요) 에 동의하시는 것으로 간주됩니다.

## 만들어진 도구

- 사이트: [VitePress](https://vitepress.dev/) (Vue 기반 정적 사이트 생성기)
- 호스팅: Vercel (예정)
- 본문 소스: 메인테이너의 Obsidian vault → `scripts/sync.mjs` 로 `docs/guide/` 에 미러링

> 메인테이너가 vault 에서 글을 쓰고 `pnpm sync --forward` 로 repo 에 반영합니다. PR 로 들어온 기여는 `pnpm sync --reverse` 로 파일별 승인 후 vault 에 역동기화돼요. 자세한 흐름은 [CONTRIBUTING.md](./CONTRIBUTING.md) 의 "콘텐츠 흐름" 섹션 참고.

## 라이선스

- 코드 (`scripts/`, `docs/.vitepress/`, 빌드 도구) — [MIT](./LICENSE)
- 본문·이미지 (`docs/guide/**`) — [CC BY-SA 4.0](./LICENSE-CONTENT)

상업 출판·강의 패키지 등 별도 라이선스가 필요하시면 <dearmannerism@gmail.com> 으로 연락주세요.

---

© 2026 디어매너리즘 (Dear Mannerism)
