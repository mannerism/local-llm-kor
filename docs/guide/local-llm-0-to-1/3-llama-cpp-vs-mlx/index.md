# llama.cpp vs MLX 비교 (3편)

> Apple Silicon 맥북에서 로컬 LLM을 돌릴 때 쓸 수 있는 두 인기 도구, llama.cpp와 MLX. 어느 쪽이 더 나은지 실제 사용 환경에서 비교해봅니다.

## 결론 먼저 (TL;DR)
**평소에 모델 돌릴 땐 llama.cpp, AI 모델을 직접 학습시킬 땐(fine-tuning) MLX를 쓰면 됩니다.** 자세한 이유는 아래에서 풀어드릴게요.

---

## 1. llama.cpp
![[llama-cpp]]

---

## 2. MLX
![[mlx]]

---

## 벤치마크 한눈에 보기

인터넷에서 흔히 보이는 "MLX 60 tok/s vs llama.cpp 30 tok/s — MLX가 두 배 빠르다!" 같은 숫자는 사실 **답을 만드는 속도(generation)만** 잰 거예요.

근데 우리가 실제로 체감하는 속도는 두 단계의 합입니다:
1. **Prefill** — 내가 보낸 입력(질문이나 코드)을 모델이 한 번 쭉 읽는 시간
2. **Generation** — 답을 한 글자씩 써 내려가는 시간

입력이 길어질수록 1번(prefill)이 시간 대부분을 잡아먹는데, 여기서 llama.cpp가 더 빨라요. 그래서 컨텍스트(한 번에 처리할 글 길이)가 길어지면 MLX의 우위가 사라집니다.

| 컨텍스트 크기 | MLX 체감 속도 | llama.cpp 체감 속도 | UI에 보이는 tok/s |
|---|---|---|---|
| ~655 토큰 | 13 tok/s | 20 tok/s | MLX 57, llama.cpp 29 |
| ~1,453 토큰 | 10 tok/s | 16 tok/s | MLX 57, llama.cpp 29 |
| ~3,015 토큰 | 6 tok/s | 11 tok/s | MLX 57, llama.cpp 29 |
| ~8,496 토큰 | 3 tok/s | 3 tok/s | MLX 57, llama.cpp 29 |

> M1 Max 64GB, Qwen3.5-35B-A3B 모델, MLX 4-bit 양자화 vs GGUF Q4_K_M 양자화 기준입니다. 출처: famstack.dev

M4 Max는 메모리 속도가 M1 Max보다 훨씬 빨라서 prefill 격차가 조금 좁혀질 수는 있어요. 하지만 prompt caching 버그(이미 처리한 입력을 다시 처리하는 비효율)나 hybrid attention 미지원 같은 소프트웨어 문제는 칩을 바꿔도 그대로라, 결과는 비슷하게 나옵니다.

---

## 어떤 상황에 뭐가 나은가요?

| 상황 | 더 나은 도구 | 이유 |
|---|---|---|
| 긴 문서 요약·분류 (RAG) | **llama.cpp** | prefill이 빠름 |
| 멀티턴 대화 (8턴 이상) | **llama.cpp** | prompt caching 안정적 |
| 새 모델 당일 사용 | **llama.cpp** | GGUF가 같은 날 풀림 |
| 짧은 프롬프트 + 긴 출력 (창작) | **MLX** | generation 자체는 더 빠름 |
| LoRA/QLoRA fine-tuning | **MLX** | 학습 도구가 잘 갖춰져 있음 |
| 양자화 품질 세밀 조절 | **llama.cpp** | Q4_K_M, Q5_K_M, Q6_K, Q8_0 등 다양 |

---

## 결론

이 시리즈에서는 **llama.cpp를 메인으로** 갑니다. 이유는요:

- 일상 작업(긴 컨텍스트, 멀티턴 대화)에서 더 빠릅니다
- 새 모델이 나오면 당일 지원
- 생태계 성숙도 압도적
- 양자화 옵션이 풍부

MLX는 fine-tuning 할 일이 생기면 그때 추가로 깔면 돼요. 처음부터 둘 다 깔 필요는 없습니다.

---

## 참고 자료
- [llama.cpp vs MLX vs Ollama vs vLLM — Contra Collective](https://contracollective.com/blog/llama-cpp-vs-mlx-ollama-vllm-apple-silicon-2026)
- [Effective tok/s 벤치마크 — famstack.dev](https://famstack.dev/guides/mlx-vs-gguf-apple-silicon/)
- [MLX vs Ollama on Apple Silicon — Will It Run AI](https://willitrunai.com/blog/mlx-vs-ollama-apple-silicon-benchmarks)
- [MLX vs llama.cpp Apple Silicon — Contra Collective](https://contracollective.com/blog/mlx-vs-llama-cpp-apple-silicon-local-ai)
