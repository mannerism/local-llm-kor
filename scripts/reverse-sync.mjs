#!/usr/bin/env node
/**
 * reverse-sync.mjs
 *
 * 머지된 PR 의 변경을 옵시디언 vault 로 역동기화.
 * 절대 자동 덮어쓰지 않음 — 파일별로 diff 보여주고 사용자 승인 받음.
 *
 * 작동 원리:
 *   docs/guide/<slug>/index.md 에 박혀있는 SYNC 마커
 *     <!-- SYNC:BEGIN src="<srcFolder>/primitives/<name>.md" demote="N" -->
 *     ...본문...
 *     <!-- SYNC:END   src="<srcFolder>/primitives/<name>.md" -->
 *   를 파싱해서:
 *     1. 본문 추출
 *     2. 헤더 N 단계 promote (forward sync 가 강등한 만큼 복원)
 *     3. vault 의 원본 primitive 에서 frontmatter + H1 보존, 본문만 교체
 *     4. 변경이 있으면 diff 표시 + 승인 받기
 *
 * 사용법:
 *   pnpm reverse-sync           # 대화형 (각 파일마다 y/n/q 물어봄)
 *   pnpm reverse-sync --dry-run # 변경 미리보기만 (vault 안 건드림)
 *   pnpm reverse-sync --yes     # 전부 자동 적용 (위험)
 *
 * 한계:
 *   - primitive 본문 변경만 역동기화. index.md 의 흐름·헤더 변경은 vault 직접 편집.
 *   - PR 이 새 primitive 추가 (새 ![[...]] embed) 한 경우는 처리 못 함 → 수동 처리.
 *   - SYNC 마커 밖 콘텐츠 변경은 orphan 으로 보고만 함.
 */

import { promises as fs } from 'node:fs';
import readline from 'node:readline/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const VAULT_ROOT = path.join(
  process.env.HOME,
  'Library/Mobile Documents/iCloud~md~obsidian/Documents/mannerism_notes/Personal/LocalLLM',
);
const DOCS_ROOT = path.join(REPO_ROOT, 'docs/guide');

// 영문 슬러그 → 한글 폴더명 (sync-from-obsidian.mjs 의 SLUG_MAP 역방향)
const SLUG_TO_FOLDER = {
  '1-prep': '1-사전-준비',
  '2-llamacpp': '2-llama-cpp-설치',
  '3-llamacpp-vs-mlx': '3-llama-cpp-vs-mlx',
  '4-model-name': '4-model-name',
  '5-model-speed': '5-model-speed',
  '6-model-pick': '6-model-pick',
  '7-model-run': '7-model-run',
  '8-terminal-agent': '8-terminal-agent',
  '9-qwen-35b-a3b': '9-qwen-35b-a3b',
  '99-community-resources': '99-community-resources',
};

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const AUTO_YES = args.includes('--yes') || args.includes('-y');

/* ─── 유틸 ────────────────────────────────────────────────────── */

const exists = async (p) => fs.access(p).then(() => true).catch(() => false);
const nfc = (s) => s.normalize('NFC');

function stripFrontmatter(md) {
  if (!md.startsWith('---\n')) return { frontmatter: '', body: md };
  const end = md.indexOf('\n---\n', 4);
  if (end === -1) return { frontmatter: '', body: md };
  return { frontmatter: md.slice(0, end + 5), body: md.slice(end + 5) };
}

