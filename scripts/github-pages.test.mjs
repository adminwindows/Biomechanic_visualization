import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { currentPreview, escapeHtml, renderIndex, validateFiles, updateRegistry, prepareSite } from './github-pages.mjs';

const head = 'a'.repeat(40);
const base = 'b'.repeat(40);
const tested = 'c'.repeat(40);
const goodFiles = () => [{ path: 'index.html', content: Buffer.from('<html>Preview</html>') }, { path: 'sw.js', content: Buffer.from('// worker') }];
const pull = (number = 1) => ({ number, state: 'open', head: { sha: head, repo: { full_name: 'owner/repo' } }, base: { sha: base } });

function fakeGitHub() {
  let id = 0;
  const blobs = new Map();
  const trees = new Map();
  const commits = new Map();
  let ref;
  let injectConflict = false;
  const pulls = new Map([[1, pull(1)], [2, pull(2)]]);
  const git = {
    async getRef() { if (!ref) throw { status: 404 }; return { data: { object: { sha: ref } } }; },
    async getCommit({ commit_sha }) { return { data: commits.get(commit_sha) }; },
    async getTree({ tree_sha }) { return { data: { tree: trees.get(tree_sha), truncated: false } }; },
    async getBlob({ file_sha }) { return { data: { content: blobs.get(file_sha), encoding: 'base64' } }; },
    async createBlob({ content }) { const sha = `blob-${++id}`; blobs.set(sha, content); return { data: { sha } }; },
    async createTree({ base_tree, tree }) {
      const entries = new Map((trees.get(base_tree) ?? []).map(entry => [entry.path, entry]));
      for (const entry of tree) if (entry.sha === null) entries.delete(entry.path); else entries.set(entry.path, entry);
      const sha = `tree-${++id}`; trees.set(sha, [...entries.values()]); return { data: { sha } };
    },
    async createCommit({ tree, parents }) { const sha = `commit-${++id}`; commits.set(sha, { tree: { sha: tree }, parents }); return { data: { sha } }; },
    async createRef({ sha }) { if (ref) throw { status: 422 }; ref = sha; },
    async updateRef({ sha, force }) {
      assert.equal(force, false);
      if (injectConflict) {
        injectConflict = false;
        const oldTree = commits.get(ref).tree.sha;
        const newTree = await git.createTree({ base_tree: oldTree, tree: [{ path: 'pr-99/concurrent.txt', type: 'blob', mode: '100644', sha: 'concurrent-blob' }] });
        const concurrent = await git.createCommit({ tree: newTree.data.sha, parents: [ref] });
        ref = concurrent.data.sha;
        throw { status: 422 };
      }
      if (commits.get(sha).parents[0] !== ref) throw { status: 422 };
      ref = sha;
    },
  };
  const outputs = new Map();
  const summary = { addHeading() { return this; }, addRaw() { return this; }, addTable() { return this; }, async write() {} };
  return { github: { rest: { git, pulls: { async get({ pull_number }) { return { data: structuredClone(pulls.get(pull_number)) }; } } } },
    core: { setOutput(key, value) { outputs.set(key, value); }, notice() {}, info() {}, summary }, outputs, pulls,
    context(number = 1, action = 'synchronize') { return { repo: { owner: 'owner', repo: 'repo' }, runId: 1234, payload: { action, pull_request: structuredClone(pulls.get(number)) } }; },
    entries() { return trees.get(commits.get(ref)?.tree.sha) ?? []; },
    conflict() { injectConflict = true; },
  };
}

async function temporary(testContext) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'pages-publisher-test-'));
  testContext.after(() => rm(directory, { recursive: true, force: true }));
  const artifact = path.join(directory, 'artifact');
  await mkdir(artifact);
  for (const file of goodFiles()) await writeFile(path.join(artifact, file.path), file.content);
  return { directory, artifact };
}

test('artifact validation rejects traversal, hidden files, missing build files and oversized payloads', () => {
  assert.equal(validateFiles(goodFiles()).length, 2);
  for (const name of ['../escape', '/absolute', 'a/../../escape', '.env', 'assets/.secret', 'a\\b', 'a//b', 'a\nb']) {
    assert.throws(() => validateFiles([...goodFiles(), { path: name, content: Buffer.from('bad') }]), /Invalid public artifact path/);
  }
  assert.throws(() => validateFiles([]), /index.html and sw.js/);
  assert.throws(() => validateFiles([...goodFiles(), { path: 'huge', content: Buffer.alloc(26 * 1024 * 1024) }]), /25 MiB/);
});

