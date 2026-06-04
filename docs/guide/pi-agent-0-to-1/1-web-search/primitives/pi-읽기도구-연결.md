---
tags: [tool, web-reader, pi, extension]
last_updated: 2026-06-01
---

# Pi에 읽기 도구 붙이기

> 먼저 [[jina-reader-설치]]로 Jina Reader가 떠 있어야 해요. 검색 도구를 이미 붙였다면([[pi-검색도구-연결]]) 이건 거의 똑같고 더 쉬워요.

[[pi]]에 **읽기 도구**를 하나 더 등록해요. 모델이 이 도구에 url을 넘기면, 로컬 [[jina-reader]]가 그 페이지 본문을 마크다운으로 읽어서 돌려줍니다. [[웹검색-원리]]의 **2단계(읽기)**예요.

## 폴더 등록은 이미 완료 되어있어요
[[pi-검색도구-연결]]에서 `~/dev/pi-setup/extensions/` 폴더를 settings.json에 등록해 뒀죠. Pi는 그 폴더의 `.ts`를 전부 읽으니, **새 파일만 하나 더 넣으면 settings.json은 안 건드려도 자동 로드돼요.** 그때 파일 하나가 아니라 폴더로 등록한 이유가 바로 이거예요.

기대하는 구조:
```
~/dev/pi-setup/extensions/
├── web-search.ts     검색 도구 (1단계, 앞에서 만듦)
└── web-read.ts       읽기 도구 (2단계, 이번에 만들 것)
```

여기서 시작:
![[Xnip2026-06-02_21-23-44.png]]
## 1. 읽기 도구 파일 만들기
`extensions/` 폴더에 `web-read.ts`를 만들어요.

```sh
touch ~/dev/pi-setup/extensions/web-read.ts
```

![[Xnip2026-06-02_21-24-23.png]]
편집기로 열어(`code ~/dev/pi-setup/extensions/web-read.ts` 또는 `nano ...`) 아래 코드를 붙여넣고 저장하세요.

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "web_read",
    label: "Web Read",
    description: "주어진 URL의 본문을 로컬 Jina Reader로 읽어 마크다운으로 돌려준다.",
    parameters: Type.Object({
      url: Type.String({ description: "본문을 읽을 웹페이지 주소" }),
    }),
    async execute(toolCallId, params, signal) {
      const res = await fetch("http://localhost:3000/" + params.url, { signal });
      const markdown = await res.text();

      return {
        content: [{ type: "text", text: markdown.slice(0, 20000) }],
        details: {},
      };
    },
  });
}
```

`nano` 로 수정:
![[Xnip2026-06-02_21-25-01.png]]
코드 복붙:
![[Xnip2026-06-02_21-25-18.png]]
코드 복붙 잘 되었는지 `cat` 으로 확인:
![[Xnip2026-06-02_21-25-36.png]]

## 2. 코드가 하는 일
- **`web_read`**: url 하나를 입력으로 받아요.
- **`execute`**: Jina Reader 주소(`localhost:3000/` 뒤에 url을 그대로 붙임)로 요청하면, 본문이 **마크다운**으로 와요. 그걸 모델에 돌려줍니다.
- **`.slice(0, 20000)`**: 페이지가 너무 길면 잘라요. 통째로 넘기면 모델 컨텍스트가 금방 차거든요. 부족하면 숫자만 올리면 됩니다.

검색 도구([[pi-검색도구-연결]])랑 모양이 거의 같죠. 입력이 `query`(검색어)에서 `url`(주소)로 바뀌고, 부르는 서비스가 SearXNG에서 Jina Reader로 바뀐 것뿐이에요.

## 3. Pi 다시 시작하고 써보기
settings.json은 손 안 대도 돼요 (폴더가 이미 등록됨). Pi를 껐다 켜면 `web_read`가 새로 로드돼요. 이제 **검색하고 그 결과 링크를 읽는 것**까지 시켜보세요. 예: "SearXNG 깃허브 릴리스 페이지 들어가서 내용 읽어줘".

테스트로, `Claude Code`에서 막혀서 쉽게 읽지 못하는 `Reddit` 포스트 아무거나 시켜봤어요:

![[Xnip2026-06-02_21-30-26.png]]
막힘 없이 바로 `Reddit` 포스트 읽어내는게 기가 막히네요: 
![[Xnip2026-06-02_21-31-06.png]]
요약 까지 완벽:
![[Xnip2026-06-02_21-32-00.png]]

## 마무리: 검색과 읽기 완성

이제 Pi가 **검색(`web_search`)으로 목록을 받고, 읽기(`web_read`)로 본문까지** 가져와요. [[웹검색-원리]]의 1단계와 2단계가 둘 다 돌아가는 거예요. 그것도 검색엔진(SearXNG)도, 리더(Jina Reader)도, 모델(Qwen)도 **전부 내 맥북 안에서, 100% 오픈소스로**요.

`Jina` 를 활용해서 로컬 에이전트 세팅을 해보니 `Claude Code` 에서 하기 힘들었던 플랫폼 검색까지 바로 하는걸 보고 어쩌면 로컬 환경이 더 많은 가능성을 현실화 할 수 있다는 생각이 듭니다. 


