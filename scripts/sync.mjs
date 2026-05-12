#!/usr/bin/env node
/**
 * sync.mjs
 *
 * vault ↔ repo docs/guide 양방향 파일 미러. 한 명령.
 *
 *   pnpm sync          # 방향 묻고 진행
 *   pnpm sync --forward   # vault → docs/guide (자동, 빌드용)
 *   pnpm sync --reverse   # docs/guide → vault (파일별 diff 승인)
 *
 * 방향:
 *   1. forward (obsidian → repo) : vault 가 source. 단순 복사. 본인이 vault 에서
 *      쓴 글이 사이트에 올라감.
 *   2. reverse (repo → obsidian) : docs/guide 가 source. 파일별 diff 확인하고
 *      y/n/q 로 승인. PR 머지된 변경을 vault 로 가져올 때 사용.
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

/**
 * 챕터 목록은 하드코딩 대신 vault/docs 디렉토리를 스캔해서 얻는다.
 * 규칙: 직속 서브디렉토리 중 이름이 `^\d+-` 로 시작하는 것 (예: 1-prep, 99-foo).
 * 정렬: 숫자 접두 오름차순, 같으면 이름순.
 *
 * 이 덕에:
 *   - vault 에 새 챕터 폴더 만들면 다음 sync 에 자동 등록
 *   - vault 에서 챕터 지우면 다음 sync 에 repo 에서도 제거
 *   - 비-챕터 부산물(`assets/`, `templates/` 등 숫자 접두 없는 폴더)은 자연 제외
 */
async function discoverChapters(root) {
  if (!(await exists(root))) return [];
  const entries = await fs.readdir(root, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && /^\d+-/.test(e.name))
    .map((e) => nfc(e.name))
    .sort((a, b) => {
      const na = parseInt(a, 10);
      const nb = parseInt(b, 10);
      return na !== nb ? na - nb : a.localeCompare(b);
    });
}

const args = process.argv.slice(2);
const FORCE_FORWARD = args.includes('--forward');
const FORCE_REVERSE = args.includes('--reverse');
const AUTO_YES = args.includes('--yes') || args.includes('-y');

/* ─── 유틸 ────────────────────────────────────────────────────── */

const exists = async (p) => fs.access(p).then(() => true).catch(() => false);
const nfc = (s) => s.normalize('NFC');

async function listFilesRel(rootDir, baseDir = rootDir, files = []) {
  if (!(await exists(rootDir))) return files;
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      await listFilesRel(full, baseDir, files);
    } else {
      files.push({ rel: nfc(path.relative(baseDir, full)), abs: full });
    }
  }
  return files;
}

/**
 * git diff 를 깔끔한 라벨로 표시. tmp 폴더 경로 노출 X.
 *   diff --git vault/6-model-pick/index.md incoming/6-model-pick/index.md
 *   --- vault/6-model-pick/index.md
 *   +++ incoming/6-model-pick/index.md
 */
async function showDiff(oldContent, newContent, rel) {
  const tmpRoot = await fs.mkdtemp(path.join(process.env.TMPDIR || '/tmp', 'sync-'));
  try {
    const oldPath = path.join(tmpRoot, 'vault', rel);
    const newPath = path.join(tmpRoot, 'incoming', rel);
    await fs.mkdir(path.dirname(oldPath), { recursive: true });
    await fs.mkdir(path.dirname(newPath), { recursive: true });
    await fs.writeFile(oldPath, oldContent);
    await fs.writeFile(newPath, newContent);

    await new Promise((resolve) => {
      const p = spawn(
        'git',
        ['-c', 'color.ui=always', 'diff', '--no-index', `vault/${rel}`, `incoming/${rel}`],
        { cwd: tmpRoot, stdio: 'inherit' },
      );
      p.on('exit', resolve);
      p.on('error', resolve);
    });
  } finally {
    await fs.rm(tmpRoot, { recursive: true, force: true }).catch(() => {});
  }
}

/* ─── forward: vault → docs/guide (자동, 빌드용) ─────────────── */