test('preview freshness requires an open same-repository PR with matching head and base', () => {
  assert.equal(currentPreview(pull(), 'owner/repo', head, base), true);
  assert.equal(currentPreview({ ...pull(), state: 'closed' }, 'owner/repo', head, base), false);
  assert.equal(currentPreview(pull(), 'fork/repo', head, base), false);
  assert.equal(currentPreview(pull(), 'owner/repo', tested, base), false);
  assert.equal(currentPreview(pull(), 'owner/repo', head, tested), false);
});

test('public index escapes strings and records source and tested merge separately', () => {
  assert.equal(escapeHtml('<script>"&\''), '&lt;script&gt;&quot;&amp;&#39;');
  const html = renderIndex([{ number: 1, head, tested, run: '1234' }], 'owner/repo');
  assert.match(html, /\.\/pr-1\//);
  assert.match(html, /aaaaaaaaaaaa/);
  assert.match(html, /cccccccccccc/);
  assert.match(html, /actions\/runs\/1234/);
});

test('registration preserves other PRs, retries a concurrent update, and removes only the closed PR', async t => {
  const { artifact } = await temporary(t);
  const fake = fakeGitHub();
  process.env.TESTED_SHA = tested;
  await updateRegistry({ ...fake, context: fake.context(), artifactRoot: artifact });
  await updateRegistry({ ...fake, context: fake.context(2), artifactRoot: artifact });
  fake.conflict();
  await updateRegistry({ ...fake, context: fake.context(), artifactRoot: artifact });
  assert.ok(fake.entries().some(entry => entry.path === 'pr-99/concurrent.txt'));
  assert.ok(fake.entries().some(entry => entry.path === 'pr-2/index.html'));
  fake.pulls.get(1).state = 'closed';
  await updateRegistry({ ...fake, context: fake.context(1, 'closed'), artifactRoot: artifact });
  assert.equal(fake.entries().some(entry => entry.path.startsWith('pr-1/') || entry.path === '.preview-meta/pr-1.json'), false);
  assert.ok(fake.entries().some(entry => entry.path === 'pr-2/index.html'));
  await updateRegistry({ ...fake, context: fake.context(1, 'closed'), artifactRoot: artifact });
  assert.equal(fake.outputs.get('changed'), 'false');
  assert.equal(fake.outputs.get('publish'), 'true');
});

test('an obsolete build cannot replace the registry', async t => {
  const { artifact } = await temporary(t);
  const fake = fakeGitHub();
  const oldContext = fake.context();
  fake.pulls.get(1).head.sha = 'd'.repeat(40);
  process.env.TESTED_SHA = tested;
  await updateRegistry({ ...fake, context: oldContext, artifactRoot: artifact });
  assert.equal(fake.outputs.get('changed'), 'false');
  assert.equal(fake.entries().length, 0);
});

test('publication includes current previews, excludes closed/stale ones, and records provenance', async t => {
  const { directory, artifact } = await temporary(t);
  const fake = fakeGitHub();
  process.env.TESTED_SHA = tested;
  await updateRegistry({ ...fake, context: fake.context(), artifactRoot: artifact });
  await updateRegistry({ ...fake, context: fake.context(2), artifactRoot: artifact });
  fake.pulls.get(2).state = 'closed';
  const outputRoot = path.join(directory, 'site');
  await prepareSite({ ...fake, context: fake.context(), outputRoot });
  assert.equal(await readFile(path.join(outputRoot, 'pr-1/index.html'), 'utf8'), '<html>Preview</html>');
  await assert.rejects(readFile(path.join(outputRoot, 'pr-2/index.html')));
  const metadata = JSON.parse(await readFile(path.join(outputRoot, 'previews.json'), 'utf8'));
  assert.deepEqual(metadata.previews.map(preview => [preview.number, preview.head, preview.base, preview.tested]), [[1, head, base, tested]]);
  assert.equal(fake.outputs.get('preview_path'), 'pr-1/');
  fake.pulls.get(1).base.sha = 'd'.repeat(40);
  const staleRoot = path.join(directory, 'stale-site');
  await prepareSite({ ...fake, context: fake.context(), outputRoot: staleRoot });
  assert.equal(fake.outputs.get('count'), '0');
  assert.equal(fake.outputs.get('preview_path'), '');
});
