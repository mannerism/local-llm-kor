---
tags: [tool, coding-agent, config]
last_updated: 2026-05-12
---

# Pi에 llama-server 연결

Pi는 `~/.pi/agent/models.json`에서 커스텀 provider를 읽습니다. llama-server는 OpenAI 호환 API라서 `api: "openai-completions"`로 등록하면 됩니다.

## 1. 설정 폴더 만들기

```sh
mkdir -p ~/.pi/agent
```
![[Xnip2026-05-11_23-50-25.png]]
## 2. models.json 생성

아래 한 덩어리를 그대로 터미널에 붙여넣으면 파일이 만들어집니다.

```sh
cat > ~/.pi/agent/models.json <<'EOF'
{
  "providers": {
    "local-llama": {
      "baseUrl": "http://localhost:8081/v1",
      "api": "openai-completions",
      "apiKey": "dummy",
      "models": [
        {
          "id": "qwen3.6-27b",
          "name": "Qwen 3.6 27B MTP (Local)",
          "reasoning": false,
          "input": ["text"],
          "contextWindow": 262144,
          "maxTokens": 32000,
          "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 }
        }
      ]
    }
  }
}
EOF
```

> `contextWindow`는 7편에서 llama-server에 준 `-c 262144`와 맞춰요. `apiKey`는 llama-server가 인증을 요구하지 않아서 아무 문자열이면 됩니다.
> 
## 3. 파일 확인

```sh
cat ~/.pi/agent/models.json
```

위에 붙여 넣은 JSON이 그대로 출력되면 성공.
![[Xnip2026-05-11_23-52-07.png]]

## 터미널 두 개 띄우기

이제부터는 터미널을 **두 개** 사용합니다.

- **터미널 A** — llama-server를 띄워 두는 곳. 모델 추론이 도는 백엔드라 켜져 있어야 Pi가 요청을 보낼 수 있어요.
- **터미널 B** — Pi를 실행하는 곳. 우리가 실제로 코딩 작업을 하는 화면.

둘은 같은 머신 안에서 `localhost:8081`로 통신합니다.

## 4. (터미널 A) llama-server 가동

새 터미널을 하나 열고 다음 명령어를 실행하세요. 이 창은 **닫지 말고 그대로 두세요.**

```sh
~/llama.cpp/build/bin/llama-server \
  -m ~/models/qwen3.6-27b-mtp/Qwen3.6-27B-Q8_0-mtp.gguf \
  --spec-type mtp --spec-draft-n-max 3 \
  -np 1 -c 262144 \
  --temp 0.7 --top-k 20 \
  -ngl 99 --port 8081
```

`server is listening on ...:8081` 메시지가 나오면 준비 완료.

![[Xnip2026-05-11_23-58-44.png]]
## 5. (터미널 B) Pi 실행

**다른 터미널을 새로 띄워서** 작업할 프로젝트 디렉터리로 이동:

```sh
cd ~/your-project
```

Pi 띄우기:

```sh
pi
```

처음 실행하면 초기 설정 화면이 몇 번 뜹니다 (작업 디렉터리 확인, 테마 선택 등). 기본값으로 그대로 넘기면 돼요.

![[Xnip2026-05-12_00-00-46.png]]

![[Xnip2026-05-12_00-01-22.png]]

![[Xnip2026-05-12_00-01-32.png]]

### 화면 읽는 법

하단 상태바를 확인하세요.

- **왼쪽 위** — 작업 디렉터리와 git 브랜치 (`~/dev/프로젝트명 (main)`)
- **왼쪽 아래** — 컨텍스트 사용량 (`0.0%/262k (auto)`). `262k`는 `models.json`의 `contextWindow`와 일치
- **오른쪽 아래** — 현재 모델명. **`qwen3.6-27b`로 표시되면 우리 llama-server에 정상 연결된 것**

`models.json`에 provider가 하나만 있을 땐 Pi가 자동으로 그 모델을 선택해요. 별도로 `/model`을 부를 필요가 없습니다.

## 6. (선택) 모델 바꾸기

나중에 provider·모델을 늘렸을 때 세션 안에서 전환:

```
/model
```

`models.json`은 `/model`을 부를 때마다 다시 읽어서 **재시작 없이 수정·추가가 됩니다.**

## 7. 첫 프롬프트 던지기

테스트로 한번 현재 프로젝트 디렉터리를 읽어 보라고 시켜 봤어요.

![[Xnip2026-05-12_00-04-55.png]]

![[Xnip2026-05-12_00-04-57.png]]

응답이 정상적으로 흘러나오면 Pi + Qwen 3.6 27B MTP 셋업은 끝.

### 진짜로 돌아갑니다 — 발열·소음 주의

추론이 시작되자마자 **GPU 사용률 99%**, 맥북 팬은 **100%로 풀가동**됩니다. 살면서 맥북 프로 팬 소리를 이렇게 크게 들어본 건 처음일 거예요. 본체도 빠르게 뜨거워지고요.

> 27B 모델을 풀로 돌리면 사실상 **냉장고 급 전기**를 빨아먹는 셈이에요. 다음을 추천합니다.
> - 노트북을 **무릎 위에 올려놓지 말 것** (저온화상 위험)
> - **통풍 되는 평평한 곳** + 가능하면 **노트북 스탠드**
> - 장시간 작업이면 **전원 연결** (배터리 빠른 속도로 닳음)
> - 발열이 신경 쓰이면 7편의 `-c` 값을 낮추거나, 더 작은 모델로 잠시 전환해 보세요