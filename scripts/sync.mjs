#!/usr/bin/env node
/**
 * sync.mjs
 *
 * vault ↔ repo docs/guide 양방향 파일 미러. 한 명령.
 *
 *   pnpm sync          # 방향 묻고 진행
 *   pnpm sync --forward   # vault → docs/guide (자동, 빌드용)
 *   pnpm sync --forward --force   # 시리즈 통째 삭제까지 허용 (기본은 보호)
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
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

// vault 경로는 절대 하드코딩하지 않음 — 메인테이너의 iCloud 경로·폴더 구조를
// public repo 에 노출하지 않기 위함. .env.local 에 OBSIDIAN_VAULT_ROOT=... 형태.
// package.json 의 sync/dev/build 스크립트가 `node --env-file-if-exists=.env.local`
// 로 실행해서 자동 로드. 환경변수가 없으면 syncForward 에서 graceful skip.
const VAULT_ROOT = process.env.OBSIDIAN_VAULT_ROOT;
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
export async function discoverChapters(root) {
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
// 시리즈 통째 삭제 허용 플래그. 기본(false)이면 vault 에 없는 시리즈를 지우지 않고
// 보류한다 — iCloud 부분 동기화/잘못된 경로로 인한 대량 삭제 방지.
const FORCE_WIPE = args.includes('--force');

/* ─── 유틸 ────────────────────────────────────────────────────── */

const exists = async (p) => fs.access(p).then(() => true).catch(() => false);
const nfc = (s) => s.normalize('NFC');

