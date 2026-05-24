---
tags: [migration, llama-cpp, brew]
last_updated: 2026-05-24
---

# PR 빌드에서 brew master로 옮기기

## 왜 옮기나요?

[[7-model-run/index|7편]]을 따라 `~/llama.cpp`에 PR #22673을 빌드해 두셨을 거예요. 그 PR이 **2026년 5월 16일에 llama.cpp master에 머지**됐어요. brew 공식 빌드(b9290 이후)에도 MTP 지원이 포함됩니다.

이제 직접 빌드한 `~/llama.cpp`는 안 써도 돼요. 옮기면 좋은 점:

- **`brew upgrade` 한 줄로 항상 최신 유지** (다음 머지·최적화 자동 반영)
- **디스크 회수** (`~/llama.cpp/build/` 삭제 — 빌드 옵션에 따라 수백 MB ~ 수 GB)
- **명령어 단순화** — 풀 경로 (`~/llama.cpp/build/bin/llama-server`) → 짧은 `llama-server`
- **master 신규 기능 활용** — `prompt cache` (8 GiB 자동), `-fit` 자동 메모리 조정 등

---

## 옮기는 절차

### Step 1 — brew 업그레이드 + MTP 지원 확인

```sh
brew upgrade llama.cpp
```
![[Xnip2026-05-24_11-37-21.png]]
업그레이드 끝나면 MTP 옵션이 들어왔는지 확인:

```sh
llama-server --help 2>&1 | grep "spec-type"
```
![[Xnip2026-05-24_11-38-24.png]]
출력에 `draft-mtp`가 보이면 OK. 안 보이면 brew 캐시가 오래된 버전을 가리키는 거니까 `brew update` 먼저 한 번 더 돌리세요.

> 옵션 이름이 살짝 바뀌었어요. PR 빌드의 `--spec-type mtp` → master의 **`--spec-type draft-mtp`**. master에선 다른 spec backend(`draft-eagle3`, `ngram-cache` 등)도 같이 들어와서 이름이 명확해졌습니다.

### Step 2 — 채팅 템플릿을 안전한 곳으로 옮기기 (삭제 전 백업)

`~/llama.cpp`를 통째 삭제할 거니까, 그 안의 [[속도-향상#1단계 (필수) — Fixed Chat Template 적용|Fixed Chat Template]]을 먼저 옮겨 둡니다.

위치는 **`~/models/qwen3.6-templates/`** 로 정합니다. 27B와 35B A3B 둘 다 쓰는 템플릿이라 모델 옆에 두는 게 자연스러워요.

```sh
mkdir -p ~/models/qwen3.6-templates
cp ~/llama.cpp/templates/qwen3.6/chat_template.jinja ~/models/qwen3.6-templates/
```

확인:

```sh
ls ~/models/qwen3.6-templates/
```

`chat_template.jinja`가 보이면 백업 완료.

이러면 `~/models/` 트리가 이렇게 깔끔해져요:

```
~/models/
├── qwen3.6-27b-mtp/
├── qwen3.6-35b-a3b-mtp/
└── qwen3.6-templates/
    └── chat_template.jinja
```

### Step 3 — 도는 중인 llama-server 모두 종료

PR 빌드든 brew 바이너리든, 옛 템플릿 경로 (`~/llama.cpp/templates/...`)를 가리킨 채 도는 서버는 모두 끕니다. 곧 그 폴더를 삭제할 거라 그 전에 멈춰야 해요.

각 터미널에서 **Ctrl+C**로 끄거나, 한 번에:

```sh
pkill -f llama-server
```

확인:

```sh
ps aux | grep llama-server | grep -v grep
```

→ 출력이 비면 모두 종료된 상태.

### Step 4 — 새 명령어로 재시작

**바뀐 점 정리:**

| 항목      | 옛 (PR 빌드)                            | 새 (brew master)                  |
| ------- | ------------------------------------ | -------------------------------- |
| 실행 경로   | `~/llama.cpp/build/bin/llama-server` | `llama-server`                   |
| MTP 플래그 | `--spec-type mtp`                    | `--spec-type draft-mtp`          |
| 템플릿 경로  | `~/llama.cpp/templates/qwen3.6/...`  | `~/models/qwen3.6-templates/...` |
|         |                                      |                                  |

**터미널 A — 27B:**

```sh
llama-server \
  -m ~/models/qwen3.6-27b-mtp/Qwen3.6-27B-Q8_0-mtp.gguf \
  --spec-type draft-mtp --spec-draft-n-max 3 \
  --jinja \
  --chat-template-file ~/models/qwen3.6-templates/chat_template.jinja \
  -np 1 -c 131072 \
  --temp 0.7 --top-k 20 \
  -ngl 99 --port 8081
```

> 27B 컨텍스트는 **131072 (128K)** 로 시작 권장. 256K는 듀얼 운영에서 Metal compute 에러가 나는 경우가 있어요. 큰 컨텍스트가 정말 필요하면 35B A3B 서버를 잠시 끄고 27B만 256K로 띄우면 됩니다.

**터미널 B — 35B A3B:**

```sh
llama-server \
  -m ~/models/qwen3.6-35b-a3b-mtp/Qwen3.6-35B-A3B-MTP-UD-Q8_K_XL.gguf \
  --spec-type draft-mtp --spec-draft-n-max 3 \
  --jinja \
  --chat-template-file ~/models/qwen3.6-templates/chat_template.jinja \
  -np 1 -c 65536 \
  --temp 0.7 --top-k 20 \
  -ngl 99 --port 8082
```

각 터미널에 `server is listening on http://127.0.0.1:808x` 메시지가 뜨면 OK.

### Step 5 — Pi에서 동작 확인

Pi 세션 안에서 `/model`로 양쪽 모델 차례로 골라 짧은 프롬프트(`hello`) 던져 보세요. 응답이 정상이면 끝.

**참고 — brew master 측정치 (M4 Max 128GB, 듀얼 운영 + Fixed Template):**

| 모델 | 컨텍스트 | tok/s (실측) | MTP 수용률 |
|---|---|---|---|
| 35B A3B Q8 | 64K | **~73 tok/s** | ~72% |
| 27B Q8 | 128K | 23+ tok/s | — |

PR 빌드보다 빨라요. master 머지 후 들어온 최적화 덕분.

### Step 6 — PR 빌드 폴더 삭제

이상 없으면 옛 빌드 폴더 통째 삭제. 먼저 용량 확인:

```sh
du -sh ~/llama.cpp
```

삭제:

```sh
rm -rf ~/llama.cpp
```

회수 확인:

```sh
df -h ~
```

> 빌드할 때 어떤 타깃을 만들었느냐에 따라 회수량은 다릅니다. 우리 시리즈처럼 `llama-cli`·`llama-server`만 빌드했으면 보통 **수백 MB ~ 1 GB** 정도예요. 전체 타깃·테스트까지 빌드했으면 5~10 GB까지 가기도 합니다.

> ⚠️ 삭제 전에 **Step 2의 템플릿 백업이 `~/models/qwen3.6-templates/`에 잘 있는지** 한 번 더 확인하세요. 한 번 지우면 다시 받아야 합니다.

---
## 참고
- [llama.cpp PR #22673 (머지된 MTP PR)](https://github.com/ggml-org/llama.cpp/pull/22673)
- [[llama-cpp-pr-build|옛 PR 빌드 절차]] —  기록용
- [[try-the-model|모델 시험 해보기]] — 새 명령어로 갱신될 primitive
- [[dual-model-ops|듀얼 모델 운영]] — 새 명령어로 갱신될 primitive
