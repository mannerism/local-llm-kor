/**
 * sync.test.mjs — sync.mjs 회귀 테스트 (다중 시리즈 구조).
 *
 *   node --test scripts/sync.test.mjs      (또는 pnpm test)
 *
 * 구조: <root>/<series>/<N-chapter>/...
 *   - series  : 루트 직속 서브디렉토리 (예: local-llm-0-to-1)
 *   - chapter : 시리즈 안의 `^\d+-` 폴더 (예: 1-prep)
 *
 * 모든 테스트는 OS 임시 디렉토리에 가짜 vault/docs 트리를 만들어 돌린다.
 * 실제 vault 나 repo 의 docs/guide 는 절대 건드리지 않는다 (vaultRoot/docsRoot 주입).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  discoverSeries,
  discoverChapters,
  listFilesRel,
  syncForward,
  syncReverse,
} from './sync.mjs';

/* ─── 콘솔 음소거 (sync 함수는 로그가 많다) ─── */
console.log = () => {};
console.error = () => {};

/* ─── 헬퍼 ──────────────────────────────────────────────────────── */

const S = 'local-llm-0-to-1'; // 기본 테스트 시리즈

async function mkTmp(prefix) {
  return fs.mkdtemp(path.join(os.tmpdir(), `${prefix}-`));
}
async function writeFile(abs, content) {
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, content);
}
async function readFile(abs) {
  return fs.readFile(abs, 'utf8');
}
async function exists(p) {
  return fs.access(p).then(() => true).catch(() => false);
}

/** root 아래 모든 파일의 상대경로(posix)를 정렬해 반환. listFilesRel 과 독립 구현. */
async function walk(root, base = root, out = []) {
  let entries;
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(root, e.name);
    if (e.isDirectory()) await walk(full, base, out);
    else out.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return out.sort();
}

/** 임시 vault/docs 한 쌍을 만들고 콜백에 넘긴 뒤 정리. */
async function withDirs(fn) {
  const vault = await mkTmp('synctest-vault');
  const docs = await mkTmp('synctest-docs');
  try {
    return await fn({ vault, docs });
  } finally {
    await fs.rm(vault, { recursive: true, force: true }).catch(() => {});
    await fs.rm(docs, { recursive: true, force: true }).catch(() => {});
  }
}

/* ─── discoverSeries ────────────────────────────────────────────── */

test('discoverSeries: 직속 서브디렉토리만, dotdir·파일 제외, 사전순', async () => {
  await withDirs(async ({ vault }) => {
    for (const d of ['pi-agent-0-to-1', 'local-llm-0-to-1', '.obsidian']) {
      await fs.mkdir(path.join(vault, d), { recursive: true });
    }
    await writeFile(path.join(vault, 'README.md'), 'x'); // 파일 제외
    const series = await discoverSeries(vault);
    assert.deepEqual(series, ['local-llm-0-to-1', 'pi-agent-0-to-1']);
  });
});

test('discoverSeries: 존재하지 않는 root → []', async () => {
  assert.deepEqual(await discoverSeries('/no/such/path/xyz'), []);
});

/* ─── discoverChapters (시리즈 디렉토리 기준, 한 단계) ───────────── */

test('discoverChapters: ^\\d+- 폴더만, 숫자순 정렬', async () => {
  await withDirs(async ({ vault }) => {
    const base = path.join(vault, S);
    for (const d of ['1-prep', '2-llamacpp', '10-foo', '9-bar', '99-appendix', 'assets']) {
      await fs.mkdir(path.join(base, d), { recursive: true });
    }
    await writeFile(path.join(base, '3-notadir.md'), 'x');
    const chapters = await discoverChapters(base);
    assert.deepEqual(chapters, ['1-prep', '2-llamacpp', '9-bar', '10-foo', '99-appendix']);
  });
});

test('discoverChapters: 존재하지 않는 root → []', async () => {
  assert.deepEqual(await discoverChapters('/no/such/path/xyz'), []);
});

/* ─── listFilesRel ──────────────────────────────────────────────── */