export async function listFilesRel(rootDir, baseDir = rootDir, files = []) {
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

/* ─── 시리즈 발견 (루트 직속 서브디렉토리) ───────────────────────
 *
 * 다중 시리즈 구조: <root>/<series>/<N-챕터>/...
 *   - series : 루트 직속 서브디렉토리 (dotfolder 제외). 예: local-llm-0-to-1
 *   - chapter: 시리즈 안의 `^\d+-` 폴더 (discoverChapters 그대로 재사용)
 * 시리즈 이름엔 숫자 접두 규칙이 없으므로 단순 사전순 정렬.
 */
export async function discoverSeries(root) {
  if (!(await exists(root))) return [];
  const entries = await fs.readdir(root, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => nfc(e.name))
    .sort((a, b) => a.localeCompare(b));
}

// 챕터 합집합 — 숫자 접두 오름차순 (1,2,...,9,10,99), 같으면 이름순.
function unionChapters(a, b) {
  return [...new Set([...a, ...b])].sort((x, y) => {
    const nx = parseInt(x, 10);
    const ny = parseInt(y, 10);
    return nx !== ny ? nx - ny : x.localeCompare(y);
  });
}

// 시리즈 합집합 — 사전순.
function unionSeries(a, b) {
  return [...new Set([...a, ...b])].sort((x, y) => x.localeCompare(y));
}

/* ─── forward: vault → docs/guide (자동, 빌드용) ─────────────── */

export async function syncForward({ vaultRoot = VAULT_ROOT, docsRoot = DOCS_ROOT, force = FORCE_WIPE } = {}) {
  console.log(`\n📤 obsidian → repo`);

  // vault 없는 환경(Vercel·CI·기여자) 에선 sync 자체를 건너뛴다.
  // docs/guide/ 가 이미 repo 에 커밋돼 있으므로 그 상태로 빌드만 진행하면 됨.
  if (!vaultRoot) {
    console.log(`ℹ️  OBSIDIAN_VAULT_ROOT 미설정 — sync 건너뜀.`);
    console.log(`    메인테이너: .env.local 파일에 OBSIDIAN_VAULT_ROOT=<vault 절대경로> 추가.`);
    console.log(`    (예시는 .env.local.example 참고)`);
    console.log(`    CI·Vercel·기여자 환경에서는 정상 — docs/guide/ 의 커밋된 상태로 빌드 진행.`);
    return;
  }
  if (!(await exists(vaultRoot))) {
    console.log(`ℹ️  OBSIDIAN_VAULT_ROOT 가 가리키는 경로가 존재하지 않음 — sync 건너뜀.`);
    console.log(`    설정된 값: ${vaultRoot}`);
    console.log(`    docs/guide/ 의 커밋된 상태 그대로 빌드 진행.`);
    return;
  }
  console.log(`   from: ${vaultRoot}`);
  console.log(`   to:   ${docsRoot}\n`);
  await fs.mkdir(docsRoot, { recursive: true });

  const stats = { copied: 0, deleted: 0, unchanged: 0, removedDirs: 0, protectedSeries: 0 };

  // 시리즈 단위 합집합 순회. vault 에서 사라진 시리즈는 (--force 일 때만) repo 에서도 제거.
  const seriesList = unionSeries(
    await discoverSeries(vaultRoot),
    await discoverSeries(docsRoot),
  );

  for (const series of seriesList) {
    const vaultSeries = path.join(vaultRoot, series);
    const docsSeries = path.join(docsRoot, series);

    if (!(await exists(vaultSeries))) {
      if (await exists(docsSeries)) {
        if (!force) {
          // vault 에 시리즈가 통째로 없음 — iCloud 부분 동기화/잘못된 경로일 수 있어
          // 대량 삭제를 보류한다. 의도한 삭제면 --force.
          console.warn(`  ⛔ ${series}/ 가 vault 에 없음 — 통째 삭제 보류 (의도한 삭제면 --force).`);
          stats.protectedSeries++;
        } else {
          await fs.rm(docsSeries, { recursive: true, force: true });
          console.log(`  🗑  ${series}/ (vault 에서 사라짐 → repo 에서도 제거)`);
          stats.removedDirs++;
        }
      }
      continue;
    }

    await forwardSeries(vaultSeries, docsSeries, `${series}/`, stats);
  }

  const dirNote = stats.removedDirs ? ` / 삭제 디렉토리 ${stats.removedDirs}` : '';
  const protNote = stats.protectedSeries ? ` / 보류된 시리즈 ${stats.protectedSeries} (--force 로 삭제)` : '';
  console.log(`\n✅ 완료: 복사 ${stats.copied} / 삭제 ${stats.deleted} / 변경없음 ${stats.unchanged}${dirNote}${protNote}`);
}

// 한 시리즈 안의 ^\d+- 챕터들을 vault → docs 로 미러. 카운터는 stats 에 누적.
async function forwardSeries(vaultBase, docsBase, prefix, stats) {
  // vault 와 repo 양쪽을 스캔해 합집합을 순회. vault 에 새로 생긴 챕터는 자동으로
  // 추적되고, vault 에서 사라졌지만 repo 에 남은 orphan 챕터는 청소된다.
  const chapters = unionChapters(
    await discoverChapters(vaultBase),
    await discoverChapters(docsBase),
  );

  for (const chapter of chapters) {
    const vaultChap = path.join(vaultBase, chapter);
    const docsChap = path.join(docsBase, chapter);

    // true mirror: vault 에 챕터 폴더가 없으면 repo 에서도 통째로 제거.
    // (예: 옵시디언에서 챕터를 삭제 → 다음 sync 에 repo 도 따라옴)
    if (!(await exists(vaultChap))) {
      if (await exists(docsChap)) {
        await fs.rm(docsChap, { recursive: true, force: true });
        console.log(`  🗑  ${prefix}${chapter}/ (vault 에서 사라짐 → repo 에서도 제거)`);
        stats.removedDirs++;
      }
      continue;
    }

    const vaultFiles = await listFilesRel(vaultChap);
    const docsFiles = await listFilesRel(docsChap);
    const vaultRels = new Set(vaultFiles.map((f) => f.rel));

    // 빈 vault 챕터는 미러할 게 없어 조용히 지나가는데, 디버깅 단서로 한 줄 남긴다.
    // (사용자가 폴더만 만들고 index.md 를 안 채운 케이스 잡기)
    if (vaultFiles.length === 0 && docsFiles.length === 0) {
      console.log(`  ℹ️  ${prefix}${chapter}/ 비어있음 — index.md 가 없어 사이트에 안 올라옴`);
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
      if (same) { stats.unchanged++; continue; }
      await fs.mkdir(path.dirname(destAbs), { recursive: true });
      await fs.copyFile(abs, destAbs);
      console.log(`  ✏️  ${prefix}${chapter}/${rel}`);
      stats.copied++;
    }

    // repo 에만 있는 파일 삭제 (vault 가 source-of-truth)
    for (const { rel, abs } of docsFiles) {
      if (!vaultRels.has(rel)) {
        console.log(`  ➖ ${prefix}${chapter}/${rel}`);
        await fs.unlink(abs).catch(() => {});
        stats.deleted++;
      }
    }
  }
}

/* ─── reverse: docs/guide → vault (대화형 승인) ──────────────── */

export async function syncReverse({ vaultRoot = VAULT_ROOT, docsRoot = DOCS_ROOT, autoYes = AUTO_YES, showDiffs = true, rl } = {}) {
  if (!vaultRoot) {
    console.error(`❌ OBSIDIAN_VAULT_ROOT 미설정 — reverse sync 는 vault 가 필수.`);
    console.error(`    .env.local 파일에 OBSIDIAN_VAULT_ROOT=<vault 절대경로> 추가하세요.`);
    process.exit(1);
  }
  console.log(`\n📥 repo → obsidian (파일별 승인)`);
  console.log(`   from: ${docsRoot}`);
  console.log(`   to:   ${vaultRoot}\n`);

  const state = {
    applied: 0, skipped: 0, unchanged: 0, errors: 0,
    applyRest: false, // 'a' 누르면 남은 거 전부 자동 적용
    autoYes, showDiffs,
    // rl 주입 가능(테스트용). 주입 안 했으면 직접 생성하고, 끝나면 우리가 닫는다.
    rl: rl ?? (autoYes ? null : readline.createInterface({ input: process.stdin, output: process.stdout })),
    ownsRl: !rl,
  };

  // 시리즈 단위 합집합 순회. repo 에만 있는 시리즈/챕터의 파일은 'create' 로 잡힘.
  const seriesList = unionSeries(
    await discoverSeries(vaultRoot),
    await discoverSeries(docsRoot),
  );

  for (const series of seriesList) {
    const quit = await reverseSeries(
      path.join(vaultRoot, series),
      path.join(docsRoot, series),
      `${series}/`,
      state,
    );
    if (quit) break;
  }

  if (state.ownsRl && state.rl) state.rl.close();
  printReverseStats(state);
}

// 한 시리즈 안의 챕터들을 docs → vault 로 (파일별 승인) 반영. quit 누르면 true 반환.
async function reverseSeries(vaultBase, docsBase, prefix, state) {
  // repo 에 있지만 vault 에 없는 챕터의 파일은 'create' 로 잡히도록 합집합 순회.
  const chapters = unionChapters(
    await discoverChapters(vaultBase),
    await discoverChapters(docsBase),
  );

  for (const chapter of chapters) {
    const vaultChap = path.join(vaultBase, chapter);
    const docsChap = path.join(docsBase, chapter);

    const vaultFiles = await listFilesRel(vaultChap);
    const docsFiles = await listFilesRel(docsChap);
    const vaultMap = new Map(vaultFiles.map((f) => [f.rel, f.abs]));
    const docsMap = new Map(docsFiles.map((f) => [f.rel, f.abs]));
    const allRels = new Set([...vaultMap.keys(), ...docsMap.keys()]);

    for (const rel of allRels) {
      const vaultAbs = vaultMap.get(rel);
      const docsAbs = docsMap.get(rel);
      const fullRel = `${prefix}${chapter}/${rel}`;

      let action = null, oldContent = '', newContent = '';

      if (vaultAbs && docsAbs) {
        const [v, d] = await Promise.all([fs.readFile(vaultAbs), fs.readFile(docsAbs)]);
        if (v.equals(d)) { state.unchanged++; continue; }
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
      if (state.showDiffs) await showDiff(oldContent, newContent, fullRel);
      console.log('');

      let decision = 'skip';
      if (state.autoYes || state.applyRest) decision = 'apply';
      else {
        const ans = (await state.rl.question(
          '   적용? [y]es / [n]o / [a]ll remaining / [q]uit > ',
        )).trim().toLowerCase();
        if (ans === 'y' || ans === 'yes') decision = 'apply';
        else if (ans === 'a' || ans === 'all') { decision = 'apply'; state.applyRest = true; }
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
          state.applied++;
        } catch (err) {
          console.error(`   ❌ 실패: ${err.message}`);
          state.errors++;
        }
      } else if (decision === 'quit') {
        console.log('   ⏹  중단');
        return true;
      } else {
        console.log('   ⏭  건너뜀');
        state.skipped++;
      }
    }
  }

  return false;
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

// CLI 진입점일 때만 실행. 테스트가 import 해도 main() 이 안 돌도록 가드.
const isCliEntry = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isCliEntry) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