/** 헤더를 N 단계 promote (## → # if by=1, ### → ## if by=1, 등) */
function promoteHeaders(md, by) {
  const out = [];
  let inFence = false;
  for (const line of md.split('\n')) {
    if (/^```/.test(line)) inFence = !inFence;
    if (!inFence) {
      const m = line.match(/^(#{2,6})(\s+.*)$/);
      if (m && m[1].length - by >= 1) {
        out.push('#'.repeat(m[1].length - by) + m[2]);
        continue;
      }
    }
    out.push(line);
  }
  return out.join('\n');
}

/**
 * 표준 마크다운 이미지 → Obsidian 위키링크 형태로 복원.
 *   ![](./assets/foo.jpg) → ![[foo.jpg]]
 *   ![alt](./assets/foo.jpg) → ![[foo.jpg]]  (alt 텍스트는 버림 — vault 가 안 쓰니까)
 */
function imageEmbedsToWikilinks(md) {
  return md.replace(/!\[[^\]]*\]\(\.\/assets\/([^)]+)\)/g, (_full, filename) => {
    return `![[${filename}]]`;
  });
}

/**
 * forward sync 가 변환한 마크다운 링크를 Obsidian 위키링크로 역복원.
 *   [L](#primitive-X)                 → [[X|L]]   (라벨이 X 와 같으면 [[X]])
 *   [L](/guide/<slug>/#primitive-X)   → [[X|L]]   (vault 위키링크는 폴더 prefix 불필요)
 *   [L](/guide/<slug>/)               → [[<원본폴더>/index|L]]
 */
function markdownLinksToWikilinks(md, slugToFolder) {
  // 1. 앵커 only: [L](#primitive-X)
  md = md.replace(/\[([^\]]+)\]\(#primitive-([^)]+)\)/g, (_full, label, primitiveName) => {
    if (label.trim() === primitiveName.trim()) return `[[${primitiveName}]]`;
    return `[[${primitiveName}|${label}]]`;
  });
  // 2. 크로스 챕터 primitive: [L](/guide/SLUG/#primitive-X)
  md = md.replace(/\[([^\]]+)\]\(\/guide\/([^/]+)\/#primitive-([^)]+)\)/g, (_full, label, _slug, primitiveName) => {
    if (label.trim() === primitiveName.trim()) return `[[${primitiveName}]]`;
    return `[[${primitiveName}|${label}]]`;
  });
  // 3. 크로스 챕터 인덱스: [L](/guide/SLUG/)
  md = md.replace(/\[([^\]]+)\]\(\/guide\/([^/]+)\/\)/g, (_full, label, slug) => {
    const folder = slugToFolder[slug];
    if (!folder) return `[${label}](/guide/${slug}/)`;
    return `[[${folder}/index|${label}]]`;
  });
  return md;
}

/**
 * 마크다운에서 SYNC 마커로 감싼 블록을 모두 추출.
 * 마커 안에 또 다른 마커가 들어가는 경우는 없다고 가정.
 */
function extractMarkedBlocks(md) {
  const blocks = [];
  const re = /<!-- SYNC:BEGIN src="([^"]+)" demote="(\d+)" -->\n?([\s\S]*?)\n?<!-- SYNC:END src="\1" -->/g;
  let m;
  while ((m = re.exec(md)) !== null) {
    blocks.push({
      src: nfc(m[1]),
      demote: parseInt(m[2], 10),
      body: m[3],
      matchStart: m.index,
      matchEnd: m.index + m[0].length,
    });
  }
  return blocks;
}

/**
 * vault primitive 의 새 콘텐츠 구성:
 *   frontmatter (원본 보존) + H1 (원본 보존) + 빈 줄 + promote 된 body
 *
 * 원본이 없으면 frontmatter/H1 없이 body 만 (새 primitive 추가 케이스 — 드묾).
 */
async function buildNewVaultContent(vaultPath, promotedBody) {
  let original = '';
  if (await exists(vaultPath)) {
    original = await fs.readFile(vaultPath, 'utf8');
  }

  const { frontmatter, body } = stripFrontmatter(original);

  // body 구조 분해 — 원본의 (빈줄)(H1)(빈줄) 패턴을 그대로 보존.
  //   body = (leadingBlanks)(# H1\n)(afterH1Blanks)(나머지...)
  //
  // 나머지 부분만 promotedBody 로 교체. leadingBlanks·H1·afterH1Blanks 는 vault 원본 그대로.
  const m = body.match(/^(\n*)(#\s+[^\n]*\n)(\n*)/);
  let prefix;
  if (m) {
    prefix = frontmatter + m[1] + m[2] + m[3];
  } else {
    // H1 없는 primitive (드묾) — frontmatter 뒤 곧장 body
    prefix = frontmatter;
  }

  let out = prefix + promotedBody.trim();
  if (original.endsWith('\n')) out += '\n';
  return out;
}

/** git diff --no-index 로 컬러 diff 보여줌. exit code 무시. */
async function showDiff(oldContent, newContent) {
  const tmpDir = process.env.TMPDIR || '/tmp';
  const ts = Date.now();
  const tmpOld = path.join(tmpDir, `reverse-sync-vault-${ts}.md`);
  const tmpNew = path.join(tmpDir, `reverse-sync-incoming-${ts}.md`);
  await fs.writeFile(tmpOld, oldContent);
  await fs.writeFile(tmpNew, newContent);

  await new Promise((resolve) => {
    const p = spawn(
      'git',
      [
        'diff',
        '--no-index',
        '--color=always',
        `--src-prefix=vault/`,
        `--dst-prefix=incoming/`,
        tmpOld,
        tmpNew,
      ],
      { stdio: 'inherit' },
    );
    p.on('exit', resolve);
    p.on('error', resolve);
  });

  await fs.unlink(tmpOld).catch(() => {});
  await fs.unlink(tmpNew).catch(() => {});
}

/* ─── 메인 ────────────────────────────────────────────────────── */

async function main() {
  const stats = { applied: 0, skipped: 0, unchanged: 0, errors: 0, orphan: 0 };

  const rl = AUTO_YES || DRY_RUN
    ? null
    : readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log(`🔄 reverse-sync (docs/guide → vault)`);
  console.log(`   vault: ${VAULT_ROOT}`);
  console.log(`   docs:  ${DOCS_ROOT}`);
  if (DRY_RUN) console.log(`   ⚠️  DRY-RUN: vault 안 건드림`);
  if (AUTO_YES) console.log(`   ⚠️  AUTO-YES: 모든 변경 자동 적용`);
  console.log('');

  for (const slug of Object.keys(SLUG_TO_FOLDER)) {
    const indexPath = path.join(DOCS_ROOT, slug, 'index.md');
    if (!(await exists(indexPath))) continue;

    const md = await fs.readFile(indexPath, 'utf8');
    const blocks = extractMarkedBlocks(md);
    if (blocks.length === 0) continue;

    for (const { src, demote, body } of blocks) {
      const vaultPath = path.join(VAULT_ROOT, src);
      // 1) 헤더 promote (강등 복원)
      let processed = promoteHeaders(body, demote);
      // 2) 마크다운 링크 → Obsidian wikilink 복원
      processed = markdownLinksToWikilinks(processed, SLUG_TO_FOLDER);
      // 3) 표준 마크다운 이미지 → Obsidian wikilink 복원
      processed = imageEmbedsToWikilinks(processed);
      const newContent = await buildNewVaultContent(vaultPath, processed);

      let currentContent = '';
      try {
        currentContent = await fs.readFile(vaultPath, 'utf8');
      } catch {
        // vault 에 파일이 없음 — PR 이 새로 만들었거나, 다른 문제
      }

      if (newContent === currentContent) {
        stats.unchanged++;
        continue;
      }

      console.log(`\n${'━'.repeat(70)}`);
      console.log(`📝 ${src}`);
      if (!currentContent) console.log(`   (vault 에 없는 파일 — 새로 생성)`);
      console.log(`${'━'.repeat(70)}`);
      await showDiff(currentContent, newContent);
      console.log('');

      let decision = 'skip';
      if (DRY_RUN) {
        console.log('  (dry-run: 적용 안 함)');
        decision = 'skip';
      } else if (AUTO_YES) {
        decision = 'apply';
      } else {
        const ans = (await rl.question('   적용할까요? [y/n/q to quit] ')).trim().toLowerCase();
        if (ans === 'y' || ans === 'yes') decision = 'apply';
        else if (ans === 'q' || ans === 'quit') decision = 'quit';
        else decision = 'skip';
      }

      if (decision === 'apply') {
        try {
          await fs.mkdir(path.dirname(vaultPath), { recursive: true });
          await fs.writeFile(vaultPath, newContent);
          console.log('   ✅ vault 에 적용됨');
          stats.applied++;
        } catch (err) {
          console.error(`   ❌ 쓰기 실패: ${err.message}`);
          stats.errors++;
        }
      } else if (decision === 'quit') {
        console.log('   ⏹  중단');
        if (rl) rl.close();
        return printStats(stats);
      } else {
        console.log('   ⏭  건너뜀');
        stats.skipped++;
      }
    }
  }

  if (rl) rl.close();
  printStats(stats);
}

function printStats(s) {
  console.log('');
  console.log('━'.repeat(70));
  console.log(`완료: 적용 ${s.applied} / 건너뜀 ${s.skipped} / 변경없음 ${s.unchanged} / 에러 ${s.errors}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