test('listFilesRel: 재귀적으로 상대경로 수집', async () => {
  await withDirs(async ({ vault }) => {
    await writeFile(path.join(vault, 'index.md'), 'a');
    await writeFile(path.join(vault, 'primitives', 'p.md'), 'b');
    await writeFile(path.join(vault, 'assets', 'img.png'), 'c');
    const rels = (await listFilesRel(vault)).map((f) => f.rel).sort();
    assert.deepEqual(rels, ['assets/img.png', 'index.md', 'primitives/p.md']);
  });
});

test('listFilesRel: dotfile·dotdir 무시', async () => {
  await withDirs(async ({ vault }) => {
    await writeFile(path.join(vault, 'index.md'), 'a');
    await writeFile(path.join(vault, '.DS_Store'), 'x');
    await writeFile(path.join(vault, '.obsidian', 'config'), 'y');
    const rels = (await listFilesRel(vault)).map((f) => f.rel).sort();
    assert.deepEqual(rels, ['index.md']);
  });
});

test('listFilesRel: 존재하지 않는 root → []', async () => {
  assert.deepEqual(await listFilesRel('/no/such/path/xyz'), []);
});

/* ─── syncForward (vault → docs), 시리즈 중첩 ───────────────────── */

test('forward: 새 파일 복사 (series/chapter)', async () => {
  await withDirs(async ({ vault, docs }) => {
    await writeFile(path.join(vault, S, '1-prep', 'index.md'), 'hello');
    await syncForward({ vaultRoot: vault, docsRoot: docs });
    assert.equal(await readFile(path.join(docs, S, '1-prep', 'index.md')), 'hello');
  });
});

test('forward: 변경된 파일 덮어쓰기', async () => {
  await withDirs(async ({ vault, docs }) => {
    await writeFile(path.join(vault, S, '1-prep', 'index.md'), 'new');
    await writeFile(path.join(docs, S, '1-prep', 'index.md'), 'old');
    await syncForward({ vaultRoot: vault, docsRoot: docs });
    assert.equal(await readFile(path.join(docs, S, '1-prep', 'index.md')), 'new');
  });
});

test('forward: 동일 파일은 그대로 유지', async () => {
  await withDirs(async ({ vault, docs }) => {
    await writeFile(path.join(vault, S, '1-prep', 'index.md'), 'same');
    await writeFile(path.join(docs, S, '1-prep', 'index.md'), 'same');
    await syncForward({ vaultRoot: vault, docsRoot: docs });
    assert.equal(await readFile(path.join(docs, S, '1-prep', 'index.md')), 'same');
  });
});

test('forward: vault 에 없는 repo 파일은 삭제 (챕터 내)', async () => {
  await withDirs(async ({ vault, docs }) => {
    await writeFile(path.join(vault, S, '1-prep', 'index.md'), 'a');
    await writeFile(path.join(docs, S, '1-prep', 'index.md'), 'a');
    await writeFile(path.join(docs, S, '1-prep', 'orphan.md'), 'stale');
    await syncForward({ vaultRoot: vault, docsRoot: docs });
    assert.equal(await exists(path.join(docs, S, '1-prep', 'orphan.md')), false);
  });
});

test('forward: vault 에 없는 챕터 전체 제거 (orphan 챕터)', async () => {
  await withDirs(async ({ vault, docs }) => {
    await writeFile(path.join(vault, S, '1-prep', 'index.md'), 'a');
    await writeFile(path.join(docs, S, '1-prep', 'index.md'), 'a');
    await writeFile(path.join(docs, S, '5-gone', 'index.md'), 'dead');
    await syncForward({ vaultRoot: vault, docsRoot: docs });
    assert.equal(await exists(path.join(docs, S, '5-gone')), false);
    assert.equal(await exists(path.join(docs, S, '1-prep', 'index.md')), true);
  });
});

test('forward: vault 에 없는 시리즈는 기본 보호, --force 면 제거', async () => {
  await withDirs(async ({ vault, docs }) => {
    await writeFile(path.join(vault, S, '1-prep', 'index.md'), 'a');
    await writeFile(path.join(docs, S, '1-prep', 'index.md'), 'a');
    await writeFile(path.join(docs, 'old-series', '1-x', 'index.md'), 'dead');
    // 기본: 보호 — 통째 삭제 안 함 (iCloud 부분 동기화 방어)
    await syncForward({ vaultRoot: vault, docsRoot: docs });
    assert.equal(await exists(path.join(docs, 'old-series')), true);
    // --force: 의도한 삭제 → 제거
    await syncForward({ vaultRoot: vault, docsRoot: docs, force: true });
    assert.equal(await exists(path.join(docs, 'old-series')), false);
    assert.equal(await exists(path.join(docs, S, '1-prep', 'index.md')), true);
  });
});