async function syncForward() {
  console.log(`\n📤 obsidian → repo`);
  console.log(`   from: ${VAULT_ROOT}`);
  console.log(`   to:   ${DOCS_ROOT}\n`);

  if (!(await exists(VAULT_ROOT))) {
    console.error(`❌ vault 경로 없음: ${VAULT_ROOT}`);
    process.exit(1);
  }
  await fs.mkdir(DOCS_ROOT, { recursive: true });

  let copied = 0, deleted = 0, unchanged = 0, removedDirs = 0;

  // vault 와 repo 양쪽을 스캔해 합집합을 순회. vault 에 새로 생긴 챕터는 자동으로
  // 추적되고, vault 에서 사라졌지만 repo 에 남은 orphan 챕터는 청소된다.
  const vaultChapters = await discoverChapters(VAULT_ROOT);
  const docsChapters = await discoverChapters(DOCS_ROOT);
  const chapters = [...new Set([...vaultChapters, ...docsChapters])].sort((a, b) => {
    const na = parseInt(a, 10);
    const nb = parseInt(b, 10);
    return na !== nb ? na - nb : a.localeCompare(b);
  });

  for (const chapter of chapters) {
    const vaultChap = path.join(VAULT_ROOT, chapter);
    const docsChap = path.join(DOCS_ROOT, chapter);

    // true mirror: vault 에 챕터 폴더가 없으면 repo 에서도 통째로 제거.
    // (예: 옵시디언에서 챕터를 삭제 → 다음 sync 에 repo 도 따라옴)
    if (!(await exists(vaultChap))) {
      if (await exists(docsChap)) {
        await fs.rm(docsChap, { recursive: true, force: true });
        console.log(`  🗑  ${chapter}/ (vault 에서 사라짐 → repo 에서도 제거)`);
        removedDirs++;
      }
      continue;
    }

    const vaultFiles = await listFilesRel(vaultChap);
    const docsFiles = await listFilesRel(docsChap);
    const vaultRels = new Set(vaultFiles.map((f) => f.rel));

    // 빈 vault 챕터는 미러할 게 없어 조용히 지나가는데, 디버깅 단서로 한 줄 남긴다.
    // (사용자가 폴더만 만들고 index.md 를 안 채운 케이스 잡기)
    if (vaultFiles.length === 0 && docsFiles.length === 0) {
      console.log(`  ℹ️  ${chapter}/ 비어있음 — index.md 가 없어 사이트에 안 올라옴`);
      continue;
    }

    // vault → repo 복사
    for (const { rel, abs } of vaultFiles) {
      const destAbs = path.join(docsChap, rel);
      let same = false;
      if (await exists(destAbs)) {
        const [a, b] = await Promise.all([fs.readFile(abs), fs.readFile(destAbs)]);
        same = a.equals(b);
      }
      if (same) { unchanged++; continue; }
      await fs.mkdir(path.dirname(destAbs), { recursive: true });
      await fs.copyFile(abs, destAbs);
      console.log(`  ✏️  ${chapter}/${rel}`);
      copied++;
    }

    // repo 에만 있는 파일 삭제 (vault 가 source-of-truth)
    for (const { rel, abs } of docsFiles) {
      if (!vaultRels.has(rel)) {
        console.log(`  ➖ ${chapter}/${rel}`);
        await fs.unlink(abs).catch(() => {});
        deleted++;
      }
    }
  }

  const dirNote = removedDirs ? ` / 챕터 삭제 ${removedDirs}` : '';
  console.log(`\n✅ 완료: 복사 ${copied} / 삭제 ${deleted} / 변경없음 ${unchanged}${dirNote}`);
}

/* ─── reverse: docs/guide → vault (대화형 승인) ──────────────── */

