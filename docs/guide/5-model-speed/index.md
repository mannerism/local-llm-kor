# 모델 속도를 결정짓는 것들 (5편)

> 로컬 LLM이 빠를지 느릴지는 칩 세대보다 메모리 스펙·소프트웨어 설정이 결정해요. 이 편에서는 **속도를 결정짓는 요인들을 하나씩** 자세히 봅니다.

## 사전 준비
- [[1-prep/index|1편]](사전 준비), [[2-llamacpp/index|2편]](llama.cpp 설치), [[3-llama-cpp-vs-mlx/index|3편]](엔진 비교), [[4-model-name/index|4편]](모델 이름) 완료

---

## 하드웨어 — 메모리가 핵심

### 1. 메모리 대역폭 (1순위 결정 요인)
![[memory-bandwidth]]

---

### 2. 메모리 용량과 헤드룸
![[memory-capacity]]

---

## 모델 자체 — 같은 하드웨어에서도 모델에 따라 다름

### 3. 양자화와 속도
![[quantization-speed]]

---

### 4. Dense vs MoE 속도 차이
![[dense-vs-moe]]

---

### 5. 컨텍스트 길이와 Prefill
![[context-prefill]]

---

## 소프트웨어 — 마지막 최적화

### 6. 추론 엔진과 플래그 튜닝
![[inference-flags]]

---

### 7. 추론 가속 기술 (MTP, Speculative Decoding 등)
![[acceleration]]

---

## 실전 — 어떻게 살까

### 8. 하드웨어 구매 가이드
![[hardware-buying-guide]]

---

## 우선순위 정리

| 우선순위 | 요인 | 영향력 |
|---|---|---|
| 1 | 메모리 **대역폭** (Max 등급 필수) | 5x |
| 2 | 메모리 **용량** (모델 크기 ÷ 0.6 이상) | 가능 vs 불가능 |
| 3 | 양자화 레벨 (Q4 vs Q8) | 1.5~2x |
| 4 | Dense vs MoE | 5~10x (MoE 유리) |
| 5 | 가속 기술 (MTP, Flash Attention 등) | 2~3x |
| 6 | 컨텍스트 길이 | prefill에 영향 |
| 7 | 플래그 튜닝 (`-c`, `-fa`, `-ngl`) | 1.5~2x |

새 맥을 사거나 모델을 고를 때 위 순서대로 우선순위를 두면 후회할 일이 적어요.
