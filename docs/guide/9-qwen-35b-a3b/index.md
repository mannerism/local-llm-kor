# Qwen 3.6 35B A3B 추가하기 (9편)

> [[8-terminal-agent/index|8편]]까지 Qwen 3.6 27B를 daily driver로 셋업하고 Fixed Template까지 적용해서 23 tok/s 회복했어요. 이번 편에서는 **35B A3B 모델을 추가**해 **듀얼 모델 운영**으로 갑니다. 작업 난이도에 따라 27B(품질)와 35B A3B(속도)를 골라 쓰는 전략이에요.

## 사전 준비
- [[8-terminal-agent/index|8편]] 완료 (Pi + 27B 셋업 + Fixed Template)
- llama.cpp PR #22673 빌드 완료 ([[7-model-run/index|7편]]) — 새로 빌드할 필요 없어요
- 디스크 여유 30~40 GB

---

## 왜 모델을 두 개나?

작업 종류는 다양해요. Claude Code를 쓸 때도 모든 작업이 똑같은 무게가 아니죠.

- "이 변수명 바꿔 줘" → 가벼움. 5초 안에 답 와야 함
- "이 모듈 재설계해 줘" → 무거움. 깊은 추론이 필요함

**27B Dense는 무거운 쪽엔 강한데 가벼운 작업엔 오버킬.** thinking을 꺼도 모델 자체의 추론 깊이가 그대로라 가속에 한계가 있어요.

해법: **빠른 일상용 모델을 따로 두는 것.** Anthropic이 Claude Sonnet/Haiku, OpenAI가 GPT-5.1/Mini를 따로 두는 것과 같은 발상. 로컬 LLM에서 이걸 무료로 재현하는 게 이번 편의 목표.

---

## 후보 — Qwen 3.6 35B A3B

![[qwen-36-35b-a3b]]

---

## 다운로드

![[35b-a3b-download]]

---

## 듀얼 모델 운영

![[dual-model-ops]]

---

## 사용 워크플로 (제안)

| 상황 | 모델 |
|---|---|
| 빠른 Q&A, 한 줄 명령어 | 35B A3B |
| 변수명·함수명 바꾸기, import 정리 | 35B A3B |
| 짧은 코멘트·문서 추가 | 35B A3B |
| 단순 boilerplate 생성 | 35B A3B |
| 디버깅 (원인 파악, 가설 세우기) | 27B |
| 멀티 파일 리팩토링 | 27B |
| 알고리즘 설계, 자료구조 결정 | 27B |
| 복잡한 PR 만들기 | 27B |
| 기존 코드 깊게 분석 | 27B |

작업 시작 전 `/model`로 적절히 선택. 도중에 깊이가 필요해지면 그 자리에서 전환하면 됩니다.

---

## 한계 — MoE + MTP는 항상 빠르진 않음

MTP(speculative decoding)는 27B Dense에서 2.5배 가속을 줬지만, **MoE에선 효과가 약하거나 없을 수 있어요.** [RTX 3090에서 측정한 벤치마크](https://github.com/thc1006/qwen3.6-speculative-decoding-rtx3090)에선 35B A3B + MTP 조합이 net speedup이 안 났습니다.

이유: MoE는 이미 active 3.6B만 계산하니까 기본 속도가 빠르고, draft 검증의 상대적 비용이 더 커져요.

→ 그래도 우리가 받은 havenoammo의 MTP-GGUF는 MTP가 박혀 있어서 켜 두는 게 손해는 아닙니다. 효과 측정해 보고 별 차이 없으면 `--spec-type mtp --spec-draft-n-max 3`를 빼도 됩니다.

---

## 시리즈를 마치며

여기까지 따라온 분이라면, 이제 손에 있는 게 작은 게 아니에요. M4 Max 맥북 한 대 안에서 Claude Code 비슷한 워크플로를 **로컬 LLM 두 개**로 굴리는 셋업이 완성됐습니다. API 비용도, 외부 의존도, 데이터 유출 걱정도 없이.

### 우리가 이번 시리즈에서 한 일

- [[1-prep/index|1편]] — WezTerm + Homebrew로 작업 환경 정돈
- [[2-llamacpp/index|2편]] — 추론 엔진 `llama.cpp` 설치
- [[3-llama-cpp-vs-mlx/index|3편]] — MLX 대신 llama.cpp를 고른 이유
- [[4-model-name/index|4편]] — `Qwen3.6-27B-Q8_0` 같은 모델 이름을 읽는 법 (B, Q, MoE, MTP…)
- [[5-model-speed/index|5편]] — 로컬 LLM 속도를 결정하는 요인들 (메모리 대역폭, 양자화, MTP, KV cache)
- [[6-model-pick/index|6편]] — Qwen 3.6 27B MTP를 데일리 드라이버로 선정
- [[7-model-run/index|7편]] — PR #22673로 llama.cpp 빌드, 모델 다운로드, 첫 실행으로 23 tok/s 달성
- [[8-terminal-agent/index|8편]] — 터미널 코딩 에이전트 비교 후 **Pi** 픽, 셋업·연결·Fixed Template으로 속도 회복
- 9편 (이번 편) — **Qwen 3.6 35B A3B 추가**, 듀얼 모델로 작업 난이도별 라우팅

### 새로 배운 것

- llama.cpp + MTP 패치 빌드 (PR #22673)
- 두 모델 GGUF: `Qwen3.6-27B-Q8_0-mtp` (27 GB) + `Qwen3.6-35B-A3B-MTP-UD-Q8_K_XL` (39 GB)
- Fixed Chat Template (tool call 안정성)
- Pi 셋업 + `tps.ts` 익스텐션 (실시간 tok/s 표시)
- `models.json`에 등록된 두 provider, `/model` 한 번으로 전환
- 듀얼 운영을 위한 `iogpu.wired_limit_mb=114688` (112 GB GPU 한도)

### 앞으로

로컬 LLM 생태계는 빠르게 바뀝니다. **Qwen 4, Llama 5, 또 다른 MoE 변종**이 곧 나오겠죠. 이 시리즈의 도구·개념들 (양자화 읽기, MTP, KV cache, mmap, hybrid attention)은 그대로 다음 모델에도 쓸 수 있어요. 모델만 갈아 끼우면 됩니다.

이 시리즈의 진짜 가치는 "지금 무엇을 깔아라"가 아니라 **"왜 그게 그렇게 동작하는지"**예요. 그 부분만 챙겨 가면, 6개월 뒤에 새 모델이 나와도 본인이 직접 골라서 셋업할 수 있을 거예요.

수고하셨습니다. 🎉

---

## 참고 자료
- [havenoammo/Qwen3.6-35B-A3B-MTP-GGUF](https://huggingface.co/havenoammo/Qwen3.6-35B-A3B-MTP-GGUF)
- [bartowski/Qwen_Qwen3.6-35B-A3B-GGUF](https://huggingface.co/bartowski/Qwen_Qwen3.6-35B-A3B-GGUF)
- [Qwen 3.6 35B A3B Review (buildfastwithai)](https://www.buildfastwithai.com/blogs/qwen3-6-35b-a3b-review)
- [Best Way to Run Qwen 3.6 35B MoE Locally (InsiderLLM)](https://insiderllm.com/guides/best-way-run-qwen-3-6-35b-moe-locally/)
- [Speculative Decoding on Qwen 3.6 (thc1006)](https://github.com/thc1006/qwen3.6-speculative-decoding-rtx3090)
- [Pi /model docs](https://pi.dev/docs/latest/models)
