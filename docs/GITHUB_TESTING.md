# Testing changes through GitHub

The app's source lives in this repository. GitHub Actions runs the automated build and tests; a website host serves the resulting app to human testers. These are separate jobs. A successful Actions run does not itself create a running website.

## What runs automatically

The **Application checks** workflow runs when a pull request is opened, updated or reopened, and when changes reach `main`. Each run installs the locked dependencies, runs the numerical/persistence tests, builds the production application and runs the desktop/phone browser and production offline tests.

Open a pull request's **Checks** tab to see progress and failures. Open the linked workflow run to download its production build and any retained browser traces. The run summary identifies the tested revision. Pull-request checks use GitHub's temporary merge revision so they exercise the proposed change together with its target branch; this is distinct from the PR's latest source commit.

Build output is a deployment artifact. GitHub does not execute the artifact's HTML as a website when you click it. Downloading that artifact is therefore not the intended no-install feedback experience. The existing hosted app remains available from the README while preview hosting is selected.

The workflow grants read access to repository contents and does not deploy, change repository settings, merge a pull request or use hosting credentials. Pull requests from forks may require GitHub's maintainer approval before checks run. Manual workflow dispatch becomes available once the workflow is present on the default branch.

## Clickable previews: the remaining hosting decision

The repository was public when checked on 10 November 2026. Anyone can read a public repository; that is different from being an invited collaborator with permission to change it.

| Route | Human testing experience | Access boundary |
| --- | --- | --- |
| Actions + GitHub Pages | A browser link to a hosted app, potentially one directory per PR | Ordinary Pages on this personal repository would be public, including to people without a GitHub account |
| Actions + an authenticated preview host | A browser link with a sign-in check | Requires a chosen provider and configured tester access; repository collaborator permissions do not automatically transfer |
| GitHub Codespaces | Each tester opens a cloud development environment and its browser preview | A separate environment per tester, with account/quota requirements; not a persistent shared PR preview URL |

Public or private preview publication has not been enabled by this workflow. The existing ChatGPT Site keeps its existing audience. This document does not authorize changing repository or site visibility.

For public Pages previews, implementation must also support paths such as `/Biomechanic_visualization/pr-1/`, preserve other open PR previews when publishing, avoid deploying stale or closed PR revisions, and handle PR closure. Runtime asset paths and offline caches need the deployment base. Saved browser data should be namespaced by preview while portable backup schemas remain stable. Paths on one origin are not a security boundary between arbitrary JavaScript from different PRs.

GitHub's ordinary Pages deployment publishes one complete site. The `deploy-pages` action's experimental preview option is not a general public PR-preview service. A multi-PR implementation must assemble the directories itself or use a host that provides separate preview deployments.

Publication should run only with the permissions appropriate to its source. Untrusted fork code must not execute with a deployment token through `pull_request_target`. Initial Pages settings, deployment environments and any trusted publishing workflow may require a one-time setup on the default branch. A preview must identify the commit it actually serves, and a failed build must not be advertised as the new live revision.

## What the checks establish

Automated checks verify software behavior and the declared mathematical models. They do not establish anatomical realism, validate a commercial machine, or prove hypertrophy outcomes. See [MODEL_PROVENANCE.md](MODEL_PROVENANCE.md) and the run-specific [verification record](VERIFICATION.md).
