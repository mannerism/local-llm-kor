---
tags: [model, qwen, moe]
last_updated: 2026-05-12
---

# Qwen 3.6 35B A3B

## 이게 뭐예요?

**총 35B 파라미터지만, 토큰마다 3.6B만 활성화되는 MoE(Mixture of Experts) 모델**이에요. 27B Dense와 비슷한 메모리를 차지하지만, 매 토큰 생성할 때 **계산량은 3.6B 모델 수준**이라 훨씬 빠릅니다.

## 이름 해석

| 부분 | 의미 |
|---|---|
| Qwen 3.6 | Alibaba의 Qwen 모델, 세대 3.6 |
| 35B | 총 파라미터 350억 |
| **A3B** | **Active 3B** — 매 토큰마다 활성화되는 파라미터 약 3.6B |

## MoE가 뭐길래 빠르냐

**Dense 모델 (27B):**
- 모든 토큰이 27B **전체**를 통과
- Q8 기준 매 토큰 28 GB 메모리 읽기
- 속도 ≈ 대역폭 / 28 GB

**MoE 모델 (35B A3B):**
- 모델 안에 **수십 개의 전문가(expert)**가 있음
- 매 토큰마다 router가 "이 토큰엔 어떤 expert 8개 정도를 쓸까?" 결정
- 선택된 expert만 계산 → **3.6B 파라미터만 활성**
- 속도 ≈ 대역폭 / ~4 GB (Q8 기준)

> 비유: 27B Dense는 백과사전 전체를 매번 펼쳐 보는 거고, 35B A3B는 목차에서 필요한 페이지만 골라 보는 거예요. 책장(메모리)에는 둘 다 다 꽂혀 있어야 하지만, 매번 펼치는 양이 달라요.

## 속도 vs 품질

| | Qwen 3.6 27B Dense | Qwen 3.6 35B A3B |
|---|---|---|
| 총 파라미터 | 27B | 35B |
| 활성 / 토큰 | 27B | 3.6B |
| 메모리 (Q8) | ~28 GB | ~39 GB |
| M4 Max 예상 tok/s | 23~28 | 60~100+ |
| 코드 품질 | 🟢 깊고 안정 | 🟡 빠르지만 얕음 |
| 깊은 추론 | 🟢 강함 | 🟡 약함 |
| Tool use | 🟢 안정 | 🟢 안정 |

## 어느 작업에 쓰면 좋나

**35B A3B가 어울리는 작업:**
- 빠른 Q&A, 한 줄 답변
- 변수명·함수명 바꾸기, import 정리
- 짧은 코멘트·문서 추가
- 반복적인 boilerplate 생성
- 명령어·정규식 추천

**27B가 어울리는 작업:**
- 복잡한 로직 설계
- 알고리즘·자료구조 결정
- 멀티 파일 리팩토링
- 디버깅·원인 분석
- 코드 리뷰

## 우리가 이 모델을 추가하는 이유

8편까지 Qwen 3.6 27B를 daily driver로 정착시켰지만, **모든 작업이 깊은 추론을 요구하지는 않아요.** 가벼운 작업엔 27B가 오버킬. **27B + 35B A3B 듀얼 셋업**으로:

- 무거운 작업 → 27B (품질)
- 가벼운 작업 → 35B A3B (속도)

Anthropic이 Claude Sonnet과 Haiku를 따로 두는 것과 같은 발상이에요. 로컬 LLM에서 이걸 무료로 재현할 수 있다는 점이 매력.

## 참고

- 공식 HF: https://huggingface.co/Qwen/Qwen3.6-35B-A3B
- MTP GGUF: https://huggingface.co/havenoammo/Qwen3.6-35B-A3B-MTP-GGUF
- 표준 GGUF: https://huggingface.co/bartowski/Qwen_Qwen3.6-35B-A3B-GGUF
- [Qwen 3.6 35B A3B Review (buildfastwithai)](https://www.buildfastwithai.com/blogs/qwen3-6-35b-a3b-review)
- [Best Way to Run Qwen 3.6 35B MoE Locally (InsiderLLM)](https://insiderllm.com/guides/best-way-run-qwen-3-6-35b-moe-locally/)
