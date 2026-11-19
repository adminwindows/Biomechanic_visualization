import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const registryBranch = 'gh-pages';
const metadataPrefix = '.preview-meta/';
const maximumBytes = 25 * 1024 * 1024;

export function validateFiles(files) {
  if (!files.some(file => file.path === 'index.html') || !files.some(file => file.path === 'sw.js')) {
    throw new Error('Preview artifact must contain index.html and sw.js.');
  }
  if (files.length > 1000 || files.reduce((sum, file) => sum + file.content.length, 0) > maximumBytes) {
    throw new Error('Preview artifact exceeds the 1,000-file / 25 MiB limit.');
  }
  for (const file of files) {
    if (!file.path || file.path.startsWith('/') || file.path.includes('\\') ||
        file.path.split('/').some(part => !part || part === '.' || part === '..' || part.startsWith('.')) ||
        /[\x00-\x1f\x7f]/.test(file.path)) {
      throw new Error(`Invalid public artifact path: ${JSON.stringify(file.path)}`);
    }
  }
  return files;
}

async function readFiles(root, relative = '') {
  const files = [];
  for (const entry of await readdir(path.join(root, relative), { withFileTypes: true })) {
    const name = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) throw new Error(`Symbolic links are forbidden: ${name}`);
    if (entry.isDirectory()) files.push(...await readFiles(root, name));
    else if (entry.isFile()) files.push({ path: name, content: await readFile(path.join(root, name)) });
    else throw new Error(`Unsupported artifact entry: ${name}`);
  }
  return files;
}

function parseNumber(value) {
  if (!/^[1-9]\d*$/.test(String(value))) throw new Error('Invalid pull-request number.');
  return Number(value);
}

function parseSha(value) {
  if (!/^[0-9a-f]{40}$/.test(value)) throw new Error('Invalid source commit SHA.');
  return value;
}

export function currentPreview(pr, repository, expectedHead, expectedBase) {
  return (!expectedBase || pr.base.sha === expectedBase) && pr.state === 'open' && pr.head.repo?.full_name === repository && pr.head.sha === expectedHead;
}

