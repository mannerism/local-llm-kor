#!/usr/bin/env node
/**
 * sync-from-obsidian.mjs
 *
 * Obsidian vault → VitePress 변환기.
 *
 * 입력 (옵시디언 vault):
 *   ~/Library/Mobile Documents/iCloud~md~obsidian/Documents/mannerism_notes/Personal/LocalLLM/
 *     1-사전-준비/
 *       index.md
 *       assets/*.jpg
 *       primitives/*.md
 *     ...
 *
 * 출력 (VitePress docs):
 *   docs/guide/
 *     1-prep/
 *       index.md          ← primitives 인라인 + 이미지 경로 정리
 *       assets/*.jpg
 *     ...
 *
 * 변환 규칙:
 *   - 한글 폴더명 → 영문 슬러그 (SLUG_MAP)
 *   - ![[primitive-name]]       → primitive 본문 인라인 (frontmatter·H1 제거, 헤더 한 단계 강등)
 *   - ![[image.jpg]] / ![[image]] → ![](./assets/image.jpg)
 *   - [[other-page]]            → 향후 처리 (지금은 경고만)
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

/* ─── 유틸 ────────────────────────────────────────────────────── */

const exists = async (p) => fs.access(p).then(() => true).catch(() => false);

async function rmrf(p) {
  if (await exists(p)) await fs.rm(p, { recursive: true, force: true });
}

async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) await copyDir(s, d);
    else await fs.copyFile(s, d);
  }
}

function stripFrontmatter(md) {
  if (!md.startsWith('---\n')) return md;
  const end = md.indexOf('\n---\n', 4);
  if (end === -1) return md;
  return md.slice(end + 5);
}

function stripLeadingH1(md) {
  // 처음 비공백 줄이 # XXX 면 그 줄 제거
  const lines = md.split('\n');
  let i = 0;
  while (i < lines.length && lines[i].trim() === '') i++;
  if (i < lines.length && /^#\s+/.test(lines[i])) {
    lines.splice(i, 1);
    // 바로 다음 빈 줄도 한 줄 정리
    if (i < lines.length && lines[i].trim() === '') lines.splice(i, 1);
  }
  return lines.join('\n');
}

function demoteHeaders(md, by = 1) {
  // ## → ###, ### → ####, ...  (단, 코드 펜스 안은 제외)
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

/**
 * ![[xxx.jpg]] / ![[xxx]] (이미지) → ![](./assets/xxx.jpg)
 * 누락 이미지(소스에 파일 없음)는 markdown 코멘트로 대체 → 빌드 안 깨짐.
 * ![[name]] (이미지 아닌 경우) → 이건 primitive embed라 따로 처리.
 */
function rewriteImageEmbeds(md, assetIndex, presentFiles, currentSlug) {
  return md.replace(/!\[\[([^\]]+)\]\]/g, (full, target) => {
    const base = target.trim();
    const ext = path.extname(base).toLowerCase();

    if (ext && IMAGE_EXTS.has(ext)) {
      if (presentFiles.has(base)) {
        return `![](./assets/${base})`;
      }
      console.warn(`  ⚠️  이미지 누락 in ${currentSlug}: ${base} (소스 assets/ 에 파일 없음)`);
      return `\n> _⚠️ 이미지 누락: \`${base}\` — 옵시디언 vault 에서 동기화 필요_\n`;
    }
    // 확장자 없는데 assetIndex에 있으면 이미지로 간주
    if (!ext && assetIndex.has(base)) {
      return `![](./assets/${assetIndex.get(base)})`;
    }
    return full; // primitive embed — 다음 패스에서 처리
  });
}

/**
 * ![[primitive-name]] → primitives/primitive-name.md 본문 인라인
 * primitive 이름은 점(.) 포함 허용 (예: qwen-3.6-27b-mtp).
 * 이미지 확장자(.jpg 등)는 제외 — 그건 이미지 변환 패스에서 처리.
 */
async function inlinePrimitives(md, primitivesDir) {
  const pattern = /!\[\[([^\]\/]+)\]\]/g;
  const replacements = [];
  let match;
  while ((match = pattern.exec(md)) !== null) {
    const target = match[1].trim();
    const ext = path.extname(target).toLowerCase();
    if (ext && IMAGE_EXTS.has(ext)) continue; // 이미지는 건너뜀
    const file = path.join(primitivesDir, `${target}.md`);
    if (await exists(file)) {
      let body = await fs.readFile(file, 'utf8');
      body = stripFrontmatter(body);
      body = stripLeadingH1(body);
      body = demoteHeaders(body, 1); // ## → ### (chapter section H2 아래로)
      body = body.trim();
      replacements.push({ start: match.index, end: match.index + match[0].length, body });
    } else {
      console.warn(`  ⚠️  primitive 못 찾음: ${target} (in ${primitivesDir})`);
    }
  }
  // 뒤에서부터 치환
  for (const r of replacements.reverse()) {
    md = md.slice(0, r.start) + r.body + md.slice(r.end);
  }
  return md;
}

/**
 * 위키링크 [[xxx]] / [[xxx|label]] 변환:
 *  - 크로스 챕터 [[N-XXX/index|label]] → [label](/guide/<slug>/)
 *  - 그 외       [[xxx|label]] → label (plain text, TODO: anchor 링크)
 *                [[xxx]]        → xxx
 */
