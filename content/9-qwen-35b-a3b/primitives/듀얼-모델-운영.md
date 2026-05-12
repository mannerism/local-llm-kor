---
tags: [tool, deployment, multi-model]
last_updated: 2026-05-12
---

# 듀얼 모델 운영 (27B + 35B A3B)

같은 머신에서 27B와 35B A3B를 **포트만 다르게** 동시 가동하고, Pi의 `models.json`에 둘 다 등록해서 `/model`로 즉시 전환합니다.

## 왜 이 구조인가

- **포트 분리** — llama-server 한 프로세스는 한 모델만 로드 가능. 두 모델을 동시에 띄우려면 서로 다른 포트가 필요해요. 8081(27B)·8082(35B)로 가요.
- **Pi 멀티 provider** — Pi `models.json`은 여러 provider를 등록할 수 있고, `/model`로 세션 안에서 즉시 전환됩니다. 재시작·재로드 없음.
- **컨텍스트 비대칭** — 27B는 깊은 작업용이라 큰 컨텍스트(`262144` = 256K)가 의미 있지만, 35B A3B는 빠른 일상 작업용이라 `65536` = 64K로 충분. KV cache 메모리도 절약됩니다.

## 구조

```
[Terminal A]  llama-server 27B     → port 8081
[Terminal B]  llama-server 35B-A3B → port 8082
[Terminal C]  Pi                   → models.json에 둘 다 등록
                                     /model로 전환
```

## 0. GPU wired memory 한도 올리기 (사전 작업)

macOS는 기본적으로 GPU가 점유할 수 있는 메모리를 **전체 RAM의 ~75%** (128 GB 머신 기준 ~96 GB)로 제한해요. 두 모델을 동시에 띄우고 컨텍스트까지 늘리면 이 한도에 막힐 수 있어서 미리 올려 둡니다.

```sh
sudo sysctl iogpu.wired_limit_mb=114688
```

→ GPU가 쓸 수 있는 메모리를 **112 GB**로 확장. macOS 시스템용으로 16 GB 정도는 항상 남겨 두는 셈.

영구 적용하려면 `/etc/sysctl.conf`에 같은 줄을 추가하세요 (재부팅 후 유지). 안 하면 재부팅 시 기본값으로 돌아갑니다.

## 1. 27B는 그대로 (port 8081)

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

![[Xnip2026-05-12_09-23-31.png]]

## 2. 35B A3B를 port 8082에 (새 터미널)

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

![[Xnip2026-05-12_09-26-25.png]]

두 모델 모두 가동된 상태의 mactop — 메모리 약 **88 GB** 사용:

![[Xnip2026-05-12_09-25-02.png]]

### 잠깐 — 35B A3B는 파일이 39 GB인데 왜 메모리는 23 GB만 늘었지?

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

### 실제로 어떻게 변할까

지금부터 Pi에서 35B A3B에 **여러 종류의 작업**(코드, 문서, 한국어 응답, 수학 등)을 시켜 보면 새로운 expert가 차례로 RAM으로 올라와요. **100~110 GB** 정도에서 평형이 잡힐 거예요. swap이 0인 한 정상 동작 범위입니다.

## 3. models.json 업데이트

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

![[Xnip2026-05-12_09-28-27.png]]

## 4. Pi에서 전환

Pi 세션 안에서:
```
/model
```

목록에서 `local-llama-27b` 또는 `local-llama-35b-a3b` 선택. **재시작 없이 즉시 전환**됩니다.

`/model` 입력 시 두 모델이 보이는 화면:

![[Xnip2026-05-12_09-30-33.png]]

35B A3B로 전환된 직후 — 컨텍스트 64K 한도 표시:

![[Xnip2026-05-12_09-31-58.png]]

## 5. 컨텍스트 윈도우 올리기 (선택)

64K로 시작했지만, 코드 위주 작업이면 도구 호출·파일 읽기 결과가 누적돼 컨텍스트가 빨리 차요. 늘려 두면 한 세션에서 더 많이 굴릴 수 있습니다.

### 메모리 비용

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

### 권장: 128K

35B A3B는 **빠른 일상 작업용**이라 256K 거의 안 채워요. 큰 컨텍스트 필요하면 27B로 돌리는 게 듀얼 전략의 본질. 128K가 균형점.

> Step 0에서 `iogpu.wired_limit_mb=114688` (112 GB)을 이미 올려 뒀으니 128K든 256K든 한도엔 안 막힙니다.

### 절차

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