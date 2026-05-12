# 기여 가이드 (CONTRIBUTING)

이 가이드에 기여해주셔서 감사해요. 오타 수정, 설명 보완, 새 편 추가, 번역, 무엇이든 환영합니다.

## 1. 무엇이든 시작하기 전에 — 글의 톤과 구조

이 시리즈는 **"한국 중학생도 따라올 수 있는 수준"** 을 목표로 합니다. PR을 보내시기 전에 [STYLE-GUIDE.md](./STYLE-GUIDE.md) 를 한 번만 읽어주세요. 핵심만 적으면:

- **존댓말**: 해요체 + 합쇼체 섞기. 반말 ✗
- **비유로 풀기**: 터미널 = "검은 화면에 글씨 쳐서 명령 내리는 창" 처럼
- **결정마다 "왜"**: 도구나 옵션을 고를 때마다 _왜 이걸 골랐는지_ 한 문단 추가
- **`primitives/` = 도구 정본**, **`index.md` = 흐름**: 도구가 바뀌면 primitive만 고침

## 2. 어떻게 기여하나요?

### 오타·작은 수정

페이지 하단 **"이 페이지를 GitHub에서 수정하기"** 버튼 → GitHub 웹 에디터에서 바로 수정 → PR.

### 큰 수정·새 편 추가

```sh
git clone https://github.com/dearmannerism/local-llm.git
cd local-llm
pnpm install
pnpm dev
```

브라우저에서 미리보기 확인 후 PR.

### 어디를 수정하나요?

`docs/guide/N-슬러그/index.md` 를 수정해주세요. 페이지 안의 `<!-- SYNC:BEGIN ... -->` ··· `<!-- SYNC:END ... -->` 마커 사이의 본문이 진짜 콘텐츠입니다. 마커 자체는 건드리지 마세요.

- **오타·문장 수정**: 마커 사이 텍스트만 수정 → PR
- **이미지 추가**: `docs/guide/N-슬러그/assets/` 에 파일 추가 + 마크다운에서 `![](./assets/파일.png)` 로 참조
- **새 섹션·새 도구 추가**: issue 로 먼저 논의해주세요 (구조 변경은 메인테이너가 vault 에서 처리)

> 💡 SYNC 마커는 HTML 코멘트라 렌더링된 사이트에선 안 보입니다. 마커 사이 본문을 머지하면 메인테이너가 `pnpm reverse-sync` 로 본인의 Obsidian vault 에 반영합니다.

## 3. 라이선스 및 기여자 동의 (중요)

이 저장소는 다음 라이선스로 배포됩니다:

- **코드** (`scripts/`, `.vitepress/`, 빌드 도구 등): MIT License
- **본문** (`docs/` 하위 마크다운·이미지): CC BY-SA 4.0

### 기여자 라이선스 동의 (CLA)

> **본 저장소에 Pull Request를 제출함으로써, 기여자(이하 "Contributor")는 본인의 기여물(코드·문서·이미지·기타 자료)에 대해 디어매너리즘(이하 "Maintainer")에게 영구적·전 세계적·취소 불가능하며 로열티가 없는 비독점적 라이선스를 부여하며, 여기에는 해당 기여물을 사용·수정·재배포·서브라이선스하고 향후 모든 형태의 라이선스(상업용 라이선스 포함)로 재라이선스(re-license)할 권리가 포함됩니다.**
>
> **Contributor는 본인이 해당 기여물의 저작권자이거나 적법하게 권리를 보유하고 있으며, 본 동의를 부여할 권한이 있음을 보증합니다.**
>
> By submitting a Pull Request to this repository, the Contributor grants 디어매너리즘 (the "Maintainer") a perpetual, worldwide, irrevocable, royalty-free, non-exclusive license to use, modify, distribute, sublicense, and **re-license** the Contributor's contribution under any terms, including future commercial licenses.
>
> The Contributor warrants that they are the copyright holder of the contribution or have the legal right to grant this license.

(이 조항은 향후 프로젝트가 다른 라이선스로 전환되거나 인수·합병 등 사업적 정리가 필요할 때, 모든 기여자에게 개별 동의를 받지 않고도 진행할 수 있도록 하기 위함입니다. Linux 커널·Postgres 처럼 CLA가 없는 프로젝트는 이런 전환이 사실상 불가능합니다.)

기여자의 저작권은 그대로 유지되며, Contributor 본인의 다른 프로젝트에서 본인의 기여물을 사용하는 데에는 아무 제약이 없습니다.

## 4. PR 체크리스트

새 편이나 큰 변경을 제출하실 때:

- [ ] 톤이 존댓말 해요체+합쇼체 섞임인가?
- [ ] 전문 용어에 비유 설명이 붙어 있나?
- [ ] 결정 지점마다 "왜"가 적혀 있나?
- [ ] 스크린샷에 한 줄 설명이 _위에_ 붙어 있나? (아래가 아니라 위)
- [ ] `pnpm dev` 로 로컬에서 빌드 에러 없이 렌더되는가?
- [ ] CLA에 동의함을 확인했나? (PR 제출 = 동의)

## 5. 행동 강령

- 다른 기여자/독자를 존중해주세요.
- 정치적·차별적 콘텐츠는 머지하지 않습니다.
- 광고·홍보 목적의 PR은 받지 않습니다.

## 6. 라이선스 예외 / 상업적 이용 문의

CC BY-SA 4.0 외 별도 라이선스(예: 사내 비공개 교육, 출판 등)가 필요하시면:
**dearmannerism@gmail.com**
