/**
 * markdown-obsidian.test.mjs — Obsidian 위키링크 플러그인 단위 테스트.
 *
 *   node --test docs/.vitepress/markdown-obsidian.test.mjs   (또는 pnpm test)
 *
 * 다중 시리즈(<series>/<chapter>) 하에서:
 *   - chapterRelFromEnv 가 `series/chapter` 두 세그먼트를 뽑는지
 *   - buildPrimitiveIndex 가 2단계로 훑고 동명 충돌 시 후보를 모두 모으는지
 *   - transform 의 크로스챕터 링크(2a)·primitive 매핑(2b, 같은 시리즈 우선)·
 *     임베드·보안 게이트가 맞는지
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  buildPrimitiveIndex,
  chapterRelFromEnv,
  transform,
} from './markdown-obsidian.mjs';

console.log = () => {};

async function mkTmp() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'mdobs-'));
}
async function writeFile(abs, content) {
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, content);
}
async function withTmp(fn) {
  const root = await mkTmp();
  try { return await fn(root); }
  finally { await fs.rm(root, { recursive: true, force: true }).catch(() => {}); }
}

/* ─── chapterRelFromEnv ─────────────────────────────────────────── */

test('chapterRelFromEnv: series/chapter 두 세그먼트 추출', () => {
  const root = '/x/guide';
  const env = { path: '/x/guide/local-llm-0-to-1/1-prep/index.md' };
  assert.equal(chapterRelFromEnv(env, root), 'local-llm-0-to-1/1-prep');
});

test('chapterRelFromEnv: 세그먼트 2개 미만이면 null', () => {
  const root = '/x/guide';
  assert.equal(chapterRelFromEnv({ path: '/x/guide/loose.md' }, root), null);
  assert.equal(chapterRelFromEnv(null, root), null);
  assert.equal(chapterRelFromEnv({}, root), null);
});

/* ─── buildPrimitiveIndex ───────────────────────────────────────── */

test('buildPrimitiveIndex: 2단계 스캔 + 동명 충돌은 후보 모두 수집 (사전순)', async () => {
  await withTmp(async (root) => {
    await writeFile(path.join(root, 'local-llm-0-to-1', '1-prep', 'primitives', 'foo.md'), 'a');
    await writeFile(path.join(root, 'local-llm-0-to-1', '1-prep', 'primitives', 'shared.md'), 'b');
    await writeFile(path.join(root, 'pi-agent-0-to-1', '1-setup', 'primitives', 'shared.md'), 'c');

    const warnings = [];
    const orig = console.warn;
    console.warn = (m) => warnings.push(m);
    let index;
    try { index = buildPrimitiveIndex(root); } finally { console.warn = orig; }

    assert.deepEqual(index.get('foo'), ['local-llm-0-to-1/1-prep']);
    assert.deepEqual(index.get('shared'), ['local-llm-0-to-1/1-prep', 'pi-agent-0-to-1/1-setup']);
    assert.equal(warnings.length, 1); // 'shared' 충돌 1건만 경고
    assert.match(warnings[0], /shared/);
  });
});

/* ─── transform: 2a 크로스 챕터 링크 ────────────────────────────── */

test('transform 2a: [[N-folder/index]] 는 현재 시리즈를 prefix 로 붙임', () => {
  const out = transform('[[2-llamacpp/index|다음 편]]', {
    chapterRel: 'local-llm-0-to-1/1-prep',
    contentRoot: '/x/guide',
    primitiveIndex: new Map(),
  });
  assert.match(out, /\[다음 편\]\(\/guide\/local-llm-0-to-1\/2-llamacpp\/\)/);
});

/* ─── transform: 2b primitive 매핑, 같은 시리즈 우선 ────────────── */

test('transform 2b: 동명 primitive 는 같은 시리즈 후보를 우선 선택', () => {
  const primitiveIndex = new Map([
    ['shared', ['local-llm-0-to-1/1-prep', 'pi-agent-0-to-1/1-setup']],
  ]);
  // 현재 페이지가 pi-agent 시리즈면 → pi-agent 후보로 해석 (local-llm 아님)
  const out = transform('[[shared]]', {
    chapterRel: 'pi-agent-0-to-1/2-other',
    contentRoot: '/x/guide',
    primitiveIndex,
  });
  assert.match(out, /\(\/guide\/pi-agent-0-to-1\/1-setup\/#shared\)/);
  assert.doesNotMatch(out, /local-llm/);
});

test('transform 2b: 같은 챕터면 anchor 만', () => {
  const primitiveIndex = new Map([['foo', ['local-llm-0-to-1/1-prep']]]);
  const out = transform('[[foo]]', {
    chapterRel: 'local-llm-0-to-1/1-prep',
    contentRoot: '/x/guide',
    primitiveIndex,
  });
  assert.match(out, /\[foo\]\(#foo\)/);
});

/* ─── transform: 임베드 + 보안 ──────────────────────────────────── */

test('transform: 이미지 임베드는 ./assets/ 상대경로', () => {
  const out = transform('![[diagram.png]]', {
    chapterRel: 'local-llm-0-to-1/1-prep',
    contentRoot: '/x/guide',
    primitiveIndex: new Map(),
  });
  assert.match(out, /!\[\]\(\.\/assets\/diagram\.png\)/);
});

test('transform: primitive 인라인 임베드는 중첩 경로에서 해석', async () => {
  await withTmp(async (root) => {
    await writeFile(
      path.join(root, 'local-llm-0-to-1', '1-prep', 'primitives', 'foo.md'),
      '# 제목\n\n## 소제목\n\n본문 텍스트.\n',
    );
    const out = transform('![[foo]]', {
      chapterRel: 'local-llm-0-to-1/1-prep',
      contentRoot: root,
      primitiveIndex: new Map(),
    });
    assert.match(out, /<span id="foo"><\/span>/);
    assert.match(out, /본문 텍스트/);
    assert.match(out, /### 소제목/);     // H2 → H3 강등
    assert.doesNotMatch(out, /# 제목/);  // leading H1 제거
  });
});

test('transform: 위험한 임베드 이름(../traversal)은 거부, 파일 안 읽음', () => {
  const out = transform('![[../secret]]', {
    chapterRel: 'local-llm-0-to-1/1-prep',
    contentRoot: '/x/guide',
    primitiveIndex: new Map(),
  });
  assert.match(out, /위험한 임베드/);
});