async function syncReverse() {
  console.log(`\n📥 repo → obsidian (파일별 승인)`);
  console.log(`   from: ${DOCS_ROOT}`);
  console.log(`   to:   ${VAULT_ROOT}\n`);

  const rl = AUTO_YES
    ? null
    : readline.createInterface({ input: process.stdin, output: process.stdout });

  let applied = 0, skipped = 0, unchanged = 0, errors = 0;
  let applyRest = false; // 'a' 누르면 남은 거 전부 자동 적용

  // reverse 도 동일하게 자동 스캔. repo 에 있지만 vault 에 없는 챕터의 파일은
  // 'create' diff 로 잡혀서 vault 에 추가될 수 있도록 합집합 순회.
  const vaultChapters = await discoverChapters(VAULT_ROOT);
  const docsChapters = await discoverChapters(DOCS_ROOT);
  const chapters = [...new Set([...vaultChapters, ...docsChapters])].sort((a, b) => {
    const na = parseInt(a, 10);
    const nb = parseInt(b, 10);
    return na !== nb ? na - nb : a.localeCompare(b);
  });

  for (const chapter of chapters) {
    const vaultChap = path.join(VAULT_ROOT, chapter);
    const docsChap = path.join(DOCS_ROOT, chapter);

    const vaultFiles = await listFilesRel(vaultChap);
    const docsFiles = await listFilesRel(docsChap);
    const vaultMap = new Map(vaultFiles.map((f) => [f.rel, f.abs]));
    const docsMap = new Map(docsFiles.map((f) => [f.rel, f.abs]));
    const allRels = new Set([...vaultMap.keys(), ...docsMap.keys()]);

    for (const rel of allRels) {
      const vaultAbs = vaultMap.get(rel);
      const docsAbs = docsMap.get(rel);
      const fullRel = `${chapter}/${rel}`;

      let action = null, oldContent = '', newContent = '';

      if (vaultAbs && docsAbs) {
        const [v, d] = await Promise.all([fs.readFile(vaultAbs), fs.readFile(docsAbs)]);
        if (v.equals(d)) { unchanged++; continue; }
        oldContent = v.toString('utf8');
        newContent = d.toString('utf8');
        action = 'update';
      } else if (!vaultAbs && docsAbs) {
        newContent = (await fs.readFile(docsAbs)).toString('utf8');
        action = 'create';
      } else if (vaultAbs && !docsAbs) {
        oldContent = (await fs.readFile(vaultAbs)).toString('utf8');
        action = 'delete';
      }

      const emoji = action === 'update' ? '✏️ ' : action === 'create' ? '➕' : '➖';
      const note = action === 'create' ? '(vault 에 새로 추가)' : action === 'delete' ? '(vault 에서 삭제)' : '';
      console.log(`\n${'━'.repeat(70)}`);
      console.log(`${emoji} ${fullRel}  ${note}`);
      console.log('━'.repeat(70));
      await showDiff(oldContent, newContent, fullRel);
      console.log('');

      let decision = 'skip';
      if (AUTO_YES || applyRest) decision = 'apply';
      else {
        const ans = (await rl.question(
          '   적용? [y]es / [n]o / [a]ll remaining / [q]uit > ',
        )).trim().toLowerCase();
        if (ans === 'y' || ans === 'yes') decision = 'apply';
        else if (ans === 'a' || ans === 'all') { decision = 'apply'; applyRest = true; }
        else if (ans === 'q' || ans === 'quit') decision = 'quit';
      }

      if (decision === 'apply') {
        try {
          if (action === 'delete') {
            await fs.unlink(vaultAbs);
            console.log('   🗑  vault 에서 삭제');
          } else {
            const target = path.join(vaultChap, rel);
            await fs.mkdir(path.dirname(target), { recursive: true });
            await fs.copyFile(docsAbs, target);
            console.log('   ✅ vault 에 적용');
          }
          applied++;
        } catch (err) {
          console.error(`   ❌ 실패: ${err.message}`);
          errors++;
        }
      } else if (decision === 'quit') {
        console.log('   ⏹  중단');
        if (rl) rl.close();
        return printReverseStats({ applied, skipped, unchanged, errors });
      } else {
        console.log('   ⏭  건너뜀');
        skipped++;
      }
    }
  }

  if (rl) rl.close();
  printReverseStats({ applied, skipped, unchanged, errors });
}

function printReverseStats(s) {
  console.log('\n' + '━'.repeat(70));
  console.log(`완료: 적용 ${s.applied} / 건너뜀 ${s.skipped} / 변경없음 ${s.unchanged} / 에러 ${s.errors}`);
}

/* ─── 방향 묻기 ───────────────────────────────────────────────── */

async function askDirection() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log('🔄 sync 방향을 선택하세요:');
  console.log('   [1] obsidian → repo   (vault 에서 쓴 글을 사이트에 반영)');
  console.log('   [2] repo → obsidian   (PR 머지된 변경을 vault 로 가져오기, 파일별 승인)');
  console.log('   [q] 취소');
  const ans = (await rl.question('> ')).trim().toLowerCase();
  rl.close();
  if (ans === '1') return 'forward';
  if (ans === '2') return 'reverse';
  return 'quit';
}

/* ─── 메인 ────────────────────────────────────────────────────── */

async function main() {
  let direction;
  if (FORCE_FORWARD) direction = 'forward';
  else if (FORCE_REVERSE) direction = 'reverse';
  else direction = await askDirection();

  if (direction === 'forward') await syncForward();
  else if (direction === 'reverse') await syncReverse();
  else console.log('취소됨');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
