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
 * 위키링크 target 은 외부 기여자 PR 에서 흘러들어올 수 있는 신뢰 X 입력.
 * `..` 나 path separator 를 허용하면 빌드 시 `path.join(...)` 결과가 contentRoot
 * 바깥으로 빠져나가 임의 파일을 readFileSync 로 읽힌다 (예: /etc/passwd,
 * /proc/self/environ 으로 Vercel 빌드 env 노출).
 * 정상 primitive/이미지 이름엔 `..` 와 `/` 가 들어갈 일이 없으므로 단순 거부.
 */
const isSafeEmbedName = (name) =>
  !name.includes('..') && !name.includes('/') && !name.includes('\\');

/**
 * contentRoot 아래의 모든 챕터를 훑어서 primitive 이름 → 챕터 맵 구축.
 * 크로스 챕터 위키링크 [[community-resources]] 같은 게 어느 챕터로 가야 할지 결정.
 *
 * 다중 시리즈 구조: contentRoot/<series>/<chapter>/primitives/*.md.
 * 맵 값은 `series/chapter` 상대경로 (URL `/guide/series/chapter/` + path.join 둘 다에 사용).
 */
export function buildPrimitiveIndex(contentRoot) {
  // name → ['series/chapter', ...]. 등록 순서 = 시리즈·챕터 사전순 (결정적).
  const index = new Map();
  if (!existsSync(contentRoot)) return index;
  for (const series of readdirSync(contentRoot).sort()) {
    const seriesDir = path.join(contentRoot, series);
    if (!statSync(seriesDir).isDirectory()) continue;
    for (const chapter of readdirSync(seriesDir).sort()) {
      const chapterDir = path.join(seriesDir, chapter);
      if (!statSync(chapterDir).isDirectory()) continue;
      const primitivesDir = path.join(chapterDir, 'primitives');
      if (!existsSync(primitivesDir)) continue;
      for (const file of readdirSync(primitivesDir).sort()) {
        if (file.endsWith('.md')) {
          const name = nfc(file.replace(/\.md$/, ''));
          const rel = `${nfc(series)}/${nfc(chapter)}`;
          const list = index.get(name) ?? [];
          if (!list.includes(rel)) list.push(rel);
          index.set(name, list);
        }
      }
    }
  }
  // 같은 이름 primitive 가 여러 시리즈에 걸쳐 있으면 경고 — 해석은 '같은 시리즈 우선'.
  for (const [name, rels] of index) {
    const seriesSet = new Set(rels.map((r) => r.split('/')[0]));
    if (seriesSet.size > 1) {
      console.warn(`  ⚠️  primitive 이름 충돌(여러 시리즈): \`${name}\` → ${rels.join(', ')} — 같은 시리즈 우선 해석`);
    }
  }
  return index;
}

/**
 * 현재 페이지가 어느 (시리즈/챕터) 에 속하는지 추정.
 * VitePress 가 처리하는 파일 경로는 `docs/guide/<series>/<chapter>/index.md` 형태.
 * 반환: `series/chapter` 상대경로 (앞 두 세그먼트), 못 구하면 null.
 */
export function chapterRelFromEnv(env, contentRoot) {
  if (!env || !env.path) return null;
  const rel = path.relative(contentRoot, env.path);
  const parts = rel.split(path.sep);
  if (parts.length < 2) return null;
  return `${parts[0]}/${parts[1]}`;
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
export function transform(md, { chapterRel, contentRoot, primitiveIndex, depth = 0 }) {
  if (depth > 3) return md; // 무한 재귀 방지

  // 현재 페이지의 시리즈 (chapterRel = `series/chapter`). 크로스 챕터 링크 prefix 용.
  const series = chapterRel ? chapterRel.split('/')[0] : null;

  // 1. ![[file]] 임베드 처리
  md = md.replace(/!\[\[([^\]]+)\]\]/g, (full, target) => {
    const name = nfc(target.trim());

    // 신뢰 X 입력에 대한 첫 번째 게이트 — traversal 차단.
    if (!isSafeEmbedName(name)) {
      console.warn(`  ⚠️  unsafe embed name 거부: \`${name}\``);
      return `\n> _⚠️ 위험한 임베드 이름: \`${name.replace(/[<>&]/g, '?')}\` — \`..\` 또는 \`/\` 는 허용되지 않습니다._\n`;
    }

    // 이미지
    if (isImage(name)) {
      return `![](./assets/${name})`;
    }

    // primitive 인라인 — 같은 챕터 안에서만 (Obsidian 도 보통 그렇게 씀)
    if (!chapterRel) return full;
    const primitivePath = path.join(contentRoot, chapterRel, 'primitives', `${name}.md`);
    try {
      let body = readFileSync(primitivePath, 'utf8');
      body = stripFrontmatter(body);
      body = stripLeadingH1(body);
      body = transform(body, { chapterRel, contentRoot, primitiveIndex, depth: depth + 1 });
      body = demoteHeaders(body, 1);
      // anchor span 주입 — 다른 페이지에서 [[primitive-name]] 으로 링크 걸 수 있게
      return `<span id="${name}"></span>\n\n${body.trim()}`;
    } catch {
      return `\n> _⚠️ primitive 못 찾음: \`${name}\` — \`${chapterRel}/primitives/${name}.md\`_\n`;
    }
  });

  // 2. [[link]] 위키링크 처리
  md = md.replace(/(?<!!)\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_full, target, label) => {
    const display = (label || target).trim();
    const tgt = nfc(target.trim());

    // 2a. 크로스 챕터 인덱스 [[N-folder/index]] 또는 [[N-folder/index#anchor]]
    // 같은 시리즈 안의 다른 챕터를 가리킴 → 현재 시리즈를 prefix 로 붙인다.
    const cross = tgt.match(/^([^/]+)\/index(?:#(.+))?$/);
    if (cross) {
      const [, folder, anchor] = cross;
      const hash = anchor ? `#${anchor}` : '';
      const base = series ? `/guide/${series}/${folder}/` : `/guide/${folder}/`;
      return `[${display}](${base}${hash})`;
    }

    // 2b. primitive 매핑 — 같은 챕터면 anchor, 아니면 풀 경로 (series/chapter).
    // 같은 이름이 여러 시리즈에 있으면 현재 시리즈를 우선, 없으면 사전순 첫 후보.
    const candidates = primitiveIndex.get(tgt);
    if (candidates && candidates.length > 0) {
      const sameSeries = series ? candidates.find((rel) => rel.startsWith(`${series}/`)) : undefined;
      const chosen = sameSeries ?? candidates[0];
      if (chosen === chapterRel) {
        return `[${display}](#${tgt})`;
      }
      return `[${display}](/guide/${chosen}/#${tgt})`;
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
    const chapterRel = chapterRelFromEnv(state.env, contentRoot);
    state.src = transform(state.src, { chapterRel, contentRoot, primitiveIndex });
  });
}

