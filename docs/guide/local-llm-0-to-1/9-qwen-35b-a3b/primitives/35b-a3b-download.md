---
tags: [model, download]
last_updated: 2026-05-12
---

# Qwen 3.6 35B A3B MTP 다운로드

## 왜 이 레포(havenoammo)인가

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

## 어떤 양자화를 받을까

havenoammo UD-XL 시리즈 (Unsloth Dynamic 2.0 + MTP):

| 양자화 | 크기 | 품질 |
|---|---|---|
| UD-Q4_K_XL | 23.3 GB | 보통, 코딩엔 부족 |
| UD-Q5_K_XL | 27.5 GB | 좋음 |
| UD-Q6_K_XL | 32.7 GB | 매우 좋음 |
| **UD-Q8_K_XL** | **39.3 GB** | **거의 손실 없음** |

우리는 **UD-Q8_K_XL**로 가요. 27B를 Q8_0으로 쓰고 있는 것과 품질 기준을 맞추기 위함입니다. 27 GB 짜리 27B와 동시에 RAM에 올려도 128 GB 머신에 여유 충분.

## 다운로드

```sh
hf download havenoammo/Qwen3.6-35B-A3B-MTP-GGUF \
  --include "Qwen3.6-35B-A3B-MTP-UD-Q8_K_XL.gguf" \
  --local-dir ~/models/qwen3.6-35b-a3b-mtp
```

> ⚠ `--include` 안 쓰면 모든 양자화(약 180 GB)를 다 받아 버립니다. 7편에서 했던 실수 반복 X.

![[Xnip2026-05-12_09-17-36.png]]

## 확인

```sh
ls -lh ~/models/qwen3.6-35b-a3b-mtp/
```

`Qwen3.6-35B-A3B-MTP-UD-Q8_K_XL.gguf` (~39 GB)가 보이면 완료.
![[Xnip2026-05-12_09-20-19.png]]