#!/usr/bin/env node
/**
 * rename-vault-to-english.mjs
 *
 * 일회성 마이그레이션 스크립트.
 * 옵시디언 vault 의 한글 폴더명·파일명을 영문으로 일괄 변경하고,
 * 그 과정에서 모든 .md 파일의 위키링크/임베드 참조도 같이 업데이트.
 *
 * 순서:
 *   1. vault 의 모든 .md 파일 본문에서 [[OLD]], ![[OLD]] 등 패턴을 NEW 로 치환
 *   2. primitive 파일 rename
 *   3. 챕터 폴더 rename
 *
 * 사용:
 *   pnpm rename-vault            # 실행
 *   pnpm rename-vault --dry-run  # 미리보기
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

// vault 경로 노출 방지 — .env.local 의 OBSIDIAN_VAULT_ROOT 사용.
// 이 스크립트는 일회성 마이그레이션이라 환경변수 없으면 즉시 종료.
const VAULT_ROOT = process.env.OBSIDIAN_VAULT_ROOT;
if (!VAULT_ROOT) {
  console.error(`❌ OBSIDIAN_VAULT_ROOT 미설정 — .env.local 에 추가 후 다시 실행하세요.`);
  process.exit(1);
}

const DRY_RUN = process.argv.includes('--dry-run');

// 폴더명 rename (vault 최상위)
const FOLDER_RENAMES = {
  '1-사전-준비': '1-prep',
  '2-llama-cpp-설치': '2-llamacpp',
};

// primitive 파일명 rename (확장자 .md 없이)
const FILE_RENAMES = {
  // 5-model-speed/primitives/
  '메모리-대역폭': 'memory-bandwidth',
  '메모리-용량과-헤드룸': 'memory-capacity',
  '하드웨어-구매-가이드': 'hardware-buying-guide',
  '추론-엔진-플래그': 'inference-flags',
  '양자화와-속도': 'quantization-speed',
  '가속-기술': 'acceleration',
  '컨텍스트-prefill': 'context-prefill',
  'Dense-vs-MoE-속도': 'dense-vs-moe',
  // 4-model-name/primitives/
  '로컬-모델-이름-이해하기-기본편': 'model-naming-basics',
  '로컬-모델-이름-이해하기-응용편': 'model-naming-advanced',
  // 7-model-run/primitives/
  '모델-시험-해보기': 'try-the-model',
  'huggingface-다운로드': 'huggingface-download',
  'llama-cpp-pr-빌드': 'llama-cpp-pr-build',
  // 9-qwen-35b-a3b/primitives/
  '듀얼-모델-운영': 'dual-model-ops',
  '35b-a3b-다운로드': '35b-a3b-download',
  'qwen-3.6-35b-a3b': 'qwen-36-35b-a3b',
  // 6-model-pick/primitives/
  'qwen-3.6-27b-mtp': 'qwen-36-27b-mtp',
  // 99-community-resources/primitives/
  '커뮤니티-리소스': 'community-resources',
};

const nfc = (s) => s.normalize('NFC');
const exists = async (p) => fs.access(p).then(() => true).catch(() => false);
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* ─── Step 1: 모든 .md 파일의 위키링크 본문 업데이트 ─────────────── */

/**
 * 한 파일 본문에서 다음 패턴을 OLD → NEW 로 치환:
 *   [[OLD]], [[OLD|label]], [[OLD#anchor]], [[OLD/...]]
 *   ![[OLD]], ![[OLD.md]] 등 임베드
 */
function applyRenamesToContent(content, allRenames) {
  for (const [oldName, newName] of Object.entries(allRenames)) {
    const esc = escapeRegex(oldName);
    // (!?\[\[)<OLD>(?=[\]\|#/] | \.md[\]\|#]) 다음에 wikilink 종료 기호가 오는 경우만 매치
    const re = new RegExp(`(!?\\[\\[)${esc}(?=[\\]\\|#/]|\\.md[\\]\\|#])`, 'g');
    content = content.replace(re, `$1${newName}`);
  }
  return content;
}

async function walkMdFiles(dir, files = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkMdFiles(p, files);
    } else if (entry.name.endsWith('.md')) {
      files.push(p);
    }
  }
  return files;
}

async function updateAllContentReferences() {
  // 폴더 rename 도 같이 매핑 (cross-chapter 위키링크 [[1-사전-준비/index|...]] 대응)
  const allRenames = { ...FOLDER_RENAMES, ...FILE_RENAMES };

  const mdFiles = await walkMdFiles(VAULT_ROOT);
  let updated = 0;
  for (const file of mdFiles) {
    const orig = await fs.readFile(file, 'utf8');
    const next = applyRenamesToContent(orig, allRenames);
    if (next !== orig) {
      updated++;
      const rel = path.relative(VAULT_ROOT, file);
      console.log(`  ✏️  ${rel}`);
      if (!DRY_RUN) await fs.writeFile(file, next);
    }
  }
  console.log(`  → ${updated} 파일 본문 업데이트${DRY_RUN ? ' (dry-run, 안 씀)' : ''}`);
}

/* ─── Step 2: primitive 파일 rename ───────────────────────────── */

async function renamePrimitiveFiles() {
  const mdFiles = await walkMdFiles(VAULT_ROOT);
  let renamed = 0;
  for (const file of mdFiles) {
    const base = nfc(path.basename(file, '.md'));
    if (base in FILE_RENAMES) {
      const newBase = FILE_RENAMES[base];
      const newPath = path.join(path.dirname(file), `${newBase}.md`);
      const rel = path.relative(VAULT_ROOT, file);
      const newRel = path.relative(VAULT_ROOT, newPath);
      console.log(`  📄 ${rel} → ${newRel}`);
      if (!DRY_RUN) await fs.rename(file, newPath);
      renamed++;
    }
  }
  console.log(`  → ${renamed} 파일 rename${DRY_RUN ? ' (dry-run, 안 함)' : ''}`);
}

/* ─── Step 3: 챕터 폴더 rename ────────────────────────────────── */

async function renameChapterFolders() {
  let renamed = 0;
  for (const [oldName, newName] of Object.entries(FOLDER_RENAMES)) {
    const oldPath = path.join(VAULT_ROOT, oldName);
    const newPath = path.join(VAULT_ROOT, newName);
    if (await exists(oldPath)) {
      console.log(`  📁 ${oldName}/ → ${newName}/`);
      if (!DRY_RUN) await fs.rename(oldPath, newPath);
      renamed++;
    }
  }
  console.log(`  → ${renamed} 폴더 rename${DRY_RUN ? ' (dry-run, 안 함)' : ''}`);
}

/* ─── 메인 ────────────────────────────────────────────────────── */

async function main() {
  console.log(`🔄 vault rename to English`);
  console.log(`   vault: ${VAULT_ROOT}`);
  if (DRY_RUN) console.log(`   ⚠️  DRY-RUN: 실제 변경 안 함\n`);

  if (!(await exists(VAULT_ROOT))) {
    console.error(`❌ vault 경로 없음: ${VAULT_ROOT}`);
    process.exit(1);
  }

  console.log('\n[1/3] 모든 .md 파일 본문의 위키링크 참조 업데이트');
  await updateAllContentReferences();

  console.log('\n[2/3] primitive 파일 rename');
  await renamePrimitiveFiles();

  console.log('\n[3/3] 챕터 폴더 rename');
  await renameChapterFolders();

  console.log('\n✅ 완료');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
