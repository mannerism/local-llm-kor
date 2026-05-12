/**
 * markdown-obsidian.mjs — markdown-it 플러그인
 *
 * Obsidian 의 위키링크 문법을 VitePress 가 이해하는 마크다운으로 변환.
 * 변환은 모두 *렌더 타임* 에 일어남. 소스 .md 파일은 vault 의 원본과 100% 동일.
 *
 * 처리 패턴:
 *   ![[image.png]]         → ![](./assets/image.png)
 *   ![[primitive-name]]    → primitive 본문 인라인 (헤더 한 단계 강등)
 *   [[primitive-name]]     → [primitive-name](#primitive-name)
 *   [[primitive-name|L]]   → [L](#primitive-name)
 *   [[N-folder/index|L]]   → [L](/guide/N-folder/)
 *
 * 인라인된 primitive 의 H2 (예: ## 이게 뭐예요?) 는 H3 로 강등됨.
 * primitive embed 직전의 H2 헤더에 자동으로 {#primitive-<name>} 앵커 ID 주입 안 함 —
 * VitePress 의 markdown-it-anchor 가 자동으로 slug 만들어줌. [[X]] 링크는 슬러그 매칭.
 *
 * 사용 (VitePress config.ts 안에서):
 *   import { obsidianPlugin } from './markdown-obsidian.mjs';
 *   ...
 *   markdown: { config: (md) => md.use(obsidianPlugin, { contentRoot: '...' }) }
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']);
const nfc = (s) => s.normalize('NFC');
const isImage = (name) => IMAGE_EXTS.has(path.extname(name).toLowerCase());

/**
 * contentRoot 아래의 모든 챕터를 훑어서 primitive 이름 → 챕터 맵 구축.
 * 크로스 챕터 위키링크 [[community-resources]] 같은 게 어느 챕터로 가야 할지 결정.
 */
function buildPrimitiveIndex(contentRoot) {
  const index = new Map();
  if (!existsSync(contentRoot)) return index;
  for (const entry of readdirSync(contentRoot)) {
    const chapterDir = path.join(contentRoot, entry);
    if (!statSync(chapterDir).isDirectory()) continue;
    const primitivesDir = path.join(chapterDir, 'primitives');
    if (!existsSync(primitivesDir)) continue;
    for (const file of readdirSync(primitivesDir)) {
      if (file.endsWith('.md')) {
        const name = nfc(file.replace(/\.md$/, ''));
        if (!index.has(name)) index.set(name, entry);
      }
    }
  }
  return index;
}

/**
 * 현재 페이지가 어느 챕터에 속하는지 추정.
 * VitePress 가 처리하는 파일 경로는 `docs/guide/<chapter>/index.md` 같은 형태.
 */
function chapterFromEnv(env, contentRoot) {
  if (!env || !env.path) return null;
  const rel = path.relative(contentRoot, env.path);
  const parts = rel.split(path.sep);
  return parts[0] || null;
}

function stripFrontmatter(md) {
  if (!md.startsWith('---\n')) return md;
  const end = md.indexOf('\n---\n', 4);
  if (end === -1) return md;
  return md.slice(end + 5);
}

function stripLeadingH1(md) {
  const lines = md.split('\n');
  let i = 0;
  while (i < lines.length && lines[i].trim() === '') i++;
  if (i < lines.length && /^#\s+/.test(lines[i])) {
    lines.splice(i, 1);
    if (i < lines.length && lines[i].trim() === '') lines.splice(i, 1);
  }
  return lines.join('\n');
}

function demoteHeaders(md, by = 1) {
  const out = [];
  let inFence = false;
  for (const line of md.split('\n')) {
    if (/^```/.test(line)) inFence = !inFence;
    if (!inFence && /^#{1,5}\s/.test(line)) {
      out.push('#'.repeat(by) + line);
    } else {
      out.push(line);
    }
  }
  return out.join('\n');
}

/**
 * 한 페이지의 마크다운 소스에 Obsidian 문법 변환을 적용.
 * primitive 임베드는 재귀적으로 inline (primitive 안에 또 ![[]] 있으면 그것도 처리).
 */
function transform(md, { chapter, contentRoot, primitiveIndex, depth = 0 }) {
  if (depth > 3) return md; // 무한 재귀 방지

  // 1. ![[file]] 임베드 처리
  md = md.replace(/!\[\[([^\]]+)\]\]/g, (full, target) => {
    const name = nfc(target.trim());

    // 이미지
    if (isImage(name)) {
      return `![](./assets/${name})`;
    }

    // primitive 인라인 — 같은 챕터 안에서만 (Obsidian 도 보통 그렇게 씀)
    if (!chapter) return full;
    const primitivePath = path.join(contentRoot, chapter, 'primitives', `${name}.md`);
    try {
      let body = readFileSync(primitivePath, 'utf8');
      body = stripFrontmatter(body);
      body = stripLeadingH1(body);
      body = transform(body, { chapter, contentRoot, primitiveIndex, depth: depth + 1 });
      body = demoteHeaders(body, 1);
      // anchor span 주입 — 다른 페이지에서 [[primitive-name]] 으로 링크 걸 수 있게
      return `<span id="${name}"></span>\n\n${body.trim()}`;
    } catch {
      return `\n> _⚠️ primitive 못 찾음: \`${name}\` — \`${chapter}/primitives/${name}.md\`_\n`;
    }
  });

  // 2. [[link]] 위키링크 처리
  md = md.replace(/(?<!!)\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_full, target, label) => {
    const display = (label || target).trim();
    const tgt = nfc(target.trim());

    // 2a. 크로스 챕터 인덱스 [[N-folder/index]] 또는 [[N-folder/index#anchor]]
    const cross = tgt.match(/^([^/]+)\/index(?:#(.+))?$/);
    if (cross) {
      const [, folder, anchor] = cross;
      const hash = anchor ? `#${anchor}` : '';
      return `[${display}](/guide/${folder}/${hash})`;
    }

    // 2b. primitive 글로벌 매핑 — 같은 챕터면 anchor, 다른 챕터면 풀 경로
    const primitiveChapter = primitiveIndex.get(tgt);
    if (primitiveChapter) {
      if (primitiveChapter === chapter) {
        return `[${display}](#${tgt})`;
      }
      return `[${display}](/guide/${primitiveChapter}/#${tgt})`;
    }

    // 2c. 못 찾음 — anchor 로만 변환 (페이지 내 헤더와 일치하면 작동, 아니면 깨진 링크)
    return `[${display}](#${tgt})`;
  });

  return md;
}

export function obsidianPlugin(md, options = {}) {
  const contentRoot = options.contentRoot || path.resolve('docs/guide');
  const primitiveIndex = buildPrimitiveIndex(contentRoot);

  md.core.ruler.before('normalize', 'obsidian-transform', (state) => {
    const chapter = chapterFromEnv(state.env, contentRoot);
    state.src = transform(state.src, { chapter, contentRoot, primitiveIndex });
  });
}

