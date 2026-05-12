---
tags: [reference, llama.cpp, build]
last_updated: 2026-05-10
---

# llama.cpp PR 브랜치 빌드

## 이게 뭐예요?
**llama.cpp의 stable(brew) 버전엔 아직 들어가지 않은 신기능**(예: MTP, 새 모델 지원)을 쓰고 싶을 때, 그 기능이 들어있는 pull request 브랜치를 직접 빌드하는 방법이에요.

## 언제 필요해요?
- stable에 없는 신기능을 빨리 쓰고 싶을 때
- PR이 머지 대기 중이라 brew 버전엔 안 들어와있을 때

추후 PR이 머지되면 `brew upgrade llama.cpp`로 통일하면 됩니다.

## brew 거랑 충돌하지 않아요

| 빌드 | 위치 | 용도 |
|---|---|---|
| brew (`brew install llama.cpp`) | `/opt/homebrew/bin/llama-server` | stable, 일반 용도 |
| PR 빌드 | `~/llama.cpp/build/bin/llama-server` | 신기능 전용 |

`llama-server`만 입력하면 brew 거가 잡히고, PR 빌드는 **절대경로로 호출**합니다. PATH 손댈 필요 없음.

## 사전 준비

```sh
brew install cmake git
```

## 빌드 절차

```sh
# 1. 홈 디렉토리로 이동
cd ~

# 2. 클론 + PR 브랜치 체크아웃 (PR번호는 상황에 맞게)
git clone --depth 1 https://github.com/ggml-org/llama.cpp.git
cd llama.cpp
git fetch origin pull/<PR번호>/head:<브랜치이름> && git checkout <브랜치이름>

# 3. Metal 가속 빌드 (Apple Silicon)
cmake -B build -DGGML_METAL=ON -DCMAKE_BUILD_TYPE=Release
cmake --build build --target llama-cli llama-server -j
```

빌드 시간: **5~10분**.


빌드 출력:
![[Xnip2026-05-10_10-35-16 1.png]]

## 결과 확인

```sh
~/llama.cpp/build/bin/llama-server --version
```

`--version` 확인:
![[Xnip2026-05-10_10-39-22.png]]
버전 정보 뜨면 성공.
