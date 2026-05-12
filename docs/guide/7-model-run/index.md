# 모델 받아서 돌리기 — Qwen 3.6 27B MTP (7편)

> [[6-model-pick/index|6편]]에서 정한 모델을 실제로 띄워서 돌려봅니다. M4 Max에서 Qwen 3.6 27B + MTP가 daily driver로 쓸 만한지 토큰 속도를 측정합니다.

## 사전 준비
- 1~6편 완료
- mactop 설치 ([[5-model-speed/index|5편]])

---

## 실험 흐름

```
1. llama.cpp PR #22673 빌드 (MTP 지원)
2. 모델 다운로드 (Q8_0 MTP)
3. MTP 실행 + 측정
4. 결과 정리 → 가설 검증
```

---

## 1. llama.cpp PR 빌드

### 왜 또 빌드?
[[2-llamacpp/index|2편]]의 brew llama.cpp는 **stable(안정) 버전**이라 MTP 지원 코드가 아직 없어요. MTP 지원은 **PR #22673**라는 pull request에 들어있는데, 2026-05-10 시점에 아직 머지 안 된 **draft** 상태예요. 사전 PR 두 개(#22787, #22838)가 먼저 끝나야 머지 가능. 그때까진 직접 그 브랜치를 빌드해서 써야 해요.

![[llama-cpp-pr-build]]

---
## 2. 모델 다운로드

![[huggingface-download]]

### 이 편에서 받을 것

**Q8_0 MTP** (~27GB, M4 Max 128GB sweet spot):
```sh
hf download froggeric/Qwen3.6-27B-MTP-GGUF \
  --include "Qwen3.6-27B-Q8_0-mtp.gguf" \
  --local-dir ~/models/qwen3.6-27b-mtp
```

---

## 3. MTP 실행

![[try-the-model]]

**예상 generation: 35~40 tok/s** (저자 M2 Max 28 tok/s × M4 Max 대역폭 비율 1.36)

---

## 4. 실측 결과

다섯 번 반복 측정 (셋업·KV 캐시 변경 포함):

| Run | KV | Generation (tok/s) | MTP 수락률 |
|---|---|---|---|
| 1 | f16 | 22.65 | 73.8% |
| 2 | f16 | 23.94 | 79.8% |
| 3 | q8_0 | 22.77 | 76.1% |
| 4 | q8_0 | 23.51 | 78.8% |
| 5 | f16 | 23.83 | 79.1% |

**평균 ~23 tok/s.** KV 캐시 양자화는 메모리(87→79GB) 절감만 있고 속도엔 영향 없음.

GPU·전력:
- GPU 사용률: 평균 27%, peak 100% (스파이크-아이들 톱니 패턴)
- 전력: peak 141.8W, 평균 25W
- 메모리: 79~87GB (스왑 0)

---

## 5. 가설 검증

### 가설
M4 Max에서 Qwen 3.6 27B + MTP = 35+ tok/s 달성 가능, daily driver로 충분

### 결과 — ⚠️ 부분적 성공

- 측정값 **23 tok/s**는 가설(35+) 미달
- 저자 M2 Max 측정치(28 tok/s)에도 못 미침 (M4 Max가 대역폭 1.36x 높음에도)
- 다만 **사람 읽기 속도의 3배 + 베이스라인 대비 ~1.5x 가속 확인** → daily driver로는 사용 가능

### 격차의 원인 (추정)

1. **PR 커밋 드리프트** — 저자 빌드(2026-05-07) vs 우리 빌드(2026-05-10) 사이 커밋이 M5+ tensor API 최적화 위주로 변경되면서 M4 fallback 경로가 비효율적이 됐을 가능성
2. **MTP 가속률 차이** — 저자 2.5x, 우리 ~1.5x. PR 머지될 때 다시 측정 필요

### 결론
**Qwen 3.6 27B MTP를 daily driver로 채택.** 23 tok/s에서 안정적으로 작동, 추후 PR 머지 시 재측정.

---

## 다음 편 예고

이 결과로 daily driver 모델이 정해지면, 다음 편:
- 코딩 어시스턴트 (Cline/Continue.dev) 연결
- Claude Code 대용 셋업

---

## 참고 자료
- [r/LocalLLaMA — ex-arman68의 원본 글](https://www.reddit.com/r/LocalLLaMA/comments/1t57xuu/25x_faster_inference_with_qwen_36_27b_using_mtp/)
- [froggeric/Qwen3.6-27B-MTP-GGUF](https://huggingface.co/froggeric/Qwen3.6-27B-MTP-GGUF)
- [llama.cpp PR #22673](https://github.com/ggml-org/llama.cpp/pull/22673)
- [Qwen 3.6 27B + MTP 분석 — The Coders Blog](https://thecodersblog.com/faster-llm-inference-with-qwen-3-6-27b-and-mtp-2026/)
