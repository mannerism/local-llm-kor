---
tags: [tool, coding-agent, install]
last_updated: 2026-05-10
---

# Pi 설치

## 1. Node.js + pnpm 설치

Pi는 Node.js로 만들어진 도구라 Node와 패키지 매니저가 필요해요. 보통은 `npm`을 쓰지만, 이 시리즈에서는 **pnpm**을 씁니다.

> **왜 pnpm?** 같은 패키지를 디스크에 한 번만 저장하고 프로젝트마다 링크해서 쓰는 구조라, **설치가 빠르고 디스크를 덜 먹어요.** 명령어도 npm과 거의 똑같아서 옮겨가도 부담이 없습니다.

Homebrew로 한 번에 설치:
```sh
brew install node pnpm
```

> `pnpm`은 Node 위에서 도는 도구라 **Node도 같이 깔아야 작동합니다.** `pnpm`만 깔면 `env: node: No such file or directory` 에러가 납니다.

확인:
```sh
node --version
pnpm --version
```
![[Xnip2026-05-11_23-42-07.png]]
## 2. pnpm global PATH 설정

pnpm은 글로벌 패키지를 `~/Library/pnpm/bin`에 깔아요. 이 폴더가 `PATH`에 없으면 설치한 명령어를 못 부르니, 한 번만 셋업해 둡니다.

```sh
pnpm setup
source ~/.zshrc
```

`pnpm setup`이 `~/.zshrc`에 `PNPM_HOME`과 `PATH` export를 자동으로 추가해 줍니다. `source`로 현재 셸에 바로 반영해 두면 됩니다.

> 안 깔면 `pnpm add -g ...` 실행 시 `The configured global bin directory ... is not in PATH` 에러가 납니다.

## 3. Pi 설치

```sh
pnpm add -g @earendil-works/pi-coding-agent
```

설치 도중 이런 프롬프트가 뜹니다:

![[Xnip2026-05-11_23-44-49.png]]

pnpm 11부터는 보안상 **빌드 스크립트를 실행할 패키지를 직접 골라야** 합니다. **스페이스로 전부 선택한 뒤 Enter**를 누르세요. 각 패키지의 역할은 이렇습니다.

- **koffi** — C FFI 바인딩. 빌드 안 하면 Pi가 시스템 호출을 못 해서 동작이 깨집니다 (필수).
- **@google/genai** — Google GenAI SDK. provider 옵션 중 하나.
- **protobufjs** — Protobuf 런타임. 메시지 직렬화에 사용.

전부 정식 패키지라 안전합니다.

선택 후엔 한 번 더 확인 프롬프트가 뜹니다:

![[Xnip2026-05-11_23-45-53.png]]

**디폴트가 `N`**이라 그냥 Enter 누르면 빌드가 안 됩니다. `y` + Enter로 명시 승인하세요. 완료되면 `Done in N s using pnpm v11.x.x` 메시지가 나옵니다.

확인:
```sh
pi --version
```

![[Xnip2026-05-11_23-46-48.png]]
Pi 설치 완료.