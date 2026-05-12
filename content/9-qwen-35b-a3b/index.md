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

![[qwen-3.6-35b-a3b]]

---

## 다운로드

![[35b-a3b-다운로드]]

---

## 듀얼 모델 운영

![[듀얼-모델-운영]]

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
