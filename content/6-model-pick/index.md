# 모델 선택 — Qwen 3.6 27B MTP (6편)

> 4편(모델 이름)과 5편(속도 결정 요인)에서 배운 걸로 이 시리즈에서 쓸 모델을 정합니다. 결론은 **Qwen 3.6 27B MTP**.

## 사전 준비
- 1~5편 완료
- 특히 5편의 메모리 대역폭·속도 공식 이해 중요

---

## 왜 Qwen 3.6 27B인가요?

[r/LocalLLaMA](https://www.reddit.com/r/LocalLLaMA/) 커뮤니티([[커뮤니티-리소스]] 참고)에서 가장 많은 좋아요를 받고, M4 Max 비슷한 환경에서 매일 거론되는 모델이에요.

후보 두 개를 봤는데:

| 모델 | 타입 | 메모리 | 특징 |
|---|---|---|---|
| Qwen 3.6 35B A3B | MoE | ~22GB (Q4) | 빠름 (3B만 활성화) |
| **Qwen 3.6 27B** | **Hybrid** | **~28GB (Q8_0)** | **Hybrid attention + MTP로 가속** |

Qwen 3.6 27B로 가는 이유:
- 같은 크기대에서 코딩 성능 톱
- **Hybrid attention 구조** — 일반 dense보다 KV 메모리 4x 적음 (65 레이어 중 16개만 KV 사용)
- MTP 변형이 풀려있어 추가로 ~2.5x 가속 가능
- 256K 컨텍스트 (긴 코드·문서 통째 분석 가능)
- Apache 2.0 라이선스

---

## Qwen 3.6 27B MTP 모델 정보
![[qwen-3.6-27b-mtp]]

---

## 다음 편에서

[[7-model-run/index|7편]]에서:
- llama.cpp PR #22673 빌드 (MTP 지원)
- 모델 다운로드 + 실행
- 베이스라인 vs MTP 벤치마크

---

## 참고 자료
- [r/LocalLLaMA — ex-arman68의 Qwen 3.6 27B + MTP 글](https://www.reddit.com/r/LocalLLaMA/comments/1t57xuu/25x_faster_inference_with_qwen_36_27b_using_mtp/)
- [froggeric/Qwen3.6-27B-MTP-GGUF (메인 모델)](https://huggingface.co/froggeric/Qwen3.6-27B-MTP-GGUF)
- [Qwen3.6-27B 공식](https://huggingface.co/Qwen/Qwen3.6-27B)
- [Qwen3.6 운용 가이드 — Unsloth](https://unsloth.ai/docs/models/qwen3.6)
