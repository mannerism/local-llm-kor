#!/usr/bin/env node
/**
 * sync-from-obsidian.mjs
 *
 * Obsidian vault(iCloud) → repo docs/guide/ 트랜스폼.
 * vault 가 단일 소스이고, docs/guide/ 는 동기화 결과물(but committed for PR editing).
 *
 * 입력 (iCloud Obsidian vault):
 *   ~/Library/Mobile Documents/iCloud~md~obsidian/Documents/mannerism_notes/Personal/LocalLLM/
 *     1-사전-준비/
 *       index.md
 *       assets/*.jpg              ← 중첩 assets/assets/ 도 자동 평탄화
 *       primitives/*.md
 *     ...
 *
 * 출력 (VitePress docs — git tracked, PR 기여자가 GitHub에서 직접 수정):
 *   docs/guide/
 *     1-prep/
 *       index.md                  ← primitive 인라인 + HTML source 마커 박힘
 *       assets/*.jpg
 *     ...
 *
 * primitive 인라인 시 HTML 마커로 출처 표시 → scripts/reverse-sync.mjs 가 이걸 보고
 * PR 머지된 변경을 vault primitive 파일로 역동기화함.
 *
 * 변환 규칙:
 *   - 한글 폴더명 → 영문 슬러그 (SLUG_MAP)
 *   - ![[primitive-name]] → 본문 인라인. 직전 H2에 {#primitive-<name>} 앵커 주입
 *   - ![[image.jpg]]      → ![](./assets/image.jpg)  (누락 파일은 placeholder)
 *   - [[N-XXX/index|L]]   → [L](/guide/<slug>/)
 *   - [[primitive|L]]     → [L](#primitive-<name>) 또는 [L](/guide/<other>/#primitive-<name>)
 *
 * assets 자동 평탄화: assets/assets/foo.png → assets/foo.png
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const SOURCE_ROOT = path.join(
  process.env.HOME,
  'Library/Mobile Documents/iCloud~md~obsidian/Documents/mannerism_notes/Personal/LocalLLM',
);
const DEST_ROOT = path.join(REPO_ROOT, 'docs/guide');

const SLUG_MAP = {
  '1-사전-준비': '1-prep',
  '2-llama-cpp-설치': '2-llamacpp',
  '3-llama-cpp-vs-mlx': '3-llamacpp-vs-mlx',
  '4-model-name': '4-model-name',
  '5-model-speed': '5-model-speed',
  '6-model-pick': '6-model-pick',
  '7-model-run': '7-model-run',
  '8-terminal-agent': '8-terminal-agent',
  '9-qwen-35b-a3b': '9-qwen-35b-a3b',
  '99-community-resources': '99-community-resources',
};

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']);

const isImage = (name) => IMAGE_EXTS.has(path.extname(name).toLowerCase());
const anchorIdFor = (primitiveName) => `primitive-${primitiveName}`;

/**
 * macOS HFS+/APFS는 파일명을 NFD(분해형) 유니코드로 저장하지만 markdown 본문은
 * 보통 NFC(조합형)입니다. 같은 한글이라도 바이트가 달라져서 Map 조회·문자열 비교가
 * 깨지므로, 외부에서 들어오는 모든 식별자(파일명·위키링크 target)는 NFC 로 통일합니다.
 */
const nfc = (s) => s.normalize('NFC');

/* ─── 유틸 ────────────────────────────────────────────────────── */

const exists = async (p) => fs.access(p).then(() => true).catch(() => false);

async function rmrf(p) {
  if (await exists(p)) await fs.rm(p, { recursive: true, force: true });
}

/**
 * assets/ 디렉토리를 평탄하게 복사.
 *  - 중첩 디렉토리(예: assets/assets/foo.png)도 다 끌어올림
 *  - 동일 파일명 충돌 시 첫 번째가 이김 (드물 거라 가정)
 *  - 복사된 파일명 목록을 Set으로 반환
 */
async function copyAssetsFlat(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const seen = new Set();
  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const s = path.join(dir, entry.name);
      const normalizedName = nfc(entry.name);
      if (entry.isDirectory()) {
        await walk(s);
      } else if (!seen.has(normalizedName)) {
        seen.add(normalizedName);
        await fs.copyFile(s, path.join(dest, normalizedName));
      }
    }
  }
  await walk(src);
  return seen;
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

