# Local LLM 가이드

> **맥북에서 로컬 LLM 굴리기** — M4 Max 맥북으로 Claude Code 대용 로컬 LLM 환경을 만드는 한국어 입문 가이드.

배포 사이트: _(준비 중 — Vercel)_

## 무엇인가요?

- M4 Max 맥북에서 로컬 LLM을 셋업·운영하는 9편짜리 시리즈입니다.
- 대상: **한국 중학생 수준에서 따라올 수 있는 입문자**.
- 톤: 존댓말 해요체 + 합쇼체 섞기. 전문 용어는 비유로 풀어쓰기.
- 형식: VitePress로 빌드되는 정적 사이트. 누구나 GitHub에서 PR로 기여 가능.

## 시리즈 구성

1. **사전 준비** — WezTerm + Homebrew 환경 셋업
2. **llama.cpp 설치**
3. **llama.cpp vs MLX** — 추론 엔진 비교
4. **모델 이름 읽는 법**
5. **속도 결정 요인**
6. **모델 고르기** — Qwen 3.6 27B MTP
7. **빌드·다운로드·실행**
8. **터미널 에이전트** — Pi 셋업 + 원격 연결
9. **Qwen 35B A3B** — 듀얼 모델 추가

## 로컬에서 돌리기

```sh
pnpm install
pnpm dev               # vault → docs/guide/ 동기화 + VitePress dev 서버
pnpm build             # 정적 빌드
pnpm sync              # 동기화만 (dev 서버 X)
pnpm reverse-sync      # PR 머지된 변경을 vault 로 역동기화 (대화형 승인)
pnpm reverse-sync:dry  # 역동기화 미리보기 (vault 안 건드림)
```

## 콘텐츠 아키텍처

```
┌──────────────────────┐    pnpm sync    ┌──────────────────┐    git push     ┌─────────┐
│  Obsidian vault      │ ───────────────►│   docs/guide/    │ ───────────────►│ GitHub  │
│  (iCloud, 메인테이너)│                  │  (SYNC 마커 박힘)│                 │  + PR   │
│                      │ ◄───────────────│                  │ ◄───────────────│         │
└──────────────────────┘ pnpm reverse-sync└──────────────────┘    PR 머지      └─────────┘
                         (대화형 승인)
```

**메인테이너 (vault → repo)**:

- `~/Library/.../mannerism_notes/Personal/LocalLLM/` 의 Obsidian vault 에서 작성
- `pnpm sync` 가 `docs/guide/` 로 변환·임베드 인라인·SYNC 마커 박음

**기여자 (PR → vault)**:

- GitHub 에서 `docs/guide/N-슬러그/index.md` 의 SYNC 마커 사이 본문 수정 → PR
- 머지 후 메인테이너가 `pnpm reverse-sync` 실행 → 파일별 diff 확인 → 승인하면 vault 에 반영

## 기여하기

오타·보완·새 편·번역 모두 환영합니다.

각 페이지 하단의 **"이 페이지를 GitHub에서 수정하기"** 버튼이 가장 빠른 진입점이에요.

자세한 가이드는 [CONTRIBUTING.md](./CONTRIBUTING.md) 참고. PR 제출 시 [기여자 라이선스 동의(CLA)](./CONTRIBUTING.md#3-라이선스-및-기여자-동의-중요)에 동의하시는 것으로 간주됩니다.

## 라이선스

| 영역                                        | 라이선스                          |
| ------------------------------------------- | --------------------------------- |
| 코드 (`scripts/`, `.vitepress/`, 빌드 도구) | [MIT](./LICENSE)                  |
| 본문·이미지 (`docs/guide/**`)               | [CC BY-SA 4.0](./LICENSE-CONTENT) |

상업 출판·강의 패키지 등 별도 라이선스가 필요하시면 **dearmannerism@gmail.com**.

---

© 2026 디어매너리즘 (Dear Mannerism)