function rewriteWikilinks(md, slugMap, currentSlug) {
  // 부정 lookbehind로 ! 가 앞에 안 붙은 것만 (이미지 임베드 제외)
  return md.replace(/(?<!!)\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_full, target, label) => {
    const display = (label || target).trim();
    const tgt = target.trim();

    // 1. 크로스 챕터: "N-XXX/index" 또는 "N-XXX/index#..." 같은 패턴
    const crossMatch = tgt.match(/^([^\/]+)\/index(?:#(.+))?$/);
    if (crossMatch) {
      const [, srcFolder, anchor] = crossMatch;
      const slug = slugMap[srcFolder];
      if (slug) {
        const hash = anchor ? `#${anchor}` : '';
        return `[${display}](/guide/${slug}/${hash})`;
      }
    }

    // 2. 그 외: 같은 챕터 내 primitive 참조로 간주 — 일단 plain text + 경고
    console.warn(`  ⚠️  위키링크 미해결 in ${currentSlug}: [[${tgt}${label ? `|${label}` : ''}]] (→ "${display}" 텍스트로만 변환)`);
    return display;
  });
}

/** assets/ 내 파일 목록에서 "확장자 없는 ![[Xnip...]]"용 인덱스 구축 */
async function buildAssetIndex(assetsDir) {
  const index = new Map();
  if (!(await exists(assetsDir))) return index;
  const entries = await fs.readdir(assetsDir);
  for (const f of entries) {
    const noExt = path.basename(f, path.extname(f));
    index.set(noExt, f);
  }
  return index;
}

/* ─── 메인 ────────────────────────────────────────────────────── */

/**
 * index.md 가 없을 때 — primitives/ 의 모든 .md 를 모아 자동 index 생성.
 * (예: 99-community-resources)
 */
async function autoIndexFromPrimitives(srcFolder, primitivesDir) {
  const files = await fs.readdir(primitivesDir);
  const mdFiles = files.filter((f) => f.endsWith('.md')).sort();
  if (mdFiles.length === 0) return null;

  const title = srcFolder
    .replace(/^\d+-/, '')
    .replace(/-/g, ' ');

  const lines = [`# ${title}\n`, `\n`];
  for (const f of mdFiles) {
    lines.push(`![[${f.replace(/\.md$/, '')}]]\n\n---\n\n`);
  }
  return lines.join('');
}

async function syncChapter(srcFolder, slug) {
  const srcDir = path.join(SOURCE_ROOT, srcFolder);
  const destDir = path.join(DEST_ROOT, slug);

  await rmrf(destDir);
  await fs.mkdir(destDir, { recursive: true });

  // 1. assets 복사 + 실제 존재하는 파일 목록 (누락 검출용)
  const srcAssets = path.join(srcDir, 'assets');
  const presentFiles = new Set();
  if (await exists(srcAssets)) {
    await copyDir(srcAssets, path.join(destDir, 'assets'));
    const entries = await fs.readdir(srcAssets);
    for (const f of entries) presentFiles.add(f);
  }
  const assetIndex = await buildAssetIndex(srcAssets);

  // 2. index.md 읽기 (없으면 primitives 모아서 자동 생성)
  const primitivesDir = path.join(srcDir, 'primitives');
  const indexPath = path.join(srcDir, 'index.md');
  let md;
  if (await exists(indexPath)) {
    md = await fs.readFile(indexPath, 'utf8');
  } else if (await exists(primitivesDir)) {
    md = await autoIndexFromPrimitives(srcFolder, primitivesDir);
    if (!md) {
      console.warn(`  ⚠️  index.md 도 primitives도 없음: ${srcFolder}`);
      return;
    }
    console.log(`  ℹ️  ${srcFolder} index.md 없음 → primitives에서 자동 생성`);
  } else {
    console.warn(`  ⚠️  index.md 없음: ${srcFolder}`);
    return;
  }

  // 3. primitives 인라인
  if (await exists(primitivesDir)) {
    md = await inlinePrimitives(md, primitivesDir);
  }

  // 4. 이미지 임베드 변환 (primitive 인라인 후에 해야 primitive 안 이미지도 잡힘)
  md = rewriteImageEmbeds(md, assetIndex, presentFiles, slug);

  // 5. 위키링크 변환
  md = rewriteWikilinks(md, SLUG_MAP, slug);

  // 6. 남아있는 ![[xxx]] 패턴 경고
  const remaining = md.match(/!\[\[[^\]]+\]\]/g);
  if (remaining) {
    console.warn(`  ⚠️  미처리 임베드 in ${slug}:`, remaining);
  }

  // 7. 페이지 푸터
  const sourceRel = `Personal/LocalLLM/${srcFolder}/index.md`;
  md = md.trimEnd() + `\n\n---\n\n*이 페이지의 원본은 Obsidian vault \`${sourceRel}\` 에서 동기화됩니다.*\n`;

  await fs.writeFile(path.join(destDir, 'index.md'), md, 'utf8');
  console.log(`  ✓ ${srcFolder} → guide/${slug}/`);
}

async function main() {
  console.log(`📚 sync-from-obsidian`);
  console.log(`   from: ${SOURCE_ROOT}`);
  console.log(`   to:   ${DEST_ROOT}`);

  if (!(await exists(SOURCE_ROOT))) {
    console.error(`❌ 옵시디언 vault 경로 없음: ${SOURCE_ROOT}`);
    process.exit(1);
  }

  await fs.mkdir(DEST_ROOT, { recursive: true });

  for (const [srcFolder, slug] of Object.entries(SLUG_MAP)) {
    const srcDir = path.join(SOURCE_ROOT, srcFolder);
    if (!(await exists(srcDir))) {
      console.warn(`  ⚠️  source 없음, 건너뜀: ${srcFolder}`);
      continue;
    }
    await syncChapter(srcFolder, slug);
  }

  console.log('✅ 완료');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