/** primitive 의 첫 H1 텍스트를 읽어 readable display name 반환 */
async function readPrimitiveTitle(primitiveFile, fallback) {
  try {
    const body = await fs.readFile(primitiveFile, 'utf8');
    const m = stripFrontmatter(body).match(/^#\s+(.+)$/m);
    if (m) return m[1].trim();
  } catch {}
  return fallback;
}

function demoteHeaders(md, by = 1) {
  const out = [];
  let inFence = false;
  for (const line of md.split('\n')) {
    if (/^```/.test(line)) inFence = !inFence;
    if (!inFence && /^#{1,5} /.test(line)) {
      out.push('#'.repeat(by) + line);
    } else {
      out.push(line);
    }
  }
  return out.join('\n');
}

/* ─── 변환 단계들 ─────────────────────────────────────────────── */

/**
 * 1) ![[primitive-name]] 직전 H2 에 {#primitive-<name>} 앵커 주입.
 *    같은 H2 에 여러 primitive 가 매달려도 첫 primitive 의 앵커만 박힘.
 */
function injectAnchorsForPrimitiveEmbeds(md) {
  const lines = md.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const embed = lines[i].match(/!\[\[([^\]\/]+)\]\]/);
    if (!embed) continue;
    const name = nfc(embed[1].trim());
    if (isImage(name)) continue;

    // 직전 H2 찾기
    for (let j = i - 1; j >= 0; j--) {
      if (/^##\s+/.test(lines[j])) {
        if (!/\{#[^}]+\}/.test(lines[j])) {
          lines[j] = lines[j].trimEnd() + ` {#${anchorIdFor(name)}}`;
        }
        break;
      }
      if (/^#\s+/.test(lines[j])) break; // H1 만나면 멈춤
    }
  }
  return lines.join('\n');
}

/**
 * 2) ![[primitive-name]] → primitive 본문 인라인 + SYNC 마커.
 *
 * 마커 형식 (reverse-sync 가 이걸 보고 vault 로 역동기화):
 *   <!-- SYNC:BEGIN src="<srcFolder>/primitives/<name>.md" demote="1" -->
 *   ...본문(헤더 강등됨)...
 *   <!-- SYNC:END   src="<srcFolder>/primitives/<name>.md" -->
 *
 * 마커는 HTML 코멘트라 렌더링된 페이지에선 안 보임. raw markdown 에만 존재.
 */
async function inlinePrimitives(md, primitivesDir, srcFolder) {
  const pattern = /!\[\[([^\]\/]+)\]\]/g;
  const replacements = [];
  let match;
  while ((match = pattern.exec(md)) !== null) {
    const target = nfc(match[1].trim());
    if (isImage(target)) continue;
    const file = path.join(primitivesDir, `${target}.md`);
    if (await exists(file)) {
      let body = await fs.readFile(file, 'utf8');
      body = stripFrontmatter(body);
      body = stripLeadingH1(body);
      body = demoteHeaders(body, 1);
      body = body.trim();

      const srcPath = `${srcFolder}/primitives/${target}.md`;
      const wrapped =
        `<!-- SYNC:BEGIN src="${srcPath}" demote="1" -->\n` +
        body +
        `\n<!-- SYNC:END src="${srcPath}" -->`;

      replacements.push({ start: match.index, end: match.index + match[0].length, body: wrapped });
    } else {
      console.warn(`  ⚠️  primitive 못 찾음: ${target} (in ${primitivesDir})`);
    }
  }
  for (const r of replacements.reverse()) {
    md = md.slice(0, r.start) + r.body + md.slice(r.end);
  }
  return md;
}

/**
 * 3) ![[image.jpg]] / ![[image]] → ![](./assets/...)
 *    누락 파일은 placeholder 박스로 대체 (빌드 안 깨짐).
 */
