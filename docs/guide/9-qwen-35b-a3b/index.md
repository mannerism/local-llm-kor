# Qwen 3.6 35B A3B 추가하기 (9편)

> 8편까지 Qwen 3.6 27B를 daily driver로 셋업하고 Fixed Template까지 적용해서 23 tok/s 회복했어요. 이번 편에서는 **35B A3B 모델을 추가**해 **듀얼 모델 운영**으로 갑니다. 작업 난이도에 따라 27B(품질)와 35B A3B(속도)를 골라 쓰는 전략이에요.

## 사전 준비
- 8편 완료 (Pi + 27B 셋업 + Fixed Template)
- llama.cpp PR #22673 빌드 완료 (7편) — 새로 빌드할 필요 없어요
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

### 이게 뭐예요?

**총 35B 파라미터지만, 토큰마다 3.6B만 활성화되는 MoE(Mixture of Experts) 모델**이에요. 27B Dense와 비슷한 메모리를 차지하지만, 매 토큰 생성할 때 **계산량은 3.6B 모델 수준**이라 훨씬 빠릅니다.

### 이름 해석

| 부분 | 의미 |
|---|---|
| Qwen 3.6 | Alibaba의 Qwen 모델, 세대 3.6 |
| 35B | 총 파라미터 350억 |
| **A3B** | **Active 3B** — 매 토큰마다 활성화되는 파라미터 약 3.6B |

### MoE가 뭐길래 빠르냐

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

### 속도 vs 품질

| | Qwen 3.6 27B Dense | Qwen 3.6 35B A3B |
|---|---|---|
| 총 파라미터 | 27B | 35B |
| 활성 / 토큰 | 27B | 3.6B |
| 메모리 (Q8) | ~28 GB | ~39 GB |
| M4 Max 예상 tok/s | 23~28 | 60~100+ |
| 코드 품질 | 🟢 깊고 안정 | 🟡 빠르지만 얕음 |
| 깊은 추론 | 🟢 강함 | 🟡 약함 |
| Tool use | 🟢 안정 | 🟢 안정 |

### 어느 작업에 쓰면 좋나

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

### 우리가 이 모델을 추가하는 이유

8편까지 Qwen 3.6 27B를 daily driver로 정착시켰지만, **모든 작업이 깊은 추론을 요구하지는 않아요.** 가벼운 작업엔 27B가 오버킬. **27B + 35B A3B 듀얼 셋업**으로:

- 무거운 작업 → 27B (품질)
- 가벼운 작업 → 35B A3B (속도)

Anthropic이 Claude Sonnet과 Haiku를 따로 두는 것과 같은 발상이에요. 로컬 LLM에서 이걸 무료로 재현할 수 있다는 점이 매력.

### 참고

