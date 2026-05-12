import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Local LLM 가이드',
  description: '맥북에서 로컬 LLM 굴리기 — 한국어 입문 가이드',
  lang: 'ko-KR',

  // GitHub Pages 배포 시 base를 바꿀 수 있게. Vercel 배포면 '/' 유지.
  base: '/',

  // 한글 검색 작동을 위해 lunr 옵션을 약간 손봐도 되지만, 기본 local provider도 한글 부분일치 OK.
  themeConfig: {
    nav: [
      { text: '가이드', link: '/guide/1-prep/' },
      { text: '커뮤니티 리소스', link: '/guide/99-community-resources/' },
    ],

    sidebar: {
      '/guide/': [
        {
          text: '시리즈',
          collapsed: false,
          items: [
            { text: '1편 — 사전 준비', link: '/guide/1-prep/' },
            { text: '2편 — llama.cpp 설치', link: '/guide/2-llamacpp/' },
            { text: '3편 — llama.cpp vs MLX', link: '/guide/3-llamacpp-vs-mlx/' },
            { text: '4편 — 모델 이름 읽기', link: '/guide/4-model-name/' },
            { text: '5편 — 속도 결정 요인', link: '/guide/5-model-speed/' },
            { text: '6편 — 모델 고르기', link: '/guide/6-model-pick/' },
            { text: '7편 — 빌드·다운로드·실행', link: '/guide/7-model-run/' },
            { text: '8편 — 터미널 에이전트', link: '/guide/8-terminal-agent/' },
            { text: '9편 — Qwen 35B A3B', link: '/guide/9-qwen-35b-a3b/' },
          ],
        },
        {
          text: '자료',
          collapsed: false,
          items: [
            { text: '커뮤니티 리소스', link: '/guide/99-community-resources/' },
          ],
        },
      ],
    },

    socialLinks: [
      // 실제 GitHub repo URL 정해지면 교체. 기여 워크플로 핵심 진입점.
      { icon: 'github', link: 'https://github.com/dearmannerism/local-llm' },
    ],

    // "이 페이지를 GitHub에서 수정하기" 링크 — 외부 기여자 핵심 UX.
    editLink: {
      pattern: 'https://github.com/dearmannerism/local-llm/edit/main/docs/:path',
      text: '이 페이지를 GitHub에서 수정하기',
    },

    lastUpdated: {
      text: '마지막 업데이트',
      formatOptions: {
        dateStyle: 'medium',
        timeStyle: undefined,
      },
    },

    docFooter: {
      prev: '이전',
      next: '다음',
    },

    footer: {
      message: '코드는 MIT, 본문은 <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>',
      copyright: '© 2026 디어매너리즘',
    },

    search: {
      provider: 'local',
      options: {
        translations: {
          button: {
            buttonText: '검색',
            buttonAriaLabel: '검색',
          },
          modal: {
            displayDetails: '자세히 보기',
            resetButtonTitle: '검색어 초기화',
            backButtonTitle: '닫기',
            noResultsText: '결과 없음',
            footer: {
              selectText: '선택',
              navigateText: '이동',
              closeText: '닫기',
            },
          },
        },
      },
    },

    outline: {
      label: '이 페이지에서',
      level: [2, 3],
    },
  },
});