async function registry(github, owner, repo) {
  let ref;
  try {
    ref = (await github.rest.git.getRef({ owner, repo, ref: `heads/${registryBranch}` })).data;
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
  const commit = (await github.rest.git.getCommit({ owner, repo, commit_sha: ref.object.sha })).data;
  const tree = (await github.rest.git.getTree({ owner, repo, tree_sha: commit.tree.sha, recursive: '1' })).data;
  if (tree.truncated) throw new Error('Preview registry is too large to process safely.');
  return { sha: ref.object.sha, treeSha: commit.tree.sha, entries: tree.tree };
}

async function blob(github, owner, repo, content) {
  return (await github.rest.git.createBlob({ owner, repo, content: content.toString('base64'), encoding: 'base64' })).data.sha;
}

// This job updates only the registry, before the globally serialized Pages job.
// A canceled pending Pages job cannot lose another PR's registered build.
export async function updateRegistry({ github, context, core, artifactRoot }) {
  core.setOutput('publish', 'false');
  const { owner, repo } = context.repo;
  const repository = `${owner}/${repo}`;
  const number = parseNumber(context.payload.pull_request.number);
  const head = parseSha(context.payload.pull_request.head.sha);
  const remove = context.payload.action === 'closed';
  const tested = remove ? null : parseSha(process.env.TESTED_SHA);
  const base = remove ? null : parseSha(context.payload.pull_request.base.sha);
  const prefix = `pr-${number}/`;
  const metadataPath = `${metadataPrefix}pr-${number}.json`;
  const pull = async () => (await github.rest.pulls.get({ owner, repo, pull_number: number })).data;
  const eligible = pr => remove ? pr.state === 'closed' : currentPreview(pr, repository, head, base);
  if (!eligible(await pull())) {
    core.notice('Skipping obsolete workflow: the PR state or source head has changed.');
    core.setOutput('changed', 'false');
    return;
  }

  const additions = [];
  if (!remove) {
    const files = validateFiles(await readFiles(artifactRoot));
    // Limit simultaneous API requests; the artifact is treated only as data.
    for (let start = 0; start < files.length; start += 4) {
      additions.push(...await Promise.all(files.slice(start, start + 4).map(async file => ({
        path: prefix + file.path, mode: '100644', type: 'blob', sha: await blob(github, owner, repo, file.content),
      }))));
    }
    const metadata = { number, head, base, tested, run: String(context.runId), updated: new Date().toISOString() };
    additions.push({ path: metadataPath, mode: '100644', type: 'blob',
      sha: await blob(github, owner, repo, Buffer.from(JSON.stringify(metadata, null, 2) + '\n')) });
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const previous = await registry(github, owner, repo);
    if (!eligible(await pull())) {
      core.notice('Skipping obsolete workflow: the PR changed before the registry update.');
      core.setOutput('changed', 'false');
      return;
    }
    const oldEntries = previous?.entries.filter(entry => entry.type === 'blob' &&
      (entry.path.startsWith(prefix) || entry.path === metadataPath)) ?? [];
    if (remove && oldEntries.length === 0) {
      // Re-publish even after an earlier cleanup was canceled after registration.
      core.setOutput('publish', 'true');
      core.setOutput('changed', 'false');
      return;
    }
    const addedPaths = new Set(additions.map(entry => entry.path));
    const deletions = oldEntries.filter(entry => !addedPaths.has(entry.path))
      .map(entry => ({ path: entry.path, mode: '100644', type: 'blob', sha: null }));
    const tree = (await github.rest.git.createTree({ owner, repo,
      ...(previous ? { base_tree: previous.treeSha } : {}), tree: [...deletions, ...additions] })).data;
    const commit = (await github.rest.git.createCommit({ owner, repo, tree: tree.sha,
      parents: previous ? [previous.sha] : [],
      message: `${remove ? 'Remove' : 'Update'} public preview for PR #${number}${remove ? '' : ` (${head.slice(0, 12)})`}` })).data;
    try {
      if (previous) await github.rest.git.updateRef({ owner, repo, ref: `heads/${registryBranch}`, sha: commit.sha, force: false });
      else await github.rest.git.createRef({ owner, repo, ref: `refs/heads/${registryBranch}`, sha: commit.sha });
      core.setOutput('publish', 'true');
      core.setOutput('changed', 'true');
      core.setOutput('registry_sha', commit.sha);
      return;
    } catch (error) {
      // Non-fast-forward means another PR registered its build. Re-read its tree.
      if (![409, 422].includes(error.status) || attempt === 4) throw error;
      core.info('Another preview updated the registry; retrying against its latest tree.');
    }
  }
}

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

export function renderIndex(previews, repository) {
  const items = previews.map(preview => `<li><a href="./pr-${preview.number}/">Open PR #${preview.number}</a>
    <p>Source <code>${escapeHtml(preview.head.slice(0, 12))}</code> · checked merge <code>${escapeHtml(preview.tested.slice(0, 12))}</code>
    · <a href="https://github.com/${repository}/actions/runs/${preview.run}">Build and checks</a></p></li>`).join('\n');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Biomechanics · Pull request previews</title>
<style>body{font:17px/1.6 system-ui,sans-serif;max-width:780px;margin:8vh auto;padding:24px;color:#24312d;background:#f4f3ed}h1{line-height:1.15;font-size:2.3rem}a{color:#16604b}li{margin:24px 0;padding:20px;background:#fff;border:1px solid #d9ded7;border-radius:12px}ul{padding:0;list-style:none}code{font-size:.85em}p{color:#56625b}</style></head>
<body><p>EXERCISE BIOMECHANICS LAB</p><h1>Pull request previews</h1><p>Public builds of current, checked pull requests. These are working previews; numerical checks do not establish anatomical or clinical validity.</p><ul>${items || '<li>No current checked pull request previews are available.</li>'}</ul><p><a href="https://github.com/${repository}/pulls">Review the source on GitHub</a></p></body></html>\n`;
}

// Assemble from the latest registry *inside* the global deployment lock. Closed
// or superseded PR builds are omitted even if their cleanup event did not run.
export async function prepareSite({ github, context, core, outputRoot }) {
  const { owner, repo } = context.repo;
  const repository = `${owner}/${repo}`;
  const state = await registry(github, owner, repo);
  const previews = [];
  await mkdir(outputRoot, { recursive: true });
  for (const entry of state?.entries ?? []) {
    const match = /^\.preview-meta\/pr-([1-9]\d*)\.json$/.exec(entry.path);
    if (!match || entry.type !== 'blob') continue;
    const number = parseNumber(match[1]);
    const data = (await github.rest.git.getBlob({ owner, repo, file_sha: entry.sha })).data;
    const metadata = JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
    if (metadata.number !== number || !/^\d+$/.test(metadata.run)) throw new Error('Invalid preview metadata.');
    parseSha(metadata.head); parseSha(metadata.base); parseSha(metadata.tested);
    const pr = (await github.rest.pulls.get({ owner, repo, pull_number: number })).data;
    if (!currentPreview(pr, repository, metadata.head, metadata.base)) continue;
    const prefix = `pr-${number}/`;
    const files = [];
    for (const file of state.entries.filter(item => item.type === 'blob' && item.path.startsWith(prefix))) {
      if (file.mode !== '100644') throw new Error('Preview registry contains a non-regular file.');
      const content = (await github.rest.git.getBlob({ owner, repo, file_sha: file.sha })).data;
      files.push({ path: file.path.slice(prefix.length), content: Buffer.from(content.content, 'base64') });
    }
    validateFiles(files);
    // Check once more after fetching the files, before including this build.
    if (!currentPreview((await github.rest.pulls.get({ owner, repo, pull_number: number })).data, repository, metadata.head, metadata.base)) continue;
    for (const file of files) {
      const destination = path.join(outputRoot, prefix, file.path);
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, file.content);
    }
    previews.push(metadata);
  }
  previews.sort((a, b) => a.number - b.number);
  await writeFile(path.join(outputRoot, 'index.html'), renderIndex(previews, repository));
  await writeFile(path.join(outputRoot, '.nojekyll'), '');
  await writeFile(path.join(outputRoot, 'previews.json'), JSON.stringify({ registry: state?.sha ?? 'empty', previews }, null, 2) + '\n');
  const requested = context.payload.pull_request?.number;
  core.setOutput('preview_path', requested && previews.some(preview => preview.number === requested) ? `pr-${requested}/` : '');
  core.setOutput('count', String(previews.length));
  core.setOutput('registry_sha', state?.sha ?? 'empty');
  await core.summary.addHeading('Public preview contents').addRaw(`Registry commit: \`${state?.sha ?? 'empty'}\`\n\n`)
    .addTable([['Pull request', 'Source head', 'Tested merge'], ...previews.map(preview => [`#${preview.number}`, preview.head, preview.tested])]).write();
}