test('forward: 다중 시리즈를 독립적으로 미러 (시리즈마다 1편 재시작)', async () => {
  await withDirs(async ({ vault, docs }) => {
    await writeFile(path.join(vault, 'local-llm-0-to-1', '1-prep', 'index.md'), 'llm');
    await writeFile(path.join(vault, 'pi-agent-0-to-1', '1-setup', 'index.md'), 'pi');
    await syncForward({ vaultRoot: vault, docsRoot: docs });
    assert.equal(await readFile(path.join(docs, 'local-llm-0-to-1', '1-prep', 'index.md')), 'llm');
    assert.equal(await readFile(path.join(docs, 'pi-agent-0-to-1', '1-setup', 'index.md')), 'pi');
  });
});

test('forward: 시리즈 안 ^\\d+- 아닌 폴더는 미러 안 함', async () => {
  await withDirs(async ({ vault, docs }) => {
    await writeFile(path.join(vault, S, '1-prep', 'index.md'), 'a');
    await writeFile(path.join(vault, S, 'templates', 't.md'), 'tpl');
    await syncForward({ vaultRoot: vault, docsRoot: docs });
    assert.equal(await exists(path.join(docs, S, 'templates')), false);
  });
});

test('forward: 빈 시리즈는 무시 (no-op)', async () => {
  await withDirs(async ({ vault, docs }) => {
    await fs.mkdir(path.join(vault, 'pi-agent-0-to-1'), { recursive: true });
    await syncForward({ vaultRoot: vault, docsRoot: docs });
    assert.deepEqual(await walk(docs), []);
  });
});

test('forward: dotfile 은 복사 안 함', async () => {
  await withDirs(async ({ vault, docs }) => {
    await writeFile(path.join(vault, S, '1-prep', 'index.md'), 'a');
    await writeFile(path.join(vault, S, '1-prep', '.DS_Store'), 'junk');
    await syncForward({ vaultRoot: vault, docsRoot: docs });
    assert.deepEqual(await walk(docs), [`${S}/1-prep/index.md`]);
  });
});

test('forward: vaultRoot 미설정이면 docs 손대지 않고 graceful skip', async () => {
  await withDirs(async ({ docs }) => {
    await writeFile(path.join(docs, S, '1-prep', 'index.md'), 'keep');
    await syncForward({ vaultRoot: undefined, docsRoot: docs });
    assert.equal(await readFile(path.join(docs, S, '1-prep', 'index.md')), 'keep');
  });
});

test('forward: vaultRoot 경로가 없으면 graceful skip', async () => {
  await withDirs(async ({ docs }) => {
    await writeFile(path.join(docs, S, '1-prep', 'index.md'), 'keep');
    await syncForward({ vaultRoot: '/no/such/vault/xyz', docsRoot: docs });
    assert.equal(await readFile(path.join(docs, S, '1-prep', 'index.md')), 'keep');
  });
});

test('forward: docsRoot 없으면 생성', async () => {
  await withDirs(async ({ vault, docs }) => {
    const nested = path.join(docs, 'deep', 'guide');
    await writeFile(path.join(vault, S, '1-prep', 'index.md'), 'a');
    await syncForward({ vaultRoot: vault, docsRoot: nested });
    assert.equal(await readFile(path.join(nested, S, '1-prep', 'index.md')), 'a');
  });
});

