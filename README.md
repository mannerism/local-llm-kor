# Local LLM 가이드

> **맥북에서 로컬 LLM 굴리기** — M4 Max 맥북으로 Claude Code 대용 로컬 LLM 환경을 만드는 한국어 입문 가이드.

배포 사이트: *(준비 중 — Vercel)*

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
pnpm dev      # content/ 를 docs/guide/ 로 변환 후 VitePress dev 서버
```

### 빌드

```sh
pnpm build    # docs/.vitepress/dist 에 정적 사이트 생성
```

### sync 만 따로

```sh
pnpm sync     # content/ → docs/guide/ 변환만 (dev 서버 안 띄움)
```

## 콘텐츠 구조

이 저장소의 **`content/` 폴더가 모든 글의 단일 소스**입니다.

```
content/
  1-사전-준비/
    index.md            ← 챕터 흐름
    primitives/*.md     ← 단일 도구 정본
    assets/*.jpg        ← 이미지
  2-llama-cpp-설치/
  ...
```

- 메인테이너는 `content/` 폴더를 **Obsidian vault 로 직접 열어서** 편집
- 외부 기여자는 **GitHub 웹 에디터로 같은 파일** 수정 → PR
- `docs/guide/` 는 빌드 결과물 (`.gitignore` 됨, 직접 수정 X)

## 기여하기

오타·보완·새 편·번역 모두 환영합니다.

각 페이지 하단의 **"이 페이지를 GitHub에서 수정하기"** 버튼이 가장 빠른 진입점이에요.

자세한 가이드는 [CONTRIBUTING.md](./CONTRIBUTING.md) 참고. PR 제출 시 [기여자 라이선스 동의(CLA)](./CONTRIBUTING.md#3-라이선스-및-기여자-동의-중요)에 동의하시는 것으로 간주됩니다.

## 라이선스

| 영역 | 라이선스 |
|---|---|
| 코드 (`scripts/`, `.vitepress/`, 빌드 도구) | [MIT](./LICENSE) |
| 본문·이미지 (`content/**`) | [CC BY-SA 4.0](./LICENSE-CONTENT) |

상업 출판·강의 패키지 등 별도 라이선스가 필요하시면 **dearmannerism@gmail.com**.

---

© 2026 디어매너리즘 (Dear Mannerism)
