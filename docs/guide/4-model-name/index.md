# 모델 이름 이해하기 (4편)

> Hugging Face나 r/LocalLLaMA에서 모델을 골라 받기 전에, 이름만 보고 "어떤 모델인지" 파악할 수 있어야 해요. 이 편에서는 모델 이름을 읽는 법을 기본부터 응용까지 다룹니다.

## 사전 준비
- 1편(사전 준비), 2편(llama.cpp 설치) 완료
- 3편(llama.cpp vs MLX 비교)에서 llama.cpp를 메인으로 가기로 결정

---

## 1. 기본편 — 단순한 이름 읽기 {#primitive-로컬-모델-이름-이해하기-기본편}

`Qwen3.6-27B-Instruct` 같은 표준적인 이름을 읽는 법이에요. 패밀리, 버전, 크기, 용도 태그 네 가지만 알면 됩니다.

<!-- SYNC:BEGIN src="4-model-name/primitives/로컬-모델-이름-이해하기-기본편.md" demote="1" -->
### 이게 뭐예요?
**LLM 모델 이름은 처음 보면 외계어 같아요.** 예를 들어 `Qwen3.6-27B-Instruct` 같은 이름. 근데 이름은 정해진 규칙대로 붙는 거라, 한 번만 익혀두면 어떤 모델이든 이름만 보고 "아, 얘는 이런 애구나" 바로 감이 옵니다.

