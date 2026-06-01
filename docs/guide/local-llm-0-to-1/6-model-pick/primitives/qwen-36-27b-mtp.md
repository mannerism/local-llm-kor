---
tags: [reference, llm, model, qwen]
last_updated: 2026-05-10
---

# Qwen 3.6 27B MTP

## 이게 뭐예요?
**Alibaba가 2026-04-22에 공개한 Qwen 3.6 27B 모델의 MTP(Multi-Token Prediction) 학습 변형이에요.** 베이스 모델 자체는 **하이브리드 어텐션 구조**(dense가 아님)고, MTP 변형은 추가로 multi-token 예측 헤드가 학습돼있어 **약 2.5x 가속**이 가능합니다.

이 시리즈에서 실제로 다운받아 쓸 모델은 [`froggeric/Qwen3.6-27B-MTP-GGUF`](https://huggingface.co/froggeric/Qwen3.6-27B-MTP-GGUF)의 **Q8_0 양자화** 파일(`Qwen3.6-27B-Q8_0-mtp.gguf`)이에요.

> 💡 모델 이름 읽는 법은 [[model-naming-basics|모델 이름 기본편]] 참고.

## 주요 사양

| 항목 | 값 |
|---|---|
| 파라미터 | 27B |
| 구조 | **Hybrid attention** (16/65 레이어만 KV 캐시, 48 레이어는 linear attention) |
| 네이티브 컨텍스트 | 262,144 토큰 (~256K) |
| 양자화 옵션 (GGUF) | F16, Q8_0, Q6_K, **Q5_K_M**, Q4_K_M, IQ4_XS, IQ3_M, IQ2_M |
| 라이선스 | Apache 2.0 (상업용 OK) |
| 멀티모달 | 텍스트 + 이미지 (vision) |
| MTP 지원 | ✅ (전용 변형 있음) |

## 강점

- **2026-04-22 출시 최신 모델** — 같은 크기대 코딩 성능 톱
- **Hybrid attention 구조 = 메모리 효율적** — 65 레이어 중 16개만 KV 캐시 사용. 나머지 48 레이어는 고정 898MB recurrent state. 즉 **일반 dense 모델보다 KV 메모리 약 4x 적게 씀**
- **256K 네이티브 컨텍스트** — 긴 코드, 긴 문서 통째 분석 가능
- **MTP 학습돼 있음** — 전용 변형(`-MTP-` 붙은 거)으로 약 2.5x 가속
- **멀티모달** — 이미지도 입력 가능 (단, MTP와 동시 사용은 불안정)
- **라이선스 자유** — Apache 2.0이라 상업용도 무난

## 메모리 요구량 (Apple Silicon)

저자 실측 기반 표 (모델 + KV 캐시 + recurrent state 합산). macOS는 별도 ≥8GB 확보 필요.

| RAM | 양자화 | KV 캐시 | 최대 컨텍스트 | 총 사용 | 비전 |
|---|---|---|---|---:|---|
| 16 GB | IQ2_M | q8_0 | 42K | 12.0 GB | ✗ |
| 24 GB | IQ3_M | f16 | 46K | 16.0 GB | ✗ |
| 24 GB | IQ3_M | q8_0 | 91K | 16.0 GB | ✗ |
| 32 GB | Q5_K_M | f16 | 74K | 24.0 GB | ✗ |
| 32 GB | Q5_K_M | q8_0 | 147K | 24.0 GB | ✗ |
| 32 GB | Q4_K_M | f16 | 99K | 24.0 GB | ✓ |
| 48 GB | Q6_K | f16 | 262K | 39.7 GB | ✓ |
| 48 GB | Q8_0 | f16 | 173K | 40.0 GB | ✓ |
| 48 GB | Q8_0 | q8_0 | 262K | 37.3 GB | ✓ |
| 64 GB | Q8_0 | f16 | 262K | 45.8 GB | ✓ |
| 96 GB+ | Q8_0 | f16 | 262K | 45.8 GB | ✓ |

**128GB M4 Max** = 96GB 이상 카테고리. **Q8_0 + f16 KV + 262K 컨텍스트 + 비전**까지 다 가능.

## 양자화별 품질 (저자 비교)

저자가 직접 다양 양자화에서 테스트한 결론:

- **F16 (51GB)**: 최고 품질이지만 Q8_0 대비 **6x 느림** → 실용성 떨어짐
- **Q8_0 (27GB)**: 속도 + 품질 최적의 균형 → **추천**
- **Q6_K (21GB)**: Q8_0보다 살짝 떨어짐
- **Q5_K_M (18GB)**: 메모리 빠듯할 때 무난한 선택
- **Q4_K_M (16GB)**: 코딩 등 정밀 작업에선 품질 손실 체감 (HumanEval -5.5점)

> ⚠️ "8비트는 16비트와 거의 동일하다"는 통념은 **사실이 아님** (저자 실측). 가능하면 Q8_0 이상.

## 약점·주의

- **MTP + Vision 조합 불안정** (2026-05 시점)
- **MTP는 표준 llama.cpp(brew)로 안 됨** — `ggml-org/llama.cpp` PR #22673 빌드 필요
- **Q4_K_M 이하에선 코딩 성능 살짝 떨어짐** — HumanEval -5.5점 vs BF16

## 어디서 받아요?

llama.cpp용 GGUF + MTP:

| 업로더                                                                                           | 모델                    | 비고                                         |
| --------------------------------------------------------------------------------------------- | --------------------- | ------------------------------------------ |
| `Qwen/Qwen3.6-27B`                                                                            | 원본                    | 변환 안 됨 (직접 변환 필요)                          |
| `Qwen/Qwen3.6-27B-Instruct`                                                                   | 원본 Instruct           | 위와 동일                                      |
| `bartowski/Qwen3.6-27B-Instruct-GGUF`                                                         | GGUF Instruct         | MTP 없음 (베이스라인 비교용)                         |
| **[`froggeric/Qwen3.6-27B-MTP-GGUF`](https://huggingface.co/froggeric/Qwen3.6-27B-MTP-GGUF)** | **MTP GGUF (다양 양자화)** | **추천 — Q8_0 받기**                           |


> 모델 이름의 `-MTP-` 표기에 대한 자세한 설명은 [[model-naming-advanced|모델 이름 응용편]] 참고.

## 더 알아보기
- [Qwen3.6-27B 공식 (Hugging Face)](https://huggingface.co/Qwen/Qwen3.6-27B)
- [froggeric/Qwen3.6-27B-MTP-GGUF (메인)](https://huggingface.co/froggeric/Qwen3.6-27B-MTP-GGUF)
- [Qwen3.6 가이드 (Unsloth)](https://unsloth.ai/docs/models/qwen3.6)
- [llama.cpp PR #22673 (MTP 지원)](https://github.com/ggml-org/llama.cpp/pull/22673)
