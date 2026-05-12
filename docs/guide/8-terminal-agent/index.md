# 터미널 코딩 에이전트 고르기 (8편)

> [[7-model-run/index|7편]]에서 Qwen 3.6 27B MTP를 daily driver로 정했어요. 이제 이 모델을 **Claude Code 대용**으로 굴릴 터미널 에이전트가 필요합니다. 후보를 잠깐 훑어 픽을 정하고, 그대로 설치·연결까지 갑니다.

## 사전 준비
- [[7-model-run/index|7편]] 완료 (`localhost:8081`에서 llama-server 가동 중)

---

## 후보들

요즘 자주 거론되는 터미널 코딩 에이전트는 대충 이런 것들이 있어요.

| 도구 | 한 줄 요약 |
|---|---|
| **aider** | OG 터미널 에이전트, git 통합 최강, 가장 안정 |
| **OpenCode** | SST 팀, 95K stars, 75+ provider 지원 |
| **OpenAgent** | Claude Code drop-in 대체 표방, 셋업 마법사 |
| **Pi** | 미니멀 harness, "primitives over features" |

---

## 우리에게 중요한 기준

이 시리즈는 단순히 "Claude Code 따라하기"가 아니라, **로컬 LLM을 내 워크플로에 맞춰 깊게 다루는 것**이 목표예요. 그래서 다음 두 가지를 가장 우선합니다.

1. **커스터마이즈 가능성** — 프롬프트·도구·세션 흐름을 직접 바꿀 수 있는가
2. **미니멀함** — "기능 풀세트"보다 필요한 것만 골라 쌓는 구조

이 둘을 둘 다 만족하는 건 **Pi**예요.

- aider는 안정적이지만 정해진 워크플로를 따라가야 함
- OpenCode는 화려하지만 75+ provider 지원하느라 config가 무거움
- OpenAgent는 Claude Code UX 모방이라 친숙하지만 결국 "Claude Code의 또 다른 버전"

Pi는 시작이 황량하지만, **TypeScript로 본인만의 에이전트를 빌드해 가는 구조**라 시리즈의 학습 목적과 잘 맞아요.

---

## Pi란

![[pi]]

---

## Pi 설치

![[pi-설치]]

---

## llama-server 연결

![[pi-llama-server-연결]]

---

## 동작 확인

터미널 두 개를 띄웁니다.

**터미널 A — llama-server**
```sh
~/llama.cpp/build/bin/llama-server \
  -m ~/models/qwen3.6-27b-mtp/Qwen3.6-27B-Q8_0-mtp.gguf \
  --spec-type mtp --spec-draft-n-max 3 \
  -np 1 -c 262144 \
  --temp 0.7 --top-k 20 \
  -ngl 99 --port 8081
```

**터미널 B — Pi**
```sh
cd ~/your-project
pi
```

세션 안에서:
```
/model
```
→ `local-llama / qwen3.6-27b` 선택

이제 Pi 프롬프트에 코딩 작업을 던지면 로컬 Qwen으로 처리됩니다.

---

## 속도 향상시키기

[[7-model-run/index|7편]] 셋업 그대로 Pi에 붙여 보면 체감 속도가 의외로 느릴 수 있어요. 컨텍스트 누적, 무한 thinking, 깨진 chat template 같은 함정들이 있습니다. 아래에서 한 번에 정리.

![[속도-향상]]

---

## 다음 편 예고
- [[9-qwen-35b-a3b/index|9편]]: 실제 코딩 작업으로 Pi + Qwen 3.6 27B 검증, 필요한 extension·skill 추가

---

## 참고 자료
- [Pi — pi.dev](https://pi.dev)
- [Pi Custom Models docs](https://pi.dev/docs/latest/models)
- [Pi Custom Provider docs](https://pi.dev/docs/latest/custom-provider)
- [froggeric/Qwen-Fixed-Chat-Templates](https://huggingface.co/froggeric/Qwen-Fixed-Chat-Templates)