이 기본편에서는 **가장 단순한 모델 이름**을 읽는 법만 다뤄요. 더 복잡한 표기(MoE, 양자화, 파일 형식 등)는 [응용편](#primitive-로컬-모델-이름-이해하기-응용편)에서 봅니다.

### 이름 구조 (기본형)

```
[패밀리] [버전] [크기] [용도 태그]
```

예시:
- `Qwen3.6-27B-Instruct` → Qwen + 3.6 + 27B + Instruct
- `Llama-3.3-70B-Instruct` → Llama + 3.3 + 70B + Instruct
- `Gemma-2-9B-Instruct` → Gemma + 2 + 9B + Instruct

각 부분을 하나씩 봅시다.

### 1. 패밀리 (만든 곳)

모델을 만든 회사·연구소를 나타내요.

| 패밀리 | 만든 곳 | 특징 |
|---|---|---|
| **Qwen** | Alibaba (중국) | 오픈소스 중 최상급, 한국어·중국어 강함 |
| **Llama** | Meta (미국) | 가장 유명, 영어 강점 |
| **Gemma** | Google | 작은 사이즈에 강함 |
| **Mistral** | Mistral AI (프랑스) | 효율성 강조 |
| **DeepSeek** | DeepSeek (중국) | 코딩·수학 특화 |
| **Phi** | Microsoft | 소형 모델 특화 |

같은 크기라도 패밀리가 다르면 학습 데이터·방법이 달라서 성능이 천차만별이에요.

### 2. 버전 번호

`3.6` 같은 숫자예요. 클수록 신모델이고 보통 더 똑똑합니다.

- 메이저 업데이트는 정수: Qwen 2 → Qwen 3
- 마이너 개선은 소수점: Qwen 3.5 → Qwen 3.6

### 3. 파라미터 크기 (B)

`27B`, `70B` — **B는 Billion(10억)** 의 약자예요. 모델의 "지능 용량"이라고 생각하면 됩니다. 클수록 똑똑하지만 메모리도 더 먹어요.

| 크기 | Q4 메모리 | 체감 |
|---|---|---|
| 7B | ~5GB | 빠름, 가벼움 |
| 14B | ~9GB | 균형 |
| 27B | ~18GB | 균형 |
| 70B | ~45GB | 매우 똑똑하지만 느림 |

> 💡 27B = 27 × 10억 = 270억 파라미터. 70B = 700억 파라미터.

### 4. 용도 태그 (이름 끝에 붙는 것)

이름 끝에 `Instruct`, `Coder` 같은 게 붙어요. 이게 "이 모델 어디에 쓰는 거냐"를 알려줍니다.

| 태그 | 무슨 뜻? | 언제 쓰나요? |
|---|---|---|
| `Instruct` | 지시·질문에 답하도록 학습 | **일반 대화·작업, 이게 정답** |
| `Chat` | 대화 톤 학습 (옛날 표기) | Instruct와 비슷 |
| `Base` | 학습만 시킨 원본, 대화 능력 없음 | Fine-tuning용 |
| `Coder` | 코드 특화 | 프로그래밍 |
| `Math` | 수학 특화 | 수학 문제 |
| `VL` | Vision-Language, 이미지 입력 가능 | 멀티모달 |

용도 태그가 없으면 보통 `Base` 모델이라고 보면 됩니다.

### 실전 — 이름 해석해보기

#### `Qwen3.6-27B-Instruct`
Alibaba의 Qwen, 3.6 버전, 27B 파라미터, 지시 따르기 학습 완료. 일반 대화·작업용으로 바로 쓸 수 있어요.

#### `Llama-3.3-70B-Instruct`
Meta의 Llama, 3.3 버전, 70B 파라미터, Instruct 학습 완료. 메모리 많이 먹지만 똑똑함.

#### `Qwen2.5-Coder-32B-Instruct`
Alibaba의 Qwen 2.5, 코드 특화, 32B 파라미터, Instruct 학습 완료. 코딩 어시스턴트로 쓰기 좋아요.

### 정리

이름만 보고 바로 알 수 있는 것:
1. **누가 만들었나** — 패밀리 (Qwen, Llama, Gemma...)
2. **얼마나 신버전인가** — 버전 번호 (3.6 등)
3. **얼마나 큰가** — B 표기 (27B, 70B...)
4. **어디에 쓰는 모델인가** — 용도 태그 (Instruct, Coder 등)

이 네 개만 보면 일반적인 모델 이름은 다 읽을 수 있어요.

> 💡 더 복잡한 이름 (예: `froggeric/Qwen3.6-27B-MTP-GGUF`)은 [응용편](#primitive-로컬-모델-이름-이해하기-응용편)에서 다룹니다.
<!-- SYNC:END src="4-model-name/primitives/로컬-모델-이름-이해하기-기본편.md" -->

---

## 2. 응용편 — 복잡한 이름 읽기 {#primitive-로컬-모델-이름-이해하기-응용편}

`froggeric/Qwen3.6-27B-MTP-GGUF`처럼 업로더, MoE 표기, 변형 태그, 양자화·파일 형식이 다 붙은 이름을 해석하는 법이에요.

<!-- SYNC:BEGIN src="4-model-name/primitives/로컬-모델-이름-이해하기-응용편.md" demote="1" -->
### 이게 뭐예요?
[기본편](#primitive-로컬-모델-이름-이해하기-기본편)에서는 `Qwen3.6-27B-Instruct` 같은 단순한 이름을 봤어요. 근데 실제 Hugging Face에서 보면 이런 복잡한 이름이 더 많습니다:

- `froggeric/Qwen3.6-27B-MTP-GGUF`
- `DeepSeek-R1-Distill-Llama-70B`
- `bartowski/Qwen2.5-72B-Instruct-GGUF/Qwen2.5-72B-Instruct-Q4_K_M.gguf`

이 응용편에서는 **이런 복잡한 이름의 추가 부분들**을 다룹니다.

### 1. 업로더(uploader) 이름 — `slash(/)` 앞에 붙는 것

Hugging Face에서는 모델이 항상 `사용자명/모델이름` 형태예요.

```
froggeric/Qwen3.6-27B-MTP-GGUF
   ↑              ↑
업로더         실제 모델 이름
```

자주 보이는 업로더들:

| 업로더 | 정체 | 뭘 올리나요? |
|---|---|---|
| `Qwen/...` | Alibaba 공식 | 원본 Qwen 모델 |
| `meta-llama/...` | Meta 공식 | 원본 Llama 모델 |
| `google/...` | Google 공식 | 원본 Gemma 모델 |
| `bartowski/...` | 커뮤니티 | GGUF 변환본 (가장 빠름) |
| `unsloth/...` | 커뮤니티 | GGUF + 가이드 |
| `mlx-community/...` | 커뮤니티 | MLX 변환본 |
| `lmstudio-community/...` | LM Studio | LM Studio용 변환본 |
| `froggeric/...` | 커뮤니티 | MTP 등 특수 변환본 |

**팁**: 공식 계정(`Qwen/...`)은 원본만 올려요. llama.cpp로 돌리려면 GGUF 변환본이 필요한데, 이건 보통 `bartowski`나 `unsloth` 같은 커뮤니티 업로더에서 받습니다.

### 2. Dense vs MoE — `A3B` 같은 표기

이름에 `A`가 붙은 숫자가 보이면 **MoE 모델**이고, 안 보이면 **Dense 모델**이에요.

> 💡 **Dense** = 일반 모델. 모든 파라미터가 항상 같이 일하는 구조예요.
> 💡 **MoE (Mixture of Experts)** = "전문가 혼합" 구조. 모델 안에 여러 명의 작은 전문가가 들어 있어서, 입력에 따라 일부만 활성화됩니다.

MoE 표기 읽는 법:
- `35B` = 전체 파라미터는 35B
- `A3B` = 한 번에 **3B만 활성화** (Active 3B)

장점: 메모리는 35B만큼 차지하지만 속도는 3B처럼 빠릅니다. 큰 모델의 똑똑함과 작은 모델의 속도를 둘 다 가져가려는 구조예요.

### 3. 변형 태그 (모델에 가해진 추가 작업)

| 태그 | 무슨 뜻? | 언제 쓰나요? |
|---|---|---|
| `Thinking` / `Reasoning` / `R1` | 추론 강화 (생각 과정 보임) | 어려운 문제 |
| `Distill` | 큰 모델에서 증류해 작아진 것 | 가벼운 버전 |
| `MTP` | Multi-Token Prediction 가속 | 빠른 추론 |
| `Hybrid Thinking` | 추론 모드 ON/OFF 가능 | 어려운 문제 + 일반 작업 둘 다 |
| `Merge` / `Merged` | 여러 모델 가중치를 섞은 것 | 커뮤니티 변형 |
| `Abliterated` / `Uncensored` | 안전장치(거절 답변) 제거 | 민감한 주제 답함 |

### 4. 양자화 표기 — `Q4_K_M` 같은 것

모델 파일을 다운받을 때 파일명에 `Q4_K_M` 같은 표기가 붙어요. 이게 **양자화 레벨**이에요.

> 💡 **양자화(Quantization)** = 모델을 가볍게 줄이는 압축 기술. 원본은 16비트로 저장되는데, 4비트나 8비트로 줄이면 메모리는 줄지만 품질이 살짝 떨어져요.

#### `Q` 뒤의 숫자 = 비트 수

- `Q4` = 4비트 (가장 흔한 표준)
- `Q5` = 5비트
- `Q6` = 6비트
- `Q8` = 8비트
- `bf16` / `fp16` = 16비트 (양자화 없음, 풀 품질)

숫자가 클수록 메모리는 더 먹지만 품질은 좋아져요.

#### 뒤의 `_K_M`, `_K_S`는 세부 변형

K-양자화의 세부 옵션이에요. `M`(Medium), `S`(Small), `L`(Large)을 뜻해요.

- `Q4_K_M` ← **이게 표준**, 가장 균형 잡힘
- `Q4_K_S` ← 살짝 더 작음, 품질 살짝 더 떨어짐
- `Q4_K_L` ← 살짝 더 큼, 품질 살짝 더 좋음

특별한 이유 없으면 **`Q4_K_M`**으로 받으면 됩니다.

#### 27B 모델 기준 메모리 비교

| 양자화 | 메모리 | 품질 |
|---|---|---|
| `Q4_K_M` | ~16GB | 양호 (표준) |
| `Q5_K_M` | ~19GB | 좋음 |
| `Q6_K` | ~22GB | 우수 |
| `Q8_0` | ~28GB | 거의 원본 |
| `bf16` | ~54GB | 원본 |

### 5. 파일 형식

이름에 같이 나오지만 양자화가 아니라 **파일 형식**인 것들이에요.

- `GGUF` = llama.cpp용 파일 형식
- `MLX` = MLX용 파일 형식
- `safetensors` = 원본 모델 파일 형식 (양자화 안 된 풀 사이즈)

### 6. 다른 양자화 방식 (참고만)

`Q4_K_M` 계열 외에도 다른 양자화 방식이 있어요. 주로 NVIDIA GPU에서 쓰입니다.

- `AWQ` (Activation-aware Weight Quantization)
- `GPTQ` (Generative Pre-trained Transformer Quantization)
- `EXL2` (ExLlama V2)

llama.cpp를 쓸 거면 **`GGUF` 형식 + `Q4_K_M` 양자화** 조합이 가장 무난한 선택이에요.

### 실전 — 복잡한 이름 해석해보기

#### `froggeric/Qwen3.6-27B-MTP-GGUF`
- **froggeric**: 업로더 (커뮤니티)
- **Qwen**: Alibaba가 만듦
- **3.6**: 3.6 버전
- **27B**: 27B 파라미터 dense 모델
- **MTP**: Multi-Token Prediction 가속 변형
- **GGUF**: llama.cpp용 파일 형식

→ 즉, "froggeric이라는 사람이 Qwen 3.6 27B 모델에 MTP 가속을 입혀서 GGUF로 변환해 올린 모델"

#### `DeepSeek-R1-Distill-Llama-70B`
- **DeepSeek**: DeepSeek가 만듦
- **R1**: Reasoning(추론) 모델 1세대
- **Distill**: 큰 R1 모델을 → 작은 Llama 70B에 증류
- **Llama**: 베이스가 Meta의 Llama
- **70B**: 70B 크기

→ 즉, "DeepSeek의 거대한 R1 추론 모델을 Llama 70B에 증류해서, 가정용 하드웨어에서도 R1처럼 추론할 수 있게 만든 모델"

#### `bartowski/Qwen2.5-72B-Instruct-GGUF` 안의 `Qwen2.5-72B-Instruct-Q4_K_M.gguf`
- **bartowski**: 업로더 (커뮤니티)
- **Qwen2.5**: Alibaba의 Qwen 2.5
- **72B**: 72B 파라미터
- **Instruct**: 지시 따름
- **GGUF**: 파일 형식 (폴더명에 붙음)
- **Q4_K_M**: 양자화 레벨 (파일명에 붙음)

→ 즉, "Alibaba의 Qwen 2.5 72B Instruct 원본을, bartowski가 GGUF 형식의 Q4_K_M 양자화로 변환해 올린 파일"

### 헷갈리기 쉬운 점

- **`B`의 두 가지 의미**: 그냥 `27B`, `35B`는 전체 파라미터 수. 앞에 `A`가 붙은 `A3B`는 동시에 활성화되는 파라미터 수 (MoE 한정).
- **대시(-) vs 공백( )**: `Qwen3.6-27B`와 `Qwen3.6 27B`는 같은 모델, 표기만 다름.
- **모델 이름 vs 파일명**: 모델 이름은 `Qwen3.6-27B`, 실제 다운받는 파일은 `Qwen3.6-27B-Instruct-Q4_K_M.gguf`처럼 양자화·파일 형식이 뒤에 더 붙어요.
- **`/` 앞은 업로더**: `froggeric/Qwen3.6-27B-MTP-GGUF`에서 `froggeric`은 업로더 이름이지 모델 일부가 아닙니다.

### 정리

응용편에서 추가로 알 수 있는 것:
1. **누가 올렸나** — 업로더 (`/` 앞부분)
2. **Dense인가 MoE인가** — `A` 붙은 숫자
3. **어떤 변형인가** — Distill, Merge, MTP 등
4. **얼마나 압축됐나** — 양자화 표기 (Q4_K_M)
5. **어떤 파일 형식인가** — GGUF, MLX, safetensors

기본편 4가지 + 응용편 5가지 = 총 9가지 체크포인트로 어떤 복잡한 이름이라도 100% 읽을 수 있어요.
<!-- SYNC:END src="4-model-name/primitives/로컬-모델-이름-이해하기-응용편.md" -->

---

## 총 정리

이름만 보고 알 수 있는 9가지 체크포인트:

**기본편 (4가지)**
1. 누가 만들었나 — 패밀리
2. 얼마나 신버전인가 — 버전 번호
3. 얼마나 큰가 — B 표기
4. 어디에 쓰는 모델인가 — 용도 태그

**응용편 (5가지)**
5. 누가 올렸나 — 업로더 (`/` 앞)
6. Dense인가 MoE인가 — `A` 붙은 숫자
7. 어떤 변형인가 — Distill, Merge, MTP 등
8. 얼마나 압축됐나 — 양자화 표기 (Q4_K_M)
9. 어떤 파일 형식인가 — GGUF, MLX, safetensors

이 9가지로 어떤 모델 이름이든 100% 읽을 수 있어요.

## 다음 편에서

[5편 (모델 속도)](/guide/5-model-speed/)에서는 로컬 모델의 속도를 결정짓는 요인들 — 메모리 대역폭, 메모리 용량, 양자화 등 — 을 자세히 봅니다.
