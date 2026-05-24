---
tags: [install, llama-cpp, brew]
last_updated: 2026-05-24
---

# llama.cpp 설치 (brew)

PR #22673이 2026/5/16에 master에 머지돼서, 이제 brew 빌드(`b9290+`)에 MTP 지원이 포함됩니다. 직접 빌드 안 해도 돼요.

## 설치

```sh
brew install llama.cpp
```

이미 깔려 있으면:

```sh
brew upgrade llama.cpp
```

## MTP 지원 확인

```sh
llama-server --help 2>&1 | grep "spec-type"
```

출력에 `draft-mtp`가 보이면 끝. 안 보이면 brew 캐시가 오래된 거예요:

```sh
brew update && brew upgrade llama.cpp
```

## Fixed Chat Template 받기

Qwen 공식 template은 vLLM 전용 문법 때문에 llama.cpp에서 tool call이 깨져요. [[속도-향상]] 참고. 수정본 받기:

```sh
hf download froggeric/Qwen-Fixed-Chat-Templates \
  --include "qwen3.6/chat_template.jinja" \
  --local-dir ~/models/qwen3.6-templates
```

`--local-dir`이 `qwen3.6/` 하위 폴더를 만드는데, 우리 명령어는 평탄한 경로를 가정해요:

```sh
mv ~/models/qwen3.6-templates/qwen3.6/chat_template.jinja ~/models/qwen3.6-templates/
rmdir ~/models/qwen3.6-templates/qwen3.6
```

확인:

```sh
ls ~/models/qwen3.6-templates/
```

`chat_template.jinja` 보이면 끝.

## 다음 단계

- 모델 받기 → [[huggingface-download]]
- 모델 띄우기 → [[try-the-model]]
- 이미 PR 빌드한 사람 → [[pr-to-brew-migration|brew로 옮기기]]