- 공식 HF: https://huggingface.co/Qwen/Qwen3.6-35B-A3B
- MTP GGUF: https://huggingface.co/havenoammo/Qwen3.6-35B-A3B-MTP-GGUF
- 표준 GGUF: https://huggingface.co/bartowski/Qwen_Qwen3.6-35B-A3B-GGUF
- [Qwen 3.6 35B A3B Review (buildfastwithai)](https://www.buildfastwithai.com/blogs/qwen3-6-35b-a3b-review)
- [Best Way to Run Qwen 3.6 35B MoE Locally (InsiderLLM)](https://insiderllm.com/guides/best-way-run-qwen-3-6-35b-moe-locally/)

---

## 다운로드

### 왜 이 레포(havenoammo)인가

Qwen 3.6 35B A3B GGUF는 크게 세 군데가 있어요.

| 레포 | 본체 | MTP |
|---|---|---|
| [bartowski](https://huggingface.co/bartowski/Qwen_Qwen3.6-35B-A3B-GGUF) | 표준 양자화 | ❌ |
| [unsloth](https://huggingface.co/unsloth/Qwen3.6-35B-A3B-GGUF) | Dynamic 2.0 (UD-XL) | ❌ |
| [havenoammo](https://huggingface.co/havenoammo/Qwen3.6-35B-A3B-MTP-GGUF) | **unsloth UD-XL 그대로** | ✅ |

havenoammo는 **unsloth UD-XL의 가중치 위에 MTP 헤드만 추가로 박은 버전**이에요. 본체는 unsloth와 동일. 정리하면:

- MTP 켜고 돌리면 → speculative decoding으로 추가 속도 시도
- MTP 끄고 돌리면 → unsloth UD-XL과 100% 동일 동작

우리가 이걸 고른 이유는 **유연성** 때문이에요.

1. **7편에서 PR #22673이 머지된 llama.cpp를 이미 빌드해 뒀음** — 재빌드 불필요
2. **MTP를 A/B 테스트할 수 있음** — 효과 있으면 켜고, 없으면 빼면 됨
3. **MTP 안 써도 unsloth와 동등한 품질** — 손해 보는 게 없음
4. **파일 크기 +1~2 GB 정도만 추가** (MTP 헤드 분량)

손해 없이 옵션 하나 더 챙기는 선택입니다.

### 어떤 양자화를 받을까

havenoammo UD-XL 시리즈 (Unsloth Dynamic 2.0 + MTP):

| 양자화 | 크기 | 품질 |
|---|---|---|
| UD-Q4_K_XL | 23.3 GB | 보통, 코딩엔 부족 |
| UD-Q5_K_XL | 27.5 GB | 좋음 |
| UD-Q6_K_XL | 32.7 GB | 매우 좋음 |
| **UD-Q8_K_XL** | **39.3 GB** | **거의 손실 없음** |

우리는 **UD-Q8_K_XL**로 가요. 27B를 Q8_0으로 쓰고 있는 것과 품질 기준을 맞추기 위함입니다. 27 GB 짜리 27B와 동시에 RAM에 올려도 128 GB 머신에 여유 충분.

### 다운로드

```sh
hf download havenoammo/Qwen3.6-35B-A3B-MTP-GGUF \
  --include "Qwen3.6-35B-A3B-MTP-UD-Q8_K_XL.gguf" \
  --local-dir ~/models/qwen3.6-35b-a3b-mtp
```

> ⚠ `--include` 안 쓰면 모든 양자화(약 180 GB)를 다 받아 버립니다. 7편에서 했던 실수 반복 X.


> _⚠️ 이미지 누락: `Xnip2026-05-12_09-17-36.png` — 옵시디언 vault 에서 동기화 필요_


### 확인

```sh
ls -lh ~/models/qwen3.6-35b-a3b-mtp/
```

`Qwen3.6-35B-A3B-MTP-UD-Q8_K_XL.gguf` (~39 GB)가 보이면 완료.

> _⚠️ 이미지 누락: `Xnip2026-05-12_09-20-19.png` — 옵시디언 vault 에서 동기화 필요_


---

## 듀얼 모델 운영

같은 머신에서 27B와 35B A3B를 **포트만 다르게** 동시 가동하고, Pi의 `models.json`에 둘 다 등록해서 `/model`로 즉시 전환합니다.

### 왜 이 구조인가

- **포트 분리** — llama-server 한 프로세스는 한 모델만 로드 가능. 두 모델을 동시에 띄우려면 서로 다른 포트가 필요해요. 8081(27B)·8082(35B)로 가요.
- **Pi 멀티 provider** — Pi `models.json`은 여러 provider를 등록할 수 있고, `/model`로 세션 안에서 즉시 전환됩니다. 재시작·재로드 없음.
- **컨텍스트 비대칭** — 27B는 깊은 작업용이라 큰 컨텍스트(`262144` = 256K)가 의미 있지만, 35B A3B는 빠른 일상 작업용이라 `65536` = 64K로 충분. KV cache 메모리도 절약됩니다.

### 구조

```
[Terminal A]  llama-server 27B     → port 8081
[Terminal B]  llama-server 35B-A3B → port 8082
[Terminal C]  Pi                   → models.json에 둘 다 등록
                                     /model로 전환
```

### 0. GPU wired memory 한도 올리기 (사전 작업)

macOS는 기본적으로 GPU가 점유할 수 있는 메모리를 **전체 RAM의 ~75%** (128 GB 머신 기준 ~96 GB)로 제한해요. 두 모델을 동시에 띄우고 컨텍스트까지 늘리면 이 한도에 막힐 수 있어서 미리 올려 둡니다.

```sh
sudo sysctl iogpu.wired_limit_mb=114688
```

→ GPU가 쓸 수 있는 메모리를 **112 GB**로 확장. macOS 시스템용으로 16 GB 정도는 항상 남겨 두는 셈.

영구 적용하려면 `/etc/sysctl.conf`에 같은 줄을 추가하세요 (재부팅 후 유지). 안 하면 재부팅 시 기본값으로 돌아갑니다.

### 1. 27B는 그대로 (port 8081)

8편 마지막의 최적 명령어. 이미 도는 중이면 건드릴 필요 없어요.

```sh
~/llama.cpp/build/bin/llama-server \
  -m ~/models/qwen3.6-27b-mtp/Qwen3.6-27B-Q8_0-mtp.gguf \
  --spec-type mtp --spec-draft-n-max 3 \
  --jinja \
  --chat-template-file ~/llama.cpp/templates/qwen3.6/chat_template.jinja \
  -np 1 -c 262144 \
  --temp 0.7 --top-k 20 \
  -ngl 99 --port 8081
```

27B만 가동된 상태의 mactop — 메모리 약 **65 GB** 사용:


> _⚠️ 이미지 누락: `Xnip2026-05-12_09-23-31.png` — 옵시디언 vault 에서 동기화 필요_


### 2. 35B A3B를 port 8082에 (새 터미널)

```sh
~/llama.cpp/build/bin/llama-server \
  -m ~/models/qwen3.6-35b-a3b-mtp/Qwen3.6-35B-A3B-MTP-UD-Q8_K_XL.gguf \
  --spec-type mtp --spec-draft-n-max 3 \
  --jinja \
  --chat-template-file ~/llama.cpp/templates/qwen3.6/chat_template.jinja \
  -np 1 -c 65536 \
  --temp 0.7 --top-k 20 \
  -ngl 99 --port 8082
```

> 27B 명령어와 비교하면 **`-m`(모델), `-c 65536`(컨텍스트), `--port 8082`** 셋만 다름.

35B A3B 서버 가동 완료 로그 (`server is listening on http://127.0.0.1:8082`):


> _⚠️ 이미지 누락: `Xnip2026-05-12_09-26-25.png` — 옵시디언 vault 에서 동기화 필요_


두 모델 모두 가동된 상태의 mactop — 메모리 약 **88 GB** 사용:


> _⚠️ 이미지 누락: `Xnip2026-05-12_09-25-02.png` — 옵시디언 vault 에서 동기화 필요_


#### 잠깐 — 35B A3B는 파일이 39 GB인데 왜 메모리는 23 GB만 늘었지?

39 GB 짜리 모델을 추가로 띄웠는데 메모리는 65 → 88 GB로 **23 GB만 늘었습니다.** 이유 세 가지가 겹쳐서 그래요.

**1. llama.cpp는 mmap을 씁니다 (가장 큰 이유)**

llama-server는 모델 파일을 **메모리 매핑(mmap)** 으로 로드해요. 풀어 쓰면:
- 39 GB를 RAM에 **통째로 복사하지 않습니다.** 운영체제에 "이 파일을 RAM처럼 다룰 수 있게 매핑만 해 줘"라고 부탁만 함
- 막 로드한 직후엔 **임베딩·출력 헤드·메타데이터 같은 핵심 부분만 실제 RAM 페이지로 올라옴**
- 나머지 가중치는 **디스크에 그대로 있다가** 추론 도중 그 부분을 쓰게 될 때 RAM으로 page-in 됩니다

→ mactop이 보여 주는 88 GB는 **현재 실제로 RAM에 올라온 페이지** 기준. 아직 안 쓴 가중치는 디스크에 남아 있어요.

**2. MoE는 expert가 lazy load됩니다**

35B A3B는 수십 개의 expert(전문가 서브네트워크) 중 **매 토큰마다 일부만 활성화**해요.
- 서버 가동 직후 = expert 대부분이 한 번도 안 만져진 상태 → 디스크에 머무름
- Pi에서 다양한 작업을 던지기 시작 = 그때그때 필요한 expert만 RAM으로 올라옴

Dense 모델인 27B는 매 토큰마다 전체 가중치를 다 만지니까 한 번 추론으로도 RAM이 빨리 찹니다. MoE는 천천히 차요.

**3. KV cache가 작게 잡혀 있음**

35B A3B는 `-c 65536` (64K)로 띄웠어요. 27B의 256K보다 1/4이라 KV cache 메모리도 그만큼 작아요.

#### 실제로 어떻게 변할까

지금부터 Pi에서 35B A3B에 **여러 종류의 작업**(코드, 문서, 한국어 응답, 수학 등)을 시켜 보면 새로운 expert가 차례로 RAM으로 올라와요. **100~110 GB** 정도에서 평형이 잡힐 거예요. swap이 0인 한 정상 동작 범위입니다.

### 3. models.json 업데이트

기존 `~/.pi/agent/models.json`을 아래 내용으로 덮어쓰세요. 한 번에 붙여 넣기:

```sh
cat > ~/.pi/agent/models.json <<'EOF'
{
  "providers": {
    "local-llama-27b": {
      "baseUrl": "http://localhost:8081/v1",
      "api": "openai-completions",
      "apiKey": "dummy",
      "models": [
        {
          "id": "qwen3.6-27b",
          "name": "Qwen 3.6 27B (Quality)",
          "reasoning": false,
          "input": ["text"],
          "contextWindow": 262144,
          "maxTokens": 32000,
          "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 }
        }
      ]
    },
    "local-llama-35b-a3b": {
      "baseUrl": "http://localhost:8082/v1",
      "api": "openai-completions",
      "apiKey": "dummy",
      "models": [
        {
          "id": "qwen3.6-35b-a3b",
          "name": "Qwen 3.6 35B A3B (Speed)",
          "reasoning": false,
          "input": ["text"],
          "contextWindow": 65536,
          "maxTokens": 16000,
          "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 }
        }
      ]
    }
  }
}
EOF
```

확인:
```sh
cat ~/.pi/agent/models.json
```

두 provider가 정상 등록된 화면:


> _⚠️ 이미지 누락: `Xnip2026-05-12_09-28-27.png` — 옵시디언 vault 에서 동기화 필요_


### 4. Pi에서 전환

Pi 세션 안에서:
```
/model
```

목록에서 `local-llama-27b` 또는 `local-llama-35b-a3b` 선택. **재시작 없이 즉시 전환**됩니다.

`/model` 입력 시 두 모델이 보이는 화면:


> _⚠️ 이미지 누락: `Xnip2026-05-12_09-30-33.png` — 옵시디언 vault 에서 동기화 필요_


35B A3B로 전환된 직후 — 컨텍스트 64K 한도 표시:


> _⚠️ 이미지 누락: `Xnip2026-05-12_09-31-58.png` — 옵시디언 vault 에서 동기화 필요_


### 5. 컨텍스트 윈도우 올리기 (선택)

64K로 시작했지만, 코드 위주 작업이면 도구 호출·파일 읽기 결과가 누적돼 컨텍스트가 빨리 차요. 늘려 두면 한 세션에서 더 많이 굴릴 수 있습니다.

#### 메모리 비용

| 컨텍스트 | KV cache (35B A3B 추정) | 64K 대비 증가 |
|---|---|---|
| 64K | ~3 GB | 베이스 |
| **128K** | **~5 GB** | **+2 GB** |
| 256K | ~10 GB | +7 GB |

지금 88 GB 사용 중이고, MoE expert가 점진적으로 page-in되면서 평형 100~110 GB. 거기에 KV 증가분 추가.

| 컨텍스트 | 평형 메모리 추정 |
|---|---|
| 64K | 100~110 GB |
| **128K** | **102~115 GB** |
| 256K | 110~125 GB |

#### 권장: 128K

35B A3B는 **빠른 일상 작업용**이라 256K 거의 안 채워요. 큰 컨텍스트 필요하면 27B로 돌리는 게 듀얼 전략의 본질. 128K가 균형점.

> Step 0에서 `iogpu.wired_limit_mb=114688` (112 GB)을 이미 올려 뒀으니 128K든 256K든 한도엔 안 막힙니다.

#### 절차

**1) 터미널 B의 35B 서버 종료** — Ctrl+C

**2) 새 명령어로 재시작 (`-c 65536` → `-c 131072`만 변경):**

```sh
~/llama.cpp/build/bin/llama-server \
  -m ~/models/qwen3.6-35b-a3b-mtp/Qwen3.6-35B-A3B-MTP-UD-Q8_K_XL.gguf \
  --spec-type mtp --spec-draft-n-max 3 \
  --jinja \
  --chat-template-file ~/llama.cpp/templates/qwen3.6/chat_template.jinja \
  -np 1 -c 131072 \
  --temp 0.7 --top-k 20 \
  -ngl 99 --port 8082
```

**3) `models.json`의 `contextWindow`도 같이 갱신** — `65536` → `131072`, `maxTokens` `16000` → `24000`:

```sh
cat > ~/.pi/agent/models.json <<'EOF'
{
  "providers": {
    "local-llama-27b": {
      "baseUrl": "http://localhost:8081/v1",
      "api": "openai-completions",
      "apiKey": "dummy",
      "models": [
        {
          "id": "qwen3.6-27b",
          "name": "Qwen 3.6 27B (Quality)",
          "reasoning": false,
          "input": ["text"],
          "contextWindow": 262144,
          "maxTokens": 32000,
          "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 }
        }
      ]
    },
    "local-llama-35b-a3b": {
      "baseUrl": "http://localhost:8082/v1",
      "api": "openai-completions",
      "apiKey": "dummy",
      "models": [
        {
          "id": "qwen3.6-35b-a3b",
          "name": "Qwen 3.6 35B A3B (Speed)",
          "reasoning": false,
          "input": ["text"],
          "contextWindow": 131072,
          "maxTokens": 24000,
          "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 }
        }
      ]
    }
  }
}
EOF
```

**4) Pi에서 `/model` 한 번 더 누르면** — `models.json` 자동 재로딩, 새 contextWindow 반영 (재시작 불필요).

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

## 다음 편 예고
- 10편: 두 모델로 같은 작업을 던져서 실측 비교. 속도·품질·일상 워크플로 정리

---

## 참고 자료
- [havenoammo/Qwen3.6-35B-A3B-MTP-GGUF](https://huggingface.co/havenoammo/Qwen3.6-35B-A3B-MTP-GGUF)
- [bartowski/Qwen_Qwen3.6-35B-A3B-GGUF](https://huggingface.co/bartowski/Qwen_Qwen3.6-35B-A3B-GGUF)
- [Qwen 3.6 35B A3B Review (buildfastwithai)](https://www.buildfastwithai.com/blogs/qwen3-6-35b-a3b-review)
- [Best Way to Run Qwen 3.6 35B MoE Locally (InsiderLLM)](https://insiderllm.com/guides/best-way-run-qwen-3-6-35b-moe-locally/)
- [Speculative Decoding on Qwen 3.6 (thc1006)](https://github.com/thc1006/qwen3.6-speculative-decoding-rtx3090)
- [Pi /model docs](https://pi.dev/docs/latest/models)

---

*이 페이지의 원본은 Obsidian vault `Personal/LocalLLM/9-qwen-35b-a3b/index.md` 에서 동기화됩니다.*
