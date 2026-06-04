---
tags: [tool, web-search, pi, extension]
last_updated: 2026-06-01
---

# Pi에 검색 도구 붙이기

> 먼저 [[searxng-설치]]로 SearXNG가 JSON까지 켜져 있어야 해요. 전체 그림은 [[pi-searxng-구조]]에 있습니다.

[[pi]]에 **검색 도구**를 하나 등록해요. 모델이 이 도구를 부르면, 로컬 [[searxng]]에 검색어를 보내고 결과 목록을 받아서 돌려줍니다. [[웹검색-원리]]의 **1단계(목록 받아오기)**를 실제 코드로 옮기는 거예요.

## 우리는 이렇게 관리해요
검색 도구도 SearXNG 설정처럼 **`~/dev/pi-setup` 안에** 둬요. 우리가 만든 건 한 폴더에 모으고, Pi한테는 "이 경로에 도구가 있다"고 알려주기만 합니다. Pi 자기 폴더(`~/.pi`)엔 우리 파일을 넣지 않아요. 거긴 Pi 것만 두고요.

기대하는 폴더 구조:
```
~/dev/pi-setup/
├── searxng-config/       SearXNG 설정 (앞에서 만듦)
└── extensions/
    └── web-search.ts     검색 도구 (이번에 만들 것)
```

이러면 우리가 만든 게 전부 pi-setup 한곳에 모이고, Pi는 그 도구를 **전역으로** 써요. 어느 폴더에서 Pi를 켜도 검색이 됩니다.

## 1. 검색 도구 파일 만들기

현재 폴더 위치: 
![[Xnip2026-06-02_20-06-20 1.png]]
### 1-1. extensions 폴더 만들기
pi-setup 안에 `extensions` 폴더를 만들고 그 안으로 들어가요.

```sh
mkdir -p ~/dev/pi-setup/extensions
cd ~/dev/pi-setup/extensions
```
![[Xnip2026-06-02_20-07-27.png]]
![[Xnip2026-06-02_20-07-55.png]]
### 1-2. 새 파일 만들기
`web-search.ts`를 새로 만들어요.

```sh
touch ~/dev/pi-setup/extensions/web-search.ts
```
![[Xnip2026-06-02_20-09-22.png]]
### 1-3. 편집기로 열어 코드 붙여넣기
방금 만든 파일을 편집기로 열어요. (VS Code면 `code ~/dev/pi-setup/extensions/web-search.ts`, 터미널이 편하면 `nano ~/dev/pi-setup/extensions/web-search.ts`. 아무거나 괜찮아요.)

아래 코드를 통째로 붙여넣고 저장하세요.

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "web_search",
    label: "Web Search",
    description: "로컬 SearXNG로 웹을 검색해 결과 목록(제목, 주소, 요약)을 돌려준다.",
    parameters: Type.Object({
      query: Type.String({ description: "검색할 키워드" }),
    }),
    async execute(toolCallId, params, signal) {
      const url =
        "http://localhost:8888/search?q=" +
        encodeURIComponent(params.query) +
        "&format=json";

      const res = await fetch(url, { signal });
      const data = await res.json();

      const results = (data.results ?? [])
        .slice(0, 5)
        .map((r: any) => ({ title: r.title, url: r.url, snippet: r.content }));

      return {
        content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
        details: {},
      };
    },
  });
}
```

![[Xnip2026-06-02_20-10-45.png]]
![[Xnip2026-06-02_20-11-32 1.png]]
이후 `ctrl` + `x` 를 눌러서 저장.

### 1-4. 잘 들어갔는지 확인
저장한 코드가 그대로 들어갔는지 봐요.

```sh
cat ~/dev/pi-setup/extensions/web-search.ts
```
붙여넣은 코드가 보이면 끝이에요.
![[Xnip2026-06-02_20-12-52.png]]
## 2. 코드가 하는 일
- **`registerTool`**: 모델이 부를 수 있는 도구를 Pi에 등록해요.
- **`parameters`**: 모델이 넘기는 입력. 여기선 검색어 `query` 하나뿐이에요.
- **`execute`**: 실제 동작이에요. SearXNG의 JSON 주소로 검색어를 보내고, 결과 **상위 5개**만 제목·주소·요약으로 추려서 돌려줘요. (목록까지만. 링크 본문 읽기는 다음 단계.)

상위 5개로 자른 건, 결과를 통째로 넘기면 모델 컨텍스트가 금방 차기 때문이에요. 부족하면 나중에 숫자만 올리면 됩니다.

## 3. Pi에 도구 경로 알려주기 (settings.json)
도구 파일이 `~/.pi`가 아니라 pi-setup에 있으니, Pi한테 그 위치를 알려줘야 로드돼요. `~/.pi/agent/settings.json`을 열어 `extensions` 배열에 **extensions 폴더의 절대경로**를 더합니다.

```json
{
  "extensions": ["/Users/본인계정/dev/pi-setup/extensions"]
}
```

파일 하나가 아니라 **폴더**를 가리키는 게 핵심이에요. Pi는 그 폴더 안의 `.ts` 파일을 전부 알아서 불러와요. 그래서 나중에 도구를 더 만들어 이 폴더에 넣어도 settings.json은 안 건드려도 자동으로 로드됩니다.

이미 다른 설정이 들어 있으면 그 객체 안에 `extensions` 키만 추가하면 돼요. `본인계정` 자리는 본인 홈 경로로 바꾸세요. (`echo $HOME`으로 확인.)

> 주의: 이 폴더에 `index.ts`를 두면 Pi가 폴더를 "단일 확장"으로 보고 `index.ts`만 읽어요. 우리처럼 도구 파일을 나란히 둘 거면 `index.ts`는 만들지 마세요.

![[Xnip2026-06-02_20-14-07.png]]
![[Xnip2026-06-02_20-15-10.png]]
![[Xnip2026-06-02_20-22-10.png]]
다시 한번 제대로 확인: 
![[Xnip2026-06-02_20-22-47.png]]
## 4. Pi 다시 시작하고 써보기
Pi를 껐다 켜면 `web_search` 도구가 로드돼요. 검색이 필요한 걸 물어보면(예: "SearXNG 최신 버전이 뭔지 검색해줘") 모델이 이 도구를 호출해 목록을 가져옵니다.

![[Xnip2026-06-02_20-24-13.png]]
새로 추가한 `web-search.ts` 가 잘 추가된걸 확인할 수 있다.

자 이제 테스트를 해 봐요.

![[Xnip2026-06-02_20-25-19.png]]![[Xnip2026-06-02_20-26-33.png]]
방금 만든 `web_search` 도구를 `Pi` 가 잘 불러와서 사용하는걸 확인할 수 있어요.

결과물도 매우 잘 나온다:
![[Xnip2026-06-02_20-26-54.png]]

## 마지막 다음 단계
이로써 **100% 오픈소스에 검열 저항성까지 갖춘 검색 도구**를 Pi에 장착했어요. 자체 호스팅이라 한 회사에 매이지 않고, 여러 엔진을 합쳐 한 곳이 막혀도 돌아가며, 검색어 한 줄도 내 맥북 밖으로 안 나갑니다. 이게 검열에 휘둘리지 않는다는 뜻이에요. 

여기서 끝이 아니에요. 지금은 검색 결과 5개 정도를 `json`으로 받는 데까지입니다. 각 결과의 제목·주소·요약(snippet)만 손에 쥔 거죠. 정작 그 **`url`에 들어가서 본문을 자세히 읽으려면**, 앞서 말한 [[웹검색-원리]]의 **2단계(읽기) 도구**가 따로 필요해요. 바로 시작해 봅시다.