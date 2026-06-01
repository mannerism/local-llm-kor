---
tags: [reference, llm, model, huggingface]
last_updated: 2026-05-10
---
# Hugging Face에서 모델 다운로드

## 이게 뭐예요?
**Hugging Face에서 GGUF 모델 파일을 받아오는 CLI 방법이에요.**

## 설치

`uv`로 Hugging Face CLI(`hf`) 설치:

```sh
uv tool install huggingface_hub
```

설치 확인:

```sh
hf --version
```

![[Xnip2026-05-10_01-44-42.png]]

## 다운로드

> ⚠️ **항상 `--include`로 필요한 파일만 받으세요.** GGUF 저장소엔 양자화별로 8~12개 파일이 있고 합치면 100GB 넘어요.

```sh
hf download froggeric/Qwen3.6-27B-MTP-GGUF \
  --include "Qwen3.6-27B-Q8_0-mtp.gguf" \
  --local-dir ~/models/qwen3.6-27b-mtp
```

다운로드가 끝나면 이런 식으로 표시돼요:

![[Xnip2026-05-10_10-22-53.png]]
## 다운로드된 모델 확인

받은 모델은 두 군데에 있을 수 있어요:
- `--local-dir`로 지정한 위치 (예: `~/models/...`)
- Hugging Face 기본 캐시 (`~/.cache/huggingface/hub/`)

### 직접 받은 위치 확인

```sh
du -sh ~/models/*
```
![[Xnip2026-05-10_10-54-35.png]]
### HF 캐시 확인

```sh
hf cache list
```

모델별 크기, 경로, 마지막 사용 시각이 표로 나와요.
![[Xnip2026-05-10_10-55-02.png]]
## Gated 모델 (Llama 등)

일부 모델은 다운 전 라이선스 동의 + 토큰 필요해요.

1. 모델 페이지에서 "Request access" 클릭
2. https://huggingface.co/settings/tokens 에서 토큰 발급 (read 권한)
3. 로그인:
   ```sh
   hf auth login
   ```
   또는 환경변수: `export HF_TOKEN=hf_xxxxx`

## 더 알아보기
- [공식 문서](https://huggingface.co/docs/huggingface_hub/guides/cli)