function rewriteImageEmbeds(md, presentFiles, presentBasenames, currentSlug) {
  return md.replace(/!\[\[([^\]]+)\]\]/g, (full, target) => {
    const base = nfc(target.trim());
    const ext = path.extname(base).toLowerCase();

    if (ext && IMAGE_EXTS.has(ext)) {
      if (presentFiles.has(base)) return `![](./assets/${base})`;
      console.warn(`  ⚠️  이미지 누락 in ${currentSlug}: ${base}`);
      return `\n> _⚠️ 이미지 누락: \`${base}\` — 옵시디언 vault 에서 동기화 필요_\n`;
    }
    if (!ext && presentBasenames.has(base)) {
      return `![](./assets/${presentBasenames.get(base)})`;
    }
    return full;
  });
}

/**
 * 4) 위키링크 변환:
 *    - [[N-XXX/index|L]]            → [L](/guide/<slug>/)
 *    - [[N-XXX/index#anchor|L]]     → [L](/guide/<slug>/#anchor)
 *    - [[primitive|L]] (현재 챕터)  → [L](#primitive-<name>)
 *    - [[primitive|L]] (다른 챕터)  → [L](/guide/<other>/#primitive-<name>)
 *    - 못 찾으면 plain text + 경고
 */
function rewriteWikilinks(md, slugMap, primitiveMap, currentSlug) {
  return md.replace(/(?<!!)\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_full, target, label) => {
    const display = (label || target).trim();
    const tgt = nfc(target.trim());

    // 1. 크로스 챕터 인덱스
    const crossMatch = tgt.match(/^([^\/]+)\/index(?:#(.+))?$/);
    if (crossMatch) {
      const [, srcFolder, anchor] = crossMatch;
      const slug = slugMap[srcFolder];
      if (slug) {
        const hash = anchor ? `#${anchor}` : '';
        return `[${display}](/guide/${slug}/${hash})`;
      }
    }

    // 2. primitive name 글로벌 매핑
    const primitive = primitiveMap.get(tgt);
    if (primitive) {
      if (primitive.slug === currentSlug) {
        return `[${display}](#${primitive.anchorId})`;
      }
      return `[${display}](/guide/${primitive.slug}/#${primitive.anchorId})`;
    }

    // 3. 미해결
    console.warn(`  ⚠️  위키링크 미해결 in ${currentSlug}: [[${tgt}${label ? `|${label}` : ''}]] → "${display}" 텍스트`);
    return display;
  });
}

/* ─── 인덱스 생성 (index.md 없는 챕터용) ──────────────────────── */

/**
 * index.md 가 없을 때 — primitives 들을 H2 헤더로 감싸서 자동 index 생성.
 * (예: 99-community-resources)
 *
 * 결과 형태:
 *   # <챕터 제목>
 *   ## <primitive H1 텍스트>
 *   ![[<primitive-slug>]]
 *   ---
 */
async function autoIndexFromPrimitives(srcFolder, primitivesDir) {
  const files = await fs.readdir(primitivesDir);
  const mdFiles = files.filter((f) => f.endsWith('.md')).sort();
  if (mdFiles.length === 0) return null;

  const title = srcFolder.replace(/^\d+-/, '').replace(/-/g, ' ');
  const lines = [`# ${title}\n\n`];

  for (const f of mdFiles) {
    const name = nfc(f.replace(/\.md$/, ''));
    const displayName = await readPrimitiveTitle(
      path.join(primitivesDir, f),
      name.replace(/-/g, ' '),
    );
    lines.push(`## ${displayName}\n\n![[${name}]]\n\n---\n\n`);
  }
  return lines.join('');
}

/* ─── 글로벌 primitive 맵 (크로스 챕터 위키링크용) ─────────────── */

async function buildPrimitiveMap() {
  const map = new Map();
  for (const [srcFolder, slug] of Object.entries(SLUG_MAP)) {
    const srcDir = path.join(SOURCE_ROOT, srcFolder);
    if (!(await exists(srcDir))) continue;

    const indexPath = path.join(srcDir, 'index.md');
    const primitivesDir = path.join(srcDir, 'primitives');

    const recordName = (name) => {
      if (!map.has(name)) map.set(name, { slug, anchorId: anchorIdFor(name) });
    };

    if (await exists(indexPath)) {
      const md = await fs.readFile(indexPath, 'utf8');
      const re = /!\[\[([^\]\/]+)\]\]/g;
      let m;
      while ((m = re.exec(md)) !== null) {
        const name = nfc(m[1].trim());
        if (!isImage(name)) recordName(name);
      }
    } else if (await exists(primitivesDir)) {
      // 자동 index 케이스 — primitives 모두를 매핑에 등록
      const files = await fs.readdir(primitivesDir);
      for (const f of files) {
        if (f.endsWith('.md')) recordName(nfc(f.replace(/\.md$/, '')));
      }
    }
  }
  return map;
}

