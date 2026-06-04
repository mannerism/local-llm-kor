---
tags: [tool, web-search, install]
last_updated: 2026-06-01
---

# SearXNG 설치 (내 맥북에서 돌리기)

> [[searxng]]가 뭔지, 왜 골랐는지는 앞 글에서 다뤘어요. 여기선 **가장 간편하게 띄우는 법**만 봅니다.

가장 쉬운 방법은 **Docker**예요. SearXNG를 통째로 담은 상자(컨테이너)를 명령어 한 줄로 받아서 띄웁니다. 복잡한 설치 과정을 Docker가 다 대신해줘요.

## 1. Docker 설치
Docker가 처음이면 [[docker]]를 먼저 보고 오세요. 맥에선 Docker Desktop이 제일 간편해요.

```sh
brew install --cask docker-desktop
```

![[Xnip2026-06-02_16-03-15.png]]

확인:
```sh
docker --version
```

![[Xnip2026-06-02_16-13-40.png]]
설치 후 **Docker Desktop 앱을 한 번 실행**해 두세요. 백그라운드에서 Docker 엔진이 돌아야 아래 명령어가 먹습니다. (`brew`가 안 되면 https://www.docker.com 에서 직접 받아도 돼요.)

![[Xnip2026-06-02_16-14-14.png]]
Docker 앱 실행:
![[Xnip2026-06-02_16-15-32.png]]
실행 중이면 상단 Status bar에 이렇게 보임:
![[Xnip2026-06-02_16-16-13.png]]

아래 Docker 명령어를 실행하기 위해서는 반드시 docker-desktop 앱이 실행 중이어야 합니다.

## 2. 작업 폴더 만들기
이 시리즈에서 만드는 건 한 폴더에 모아둬요. 아무 데서나 명령을 돌리면 설정 파일이 여기저기 흩어져서 나중에 못 찾습니다.

`~/dev/pi-setup` 폴더를 만들고 그 안으로 들어가세요. (`~/dev`가 없어도 `mkdir -p`가 같이 만들어줘요.)

```sh
mkdir -p ~/dev/pi-setup
cd ~/dev/pi-setup
```

앞으로 SearXNG를 포함한 이 시리즈의 모든 설정이 이 폴더 안에 차곡차곡 쌓입니다. **다음 단계부터는 꼭 이 폴더 안에서** 명령을 실행하세요.

## 3. SearXNG 띄우기
위에서 만든 `~/dev/pi-setup` 폴더 안에서 아래 한 줄을 실행해요. 그래야 설정이 `~/dev/pi-setup/searxng-config/`에 깔끔하게 생깁니다.

```sh
docker run --name searxng -d \
  -p 8888:8080 \
  -v "./searxng-config/:/etc/searxng/" \
  docker.io/searxng/searxng:latest
```

- `-d`: 백그라운드로 돌려요.
- `-p 8888:8080`: 내 컴퓨터의 8888 포트로 접속하면 컨테이너 안 SearXNG(8080)로 연결돼요.
- `-v ...`: 설정 파일을 `~/dev/pi-setup/searxng-config/` 폴더에 두고 고칠 수 있게 연결해요.

![[Xnip2026-06-02_16-18-17.png]]
확인: 
```zsh
docker ps -a
```

![[Xnip2026-06-02_16-19-49.png]]
SearXNG가 정상적으로 돌고 있음을 확인.

브라우저에서 http://localhost:8888 을 열어 검색창이 보이면 일단 성공이에요.

![[Xnip2026-06-02_16-18-56.png]]
## 4. JSON 출력 켜기 (Pi 연동에 필요)
3번에서 SearXNG를 Docker로 처음 띄우면, `~/dev/pi-setup/searxng-config/` 안에 **`settings.yml`이라는 설정 파일이 자동으로 생겨요.** SearXNG의 동작을 여기서 바꿀 수 있는데, 그중 하나가 **검색 결과를 어떤 형식(format)으로 내줄지**예요.

기본값은 **html**(사람이 브라우저로 보는 화면)만 켜져 있어요. 그런데 우리는 [[pi]]랑 연결할 거잖아요. Pi 같은 프로그램은 화면(html)이 아니라 **기계가 다루기 쉬운 json**으로 받아야 결과를 처리할 수 있어요. 그래서 json 형식을 추가로 켜줍니다.

먼저 지금 설정을 확인해 보죠. 파일이 길어서 `formats` 부분만 꺼내 보면, 이렇게 **html만** 있습니다.

```sh
grep -A1 "^  formats:" ~/dev/pi-setup/searxng-config/settings.yml
```
![[Xnip2026-06-02_17-06-42.png]]
이 파일을 직접 열어 `- json` 한 줄을 더해도 돼요. 근데 귀찮으니 **명령어 한 줄로** 넣어줄게요. (`formats:` 줄을 찾아 다음 줄의 `- html`을 끌어와 `[html, json]` 한 줄로 합칩니다. 여러 번 돌려도 안전해요.)

```sh
sed -i '' '/^  formats:$/{N;s/\n    - html/ [html, json]/;}' ~/dev/pi-setup/searxng-config/settings.yml
```

다시 확인해 보면 **json이 추가**돼 있어요. (한 줄로 합쳐졌지만 `html`, `json` 둘 다 켜진 거예요.)

```sh
grep "^  formats:" ~/dev/pi-setup/searxng-config/settings.yml
```
![[Xnip2026-06-02_17-07-07.png]]
마지막으로, 바뀐 설정을 적용하려면 컨테이너를 재시작해요. (설정 파일은 컨테이너가 시작할 때 읽히거든요.)

```sh
docker restart searxng
```

> 손으로 고치고 싶으면: `~/dev/pi-setup/searxng-config/settings.yml`의 `formats:` 부분을 `formats: [html, json]`으로 바꾸고 `docker restart searxng` 하면 똑같아요.

## 잘 됐는지 확인
JSON이 나오는지 봐요.

```sh
curl "http://localhost:8888/search?q=test&format=json"
```

긴 JSON 덩어리가 쏟아지면 성공입니다. 이제 [[pi]]에 붙일 준비가 끝났어요.
![[Xnip2026-06-02_17-08-09.png]]