// 안전장치: vault 가 '존재하지만 비어있으면'(iCloud 부분 동기화 등) 기본은 보호.
// --force 일 때만 true mirror 로 비운다. (vault 미설정/경로없음 은 별도 graceful skip.)
test('forward: 존재하지만 비어있는 vault — 기본 보호(안 지움), --force 면 비움', async () => {
  await withDirs(async ({ vault, docs }) => {
    await writeFile(path.join(docs, S, '1-prep', 'index.md'), 'precious');
    // 기본: 빈 vault 라도 docs 보존
    await syncForward({ vaultRoot: vault, docsRoot: docs });
    assert.equal(await exists(path.join(docs, S)), true);
    assert.equal(await readFile(path.join(docs, S, '1-prep', 'index.md')), 'precious');
    // --force: true mirror 로 비움
    await syncForward({ vaultRoot: vault, docsRoot: docs, force: true });
    assert.equal(await exists(path.join(docs, S)), false);
  });
});

/* ─── syncReverse (docs → vault, autoYes) ───────────────────────── */

test('reverse: 변경된 파일 docs → vault 적용', async () => {
  await withDirs(async ({ vault, docs }) => {
    await writeFile(path.join(vault, S, '1-prep', 'index.md'), 'old');
    await writeFile(path.join(docs, S, '1-prep', 'index.md'), 'edited-in-repo');
    await syncReverse({ vaultRoot: vault, docsRoot: docs, autoYes: true, showDiffs: false });
    assert.equal(await readFile(path.join(vault, S, '1-prep', 'index.md')), 'edited-in-repo');
  });
});

test('reverse: docs 에만 있는 파일을 vault 에 생성 (새 챕터)', async () => {
  await withDirs(async ({ vault, docs }) => {
    await writeFile(path.join(docs, S, '7-new', 'index.md'), 'brand new');
    await syncReverse({ vaultRoot: vault, docsRoot: docs, autoYes: true, showDiffs: false });
    assert.equal(await readFile(path.join(vault, S, '7-new', 'index.md')), 'brand new');
  });
});

test('reverse: docs 에만 있는 시리즈를 vault 에 생성', async () => {
  await withDirs(async ({ vault, docs }) => {
    await writeFile(path.join(docs, 'pi-agent-0-to-1', '1-setup', 'index.md'), 'pi');
    await syncReverse({ vaultRoot: vault, docsRoot: docs, autoYes: true, showDiffs: false });
    assert.equal(await readFile(path.join(vault, 'pi-agent-0-to-1', '1-setup', 'index.md')), 'pi');
  });
});

test('reverse: vault 에만 있는 파일을 vault 에서 삭제', async () => {
  await withDirs(async ({ vault, docs }) => {
    await writeFile(path.join(vault, S, '1-prep', 'index.md'), 'a');
    await writeFile(path.join(docs, S, '1-prep', 'index.md'), 'a');
    await writeFile(path.join(vault, S, '1-prep', 'extra.md'), 'only-in-vault');
    await syncReverse({ vaultRoot: vault, docsRoot: docs, autoYes: true, showDiffs: false });
    assert.equal(await exists(path.join(vault, S, '1-prep', 'extra.md')), false);
  });
});

test('reverse: 동일 파일은 건드리지 않음', async () => {
  await withDirs(async ({ vault, docs }) => {
    await writeFile(path.join(vault, S, '1-prep', 'index.md'), 'same');
    await writeFile(path.join(docs, S, '1-prep', 'index.md'), 'same');
    await syncReverse({ vaultRoot: vault, docsRoot: docs, autoYes: true, showDiffs: false });
    assert.equal(await readFile(path.join(vault, S, '1-prep', 'index.md')), 'same');
  });
});

/* ─── 대화형 승인 경로 (rl 주입) ────────────────────────────────
 * autoYes:false 일 때 y/n/a/q 파싱 + applyRest 전파 + quit 가 시리즈 루프를
 * 끊는지 검증. 실제 stdin 대신 스크립트된 fakeRl 을 주입한다.
 */
function fakeRl(answers) {
  const queue = [...answers];
  return { question: async () => (queue.length ? queue.shift() : 'n'), close() {} };
}

test('reverse(interactive): n 응답이면 적용 안 함', async () => {
  await withDirs(async ({ vault, docs }) => {
    await writeFile(path.join(vault, S, '1-prep', 'index.md'), 'old');
    await writeFile(path.join(docs, S, '1-prep', 'index.md'), 'new');
    await syncReverse({ vaultRoot: vault, docsRoot: docs, autoYes: false, showDiffs: false, rl: fakeRl(['n']) });
    assert.equal(await readFile(path.join(vault, S, '1-prep', 'index.md')), 'old');
  });
});

