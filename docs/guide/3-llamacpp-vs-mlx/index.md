# llama.cpp vs MLX 비교 (3편)

> Apple Silicon 맥북에서 로컬 LLM을 돌릴 때 쓸 수 있는 두 인기 도구, llama.cpp와 MLX. 어느 쪽이 더 나은지 실제 사용 환경에서 비교해봅니다.

## 결론 먼저 (TL;DR)
**평소에 모델 돌릴 땐 llama.cpp, AI 모델을 직접 학습시킬 땐(fine-tuning) MLX를 쓰면 됩니다.** 자세한 이유는 아래에서 풀어드릴게요.

---

## 1. llama.cpp
### 이게 뭐예요?
**llama.cpp는 GPT 같은 AI 모델을 내 맥북에서 직접 돌려주는 프로그램이에요.** C++로 짜여 있고, 로컬 LLM(인터넷 없이 내 컴퓨터에서 돌리는 AI)을 다룰 때 가장 널리 쓰이는 도구입니다. 이런 도구를 "추론 엔진(inference engine)"이라고 부릅니다.

### 강점
- **새 모델 지원이 가장 빠릅니다** — 새 AI 모델이 나오면 보통 같은 날 GGUF 파일(llama.cpp용 모델 형식)이 같이 풀려요.
- **양자화 옵션이 다양합니다** — Q4_K_M, Q5_K_M, Q6_K, Q8_0 같은 여러 종류가 있어서 품질과 속도를 세밀하게 조절할 수 있어요. (양자화 = 모델을 가볍게 줄이는 기술)
- **긴 글이나 여러 번 대화하는 작업에 강합니다** — 문서 요약, 8턴 이상 대화 같은 일상 작업에서 MLX보다 빠른 경우가 많아요.
- **생태계가 큽니다** — Ollama, LM Studio, Open WebUI 같은 거의 모든 도구가 llama.cpp 기반이라 호환 도구가 많아요.
- **OpenAI 호환 서버가 내장돼 있어요** — `llama-server` 명령어 한 줄로 ChatGPT API 같은 서버를 띄울 수 있습니다.

### 약점
- **짧은 입력에서의 답 만드는 속도(generation)는 MLX보다 살짝 느려요.** 단, 입력이 길어지면 역전됩니다.
- **명령어 위주 도구라** 그래픽 화면(UI)이 필요하면 별도 도구를 깔아야 해요. (어렵지 않으니 걱정 안 해도 됩니다.)

### 어울리는 상황
- 긴 문서 요약, RAG(외부 자료를 같이 보여주면서 답하게 하기), 분류 작업
- 여러 번 주고받는 대화 (8턴 이상)
- 새로 출시된 모델을 빨리 써보고 싶을 때
- 양자화 품질을 세밀하게 조절하고 싶을 때

---

## 2. MLX
### 이게 뭐예요?
**MLX는 Apple이 직접 만든, M칩(M1, M2, M3, M4 같은 애플 칩) 전용 머신러닝 프레임워크예요.** 애플 칩의 통합 메모리 구조(CPU와 GPU가 같은 메모리를 공유하는 구조)에 맞춰 처음부터 설계된 점이 특징입니다.

### 강점
- **답 만드는 속도(generation)가 빠릅니다** — 짧은 입력 + 긴 출력 시나리오에서 llama.cpp보다 20~30% 빠른 경우가 많아요.
- **Apple Silicon에 최적화됐어요** — 통합 메모리와 Metal GPU(애플 칩의 그래픽 엔진)를 데이터 복사 없이 활용합니다.
- **메모리를 약 10% 적게 씁니다** — 같은 양자화 기준으로요.
- **Fine-tuning(모델 미세조정)이 가능합니다** — LoRA/QLoRA 같은 기법으로 AI 모델을 내 입맛에 맞게 학습시킬 수 있어요. 맥북에서 바로요.
- **Python API가 깔끔합니다** — NumPy/PyTorch와 비슷해서 머신러닝 해본 사람한테 친숙해요.

### 약점
- **새 모델 지원이 늦어요** — 출시 후 며칠 기다려야 MLX 변환본이 나옵니다. (예: Gemma 4가 나왔을 때 MLX는 한동안 못 돌렸어요.)
- **긴 입력에서 느려집니다** — 입력 처리 단계(prefill)가 llama.cpp보다 느려서, 컨텍스트(한 번에 처리할 글 길이)가 3,000 토큰을 넘어가면 체감 속도가 뚝 떨어져요.
- **Prompt caching이 아직 미성숙해요** — 멀티턴 대화에서 이미 처리한 내용을 다시 처리하는 버그가 보고됐어요. (특히 LM Studio의 MLX 런타임)
- **양자화 옵션이 4-bit 위주** — GGUF만큼 종류가 다양하지 않아요.
- **생태계가 작습니다** — 호환되는 도구가 적어요.

### 어울리는 상황
- 짧은 프롬프트 + 긴 출력 (창작, 시 쓰기 등)
- Fine-tuning (LoRA/QLoRA로 모델 미세조정)
- Apple Silicon에서 generation 속도를 끝까지 짜내고 싶을 때

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

---

*이 페이지의 원본은 Obsidian vault `Personal/LocalLLM/3-llama-cpp-vs-mlx/index.md` 에서 동기화됩니다.*
