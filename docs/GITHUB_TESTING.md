# Testing changes through GitHub

GitHub Actions is the automation service: it starts a temporary computer when code is pushed, installs the project's locked dependencies, builds the app and runs its checks. GitHub Pages is the website host: it serves the resulting HTML, JavaScript and assets after the temporary computer stops. Testers open a link; they do not need to clone the repository or install anything.

The owner selected **public GitHub Pages previews** on 10 November 2026, matching the repository's public visibility. Anyone with the URL can open these previews without a GitHub or ChatGPT account. The existing [private ChatGPT Site](https://exercise-biomechanics-lab-charles.charlestahan93.chatgpt.site) retains its existing audience.

## One-time repository setup

1. Open [Settings → Pages](https://github.com/adminwindows/Biomechanic_visualization/settings/pages). Under **Build and deployment**, set **Source** to **GitHub Actions**.
2. In [Settings → Environments](https://github.com/adminwindows/Biomechanic_visualization/settings/environments), open the `github-pages` environment if GitHub created it. Set **Deployment branches and tags** to **No restriction**, so PR merge refs can deploy. The workflow itself restricts preview publication to PRs whose source branch belongs to this repository. A required reviewer would make every publication wait for approval.
3. Open the PR's **Checks** tab and its **Application checks** run. After saving these settings, use **Re-run failed jobs** if the publishing job failed during setup.

The workflow uses GitHub's automatic, temporary `GITHUB_TOKEN` and Pages identity token. No personal access token, AI key, hosting subscription or application backend is required. Initial Pages enablement is a repository administration setting; the ordinary workflow token cannot enable it for the first time. If repository policy prevents the requested write/deployment permissions, the repository administrator must allow them.

Once the workflow is merged into `main`, **Actions → Application checks → Run workflow** also permits manual republishing/reconciliation. A workflow file present only on a PR can run for that PR, but GitHub's manual-run interface requires it on the default branch.

## What happens on a PR update

1. **Check:** run numerical/persistence tests, compile TypeScript, build production assets, and exercise desktop, phone, landscape and production offline/update workflows. Test fixtures must leave the original production build unchanged.
2. **Build the preview:** after checks pass, build again for that PR's path, such as `/Biomechanic_visualization/pr-1/`. Test that exact artifact under a strict static server, including assets, examples, lazy workspaces, offline operation, and isolation from other previews on the same origin.
3. **Register:** retain the successful static build and its source/tested revision metadata on the generated `gh-pages` branch. Updates preserve the other PR directories and retry concurrent registry changes.
4. **Publish:** a globally serialized Pages job assembles the current registered previews, excludes closed PRs and builds whose source or base revision has changed and deploys the complete site using GitHub's official Pages actions. It publishes the deployment link after success.

The preview index is intended to live at:

`https://adminwindows.github.io/Biomechanic_visualization/`

PR #1's preview is intended to live at:

`https://adminwindows.github.io/Biomechanic_visualization/pr-1/`

These addresses are usable only after Pages is enabled and a deployment succeeds. The workflow's successful deployment and environment link are the authority for whether a particular revision is live. The index identifies each included source head, checked merge revision and workflow run.

The same PR keeps the same URL when new code passes and deploys. A failed check does not publish that revision; the existing live build may remain until a subsequent successful publication. Read the index/checks to identify what is actually served. A target-branch change invalidates older merge-based previews during the next publication; update the PR branch (for example, GitHub’s **Update branch**) to trigger a new build against the current base. Re-running an old event retains its old base metadata and does not refresh that preview. The app's offline update prompt can require applying the new build after finishing or exporting unsaved edits.

Closing a same-repository PR triggers registry removal and publication. Every publication also checks current PR state and omits closed or superseded entries, so a later run reconciles missed cleanup. This removes the preview from the current website; generated Git history, retained artifacts and a tester's already downloaded offline copy are not erased. Publication is serialized separately from registry updates so GitHub replacing a pending deployment job does not lose another PR's newly registered build.

## Checks, downloads and permissions

Open a PR's **Checks** tab for progress and failures, or the linked Actions run for logs, summaries, the production artifact and failure traces. Artifacts are retained for seven days. An artifact is a download of files, not a clickable running website. Human feedback should use the successful Pages deployment link.

PR checks use GitHub's temporary merge revision, which combines the proposed change with its target branch at check time. It is distinct from the PR source head; both are recorded. Updating a PR does not merge it into `main`.

The verification job has repository read access. Registration has repository write access only for same-repository PRs; Pages publishing has Pages write and identity-token permissions. Fork PRs receive checks only and may require GitHub's maintainer approval to run. To publish an external contribution, review it and bring it onto a branch in this repository. The workflow does not use `pull_request_target`, execute preview artifacts with a publishing token, or post PR comments. The `gh-pages` branch is generated output and should not be edited as application source.

## Saved data and offline previews

Saved comparisons, libraries, drafts and recovery copies stay in the tester's browser. They are not committed to GitHub or automatically shared with other testers. Each deployment path uses its own storage namespace and offline cache, while exported backups keep their portable format. To move work from one PR or host to another, export and import a backup. Existing root-path installations preserve their earlier storage keys.

Paths on the same GitHub Pages origin are not security boundaries: JavaScript from another page on that origin could access the same browser storage. Namespacing prevents accidental interference; it does not make arbitrary PR code mutually untrusted. Publish reviewed repository branches only. Offline operation requires one successful initial load and cache preparation; removed previews can remain available in a browser that already downloaded them.

## What the checks establish

Automated checks verify software behavior and the declared mathematical models. They do not establish anatomical realism, validate a commercial machine, or prove hypertrophy outcomes. See [MODEL_PROVENANCE.md](MODEL_PROVENANCE.md) and the run-specific [verification record](VERIFICATION.md).