test('reverse(interactive): y 응답이면 적용', async () => {
  await withDirs(async ({ vault, docs }) => {
    await writeFile(path.join(vault, S, '1-prep', 'index.md'), 'old');
    await writeFile(path.join(docs, S, '1-prep', 'index.md'), 'new');
    await syncReverse({ vaultRoot: vault, docsRoot: docs, autoYes: false, showDiffs: false, rl: fakeRl(['y']) });
    assert.equal(await readFile(path.join(vault, S, '1-prep', 'index.md')), 'new');
  });
});

test('reverse(interactive): a(all remaining) 는 이후 전부 자동 적용 (다음 챕터 포함)', async () => {
  await withDirs(async ({ vault, docs }) => {
    await writeFile(path.join(vault, S, '1-prep', 'index.md'), 'old1');
    await writeFile(path.join(docs, S, '1-prep', 'index.md'), 'new1');
    await writeFile(path.join(vault, S, '2-next', 'index.md'), 'old2');
    await writeFile(path.join(docs, S, '2-next', 'index.md'), 'new2');
    // 첫 프롬프트에서 'a' → applyRest 켜짐 → 둘째는 질문 없이 적용
    await syncReverse({ vaultRoot: vault, docsRoot: docs, autoYes: false, showDiffs: false, rl: fakeRl(['a']) });
    assert.equal(await readFile(path.join(vault, S, '1-prep', 'index.md')), 'new1');
    assert.equal(await readFile(path.join(vault, S, '2-next', 'index.md')), 'new2');
  });
});

test('reverse(interactive): q(quit) 는 즉시 중단 — 이후 파일 미적용', async () => {
  await withDirs(async ({ vault, docs }) => {
    await writeFile(path.join(vault, S, '1-prep', 'index.md'), 'old1');
    await writeFile(path.join(docs, S, '1-prep', 'index.md'), 'new1');
    await writeFile(path.join(vault, S, '2-next', 'index.md'), 'old2');
    await writeFile(path.join(docs, S, '2-next', 'index.md'), 'new2');
    await syncReverse({ vaultRoot: vault, docsRoot: docs, autoYes: false, showDiffs: false, rl: fakeRl(['q']) });
    // 첫 파일에서 quit → 아무것도 적용 안 됨
    assert.equal(await readFile(path.join(vault, S, '1-prep', 'index.md')), 'old1');
    assert.equal(await readFile(path.join(vault, S, '2-next', 'index.md')), 'old2');
  });
});

/* ─── 왕복 불변식 (round-trip) ──────────────────────────────────── */

test('round-trip: forward 후 양쪽 트리가 동일 (다중 시리즈)', async () => {
  await withDirs(async ({ vault, docs }) => {
    await writeFile(path.join(vault, 'local-llm-0-to-1', '1-prep', 'index.md'), 'a');
    await writeFile(path.join(vault, 'local-llm-0-to-1', '1-prep', 'primitives', 'p.md'), 'b');
    await writeFile(path.join(vault, 'local-llm-0-to-1', '2-next', 'index.md'), 'c');
    await writeFile(path.join(vault, 'pi-agent-0-to-1', '1-setup', 'index.md'), 'd');
    await syncForward({ vaultRoot: vault, docsRoot: docs });
    assert.deepEqual(await walk(docs), await walk(vault));
  });
});

test('round-trip: forward → reverse 는 항등 (순 변화 없음)', async () => {
  await withDirs(async ({ vault, docs }) => {
    await writeFile(path.join(vault, S, '1-prep', 'index.md'), 'a');
    await writeFile(path.join(vault, S, '2-next', 'index.md'), 'c');
    await syncForward({ vaultRoot: vault, docsRoot: docs });
    const before = await walk(vault);
    await syncReverse({ vaultRoot: vault, docsRoot: docs, autoYes: true, showDiffs: false });
    assert.deepEqual(await walk(vault), before);
    assert.equal(await readFile(path.join(vault, S, '1-prep', 'index.md')), 'a');
  });
});