/* ─── 챕터 단위 처리 ────────────────────────────────────────── */

async function syncChapter(srcFolder, slug, primitiveMap) {
  const srcDir = path.join(SOURCE_ROOT, srcFolder);
  const destDir = path.join(DEST_ROOT, slug);

  await rmrf(destDir);
  await fs.mkdir(destDir, { recursive: true });

  // 1. assets 평탄 복사
  const srcAssets = path.join(srcDir, 'assets');
  const presentFiles = (await exists(srcAssets))
    ? await copyAssetsFlat(srcAssets, path.join(destDir, 'assets'))
    : new Set();
  const presentBasenames = new Map();
  for (const f of presentFiles) {
    presentBasenames.set(path.basename(f, path.extname(f)), f);
  }

  // 2. index 로드 (없으면 자동 생성)
  const primitivesDir = path.join(srcDir, 'primitives');
  const indexPath = path.join(srcDir, 'index.md');
  let md;
  if (await exists(indexPath)) {
    md = await fs.readFile(indexPath, 'utf8');
  } else if (await exists(primitivesDir)) {
    md = await autoIndexFromPrimitives(srcFolder, primitivesDir);
    if (!md) {
      console.warn(`  ⚠️  index.md 도 primitives 도 없음: ${srcFolder}`);
      return;
    }
    console.log(`  ℹ️  ${srcFolder} index.md 없음 → primitives 에서 자동 생성`);
  } else {
    console.warn(`  ⚠️  index.md 없음: ${srcFolder}`);
    return;
  }

  // 3. H2 에 primitive 앵커 주입
  md = injectAnchorsForPrimitiveEmbeds(md);

  // 4. primitive 본문 인라인 (SYNC 마커 박힘 → reverse-sync 가 사용)
  if (await exists(primitivesDir)) {
    md = await inlinePrimitives(md, primitivesDir, srcFolder);
  }

  // 5. 이미지 임베드 변환
  md = rewriteImageEmbeds(md, presentFiles, presentBasenames, slug);

  // 6. 위키링크 → 마크다운 링크
  md = rewriteWikilinks(md, SLUG_MAP, primitiveMap, slug);

  // 7. 남은 ![[...]] 패턴 경고
  const remaining = md.match(/!\[\[[^\]]+\]\]/g);
  if (remaining) {
    console.warn(`  ⚠️  미처리 임베드 in ${slug}:`, remaining);
  }

  await fs.writeFile(path.join(destDir, 'index.md'), md.trimEnd() + '\n', 'utf8');
  console.log(`  ✓ ${srcFolder} → guide/${slug}/`);
}

/* ─── 메인 ────────────────────────────────────────────────────── */

async function main() {
  console.log(`📚 sync-from-obsidian`);
  console.log(`   from: ${SOURCE_ROOT}`);
  console.log(`   to:   ${DEST_ROOT}`);

  if (!(await exists(SOURCE_ROOT))) {
    console.error(`❌ 옵시디언 vault 경로 없음: ${SOURCE_ROOT}`);
    process.exit(1);
  }

  await fs.mkdir(DEST_ROOT, { recursive: true });

  const primitiveMap = await buildPrimitiveMap();
  console.log(`   primitives 글로벌 맵: ${primitiveMap.size}개`);

  for (const [srcFolder, slug] of Object.entries(SLUG_MAP)) {
    const srcDir = path.join(SOURCE_ROOT, srcFolder);
    if (!(await exists(srcDir))) {
      console.warn(`  ⚠️  source 없음, 건너뜀: ${srcFolder}`);
      continue;
    }
    await syncChapter(srcFolder, slug, primitiveMap);
  }

  console.log('✅ 완료');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
