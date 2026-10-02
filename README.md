<div align="center">

# 🧭 OpenTriage

**A local-first, open-model triage assistant for open-source maintainers.**

Suggests labels, spots duplicates, flags low-effort PRs, and drafts kind first replies. It runs on a modest laptop with small open-weight models, and a human always stays in charge.

[![Built with Gemma](https://img.shields.io/badge/built%20with-Gemma-4285F4)](#-models)
[![Local first](https://img.shields.io/badge/runs-locally-2ea44f)](#-quick-start-local-mode)
[![Read-only](https://img.shields.io/badge/GitHub%20access-read--only-blue)](#-privacy--safety)
[![License: MIT](https://img.shields.io/badge/license-MIT-yellow.svg)](LICENSE)
[![Hacktoberfest 2026](https://img.shields.io/badge/Hacktoberfest-2026-ff69b4)](https://hacktoberfest.com)

<!-- TODO: replace with a real GIF or screenshot of the dashboard -->
<!-- ![OpenTriage demo](docs/demo.gif) -->

[**Live demo**](#) · [**Demo video**](#) · [**DEV post**](#) · [**Project details**](project-details.md)

<sub>🚧 Built for the DEV Hacktoberfest 2026 Weekend Challenge: <em>Build for a Friend</em>. Items marked <code>TBD</code> are filled in as the project is completed.</sub>

</div>

---

## 📖 The story

<!-- TODO: 3–5 sentences about the real maintainer, their repo, and their problem. Keep their words and get their consent before naming them. -->

Maintaining an open-source project means a steady stream of issues and pull requests, usually handled in spare time. During Hacktoberfest the stream turns into a flood: duplicate reports, issues with no reproduction steps, and pull requests that change a single space in a README.

OpenTriage was built for **`TBD: maintainer name/handle`**, who maintains **`TBD: owner/repo`**. They told me: *"`TBD: quote`"*.

The goal is not to replace the maintainer's judgment. It is to take the repetitive first pass off their plate, and to do it with **open models that run on their own machine**, so their code and conversations stay theirs.

---

## ✨ Features

| | Feature | What it does |
|---|---|---|
| 🏷️ | **Label suggestions** | Picks from the repo's *existing* labels only, with a one-line reason. Abstains when unsure. |
| 🔁 | **Duplicate detection** | Shows the top 3 similar past issues with similarity scores. Works even without an LLM. |
| 🚩 | **Low-effort PR signals** | Transparent, rule-based signals (empty description, whitespace-only diff, trivial README edit). Rules decide; the model only explains. |
| ✉️ | **Draft replies** | Short, polite first responses ("could you share your version and steps?") that the maintainer edits before sending. |
| 📊 | **Reproducible evaluation** | One command measures suggestions against what real maintainers actually did, and compares models. |
| 🔌 | **Swappable models** | Local Gemma via Ollama, or any OpenAI-compatible endpoint. Change one line of config. |

---

## 🔒 Privacy & safety

- **Read-only.** OpenTriage never labels, comments, edits, or closes anything on GitHub. It uses a read-only token, and the codebase contains no write calls.
- **Human in the loop.** Every output is a suggestion. The maintainer decides.
- **Local mode keeps data local.** Apart from normal GitHub API requests, issue text does not leave your machine.
- **Hosted demo mode** sends *public* issue text to a hosted model API and says so in the UI. Use local mode for private repos.
- **Untrusted input.** Issue and PR text is treated as data, never as instructions. The model has no tools, and its output must pass schema validation.
- **Kind by design.** PR signals describe the contribution, never the person. We say "low-effort signals", not "spam author".

---

## 🚀 Quick start (local mode)

### Prerequisites
- Node.js 20+
- [Ollama](https://ollama.com) installed and running
- ~8 GB RAM is enough for the 1B model (see [Hardware notes](#-hardware-notes))
- A GitHub token with **read-only access to public repos** (optional, but it raises the API rate limit)

### Install and run

```bash
# 1. Get the code
git clone https://github.com/pkprajapati7402/opentriage.git   # TODO: confirm repo URL
cd opentriage

# 2. Pull the open models
ollama pull gemma3:1b          # TODO: verify model tag
ollama pull nomic-embed-text   # TODO: verify model tag

# 3. Configure
cp .env.example .env.local
# edit .env.local and set GITHUB_TOKEN

# 4. Install and start
npm install
npm run dev
```

Open <http://localhost:3000>, enter a public repo like `owner/repo`, and load it.

### Command line

```bash
# Fetch and cache a repo's issues and PRs
npm run triage -- fetch owner/repo --limit 200

# Generate suggestions for the latest items
npm run triage -- run owner/repo --model gemma3:1b --limit 50

# Evaluate against what maintainers actually did
npm run triage -- eval owner/repo --models knn,gemma3:1b --test-size 150
```

> 💡 Run `eval` on any public repo and compare with the numbers below. Results are cached, so reruns are cheap.

---

## 🧠 How it works

```mermaid
flowchart LR
    A[Public GitHub repo] -->|read-only API| B[Fetch + cache]
    B --> C[Embeddings]
    C --> D[Duplicate detection]
    B --> E[PR signal rules]
    C --> F[k-NN label baseline]
    F --> G[LLM re-rank with few-shot examples]
    D --> H[Draft reply]
    E --> H
    G --> I[(Suggestions)]
    D --> I
    E --> I
    H --> I
    I --> J[Maintainer dashboard]
    J -->|approves, edits, copies| K[Maintainer acts on GitHub]
```

**Design choices that matter**

1. **Retrieval does the heavy lifting.** Small models are weak at open-ended judgment, so suggestions start from similar past items and their real labels.
2. **Rules decide risk.** The low-effort PR band comes from deterministic rules. The model can explain, never escalate.
3. **Constrained outputs.** The model chooses from the repo's labels and returns schema-validated JSON. Unknown labels are dropped.
4. **Abstaining is a feature.** "No confident suggestion" beats a confident wrong label.

For the full specification, see [`project-details.md`](project-details.md).

---

## 🤖 Models

| Role | Default | Where it runs |
|---|---|---|
| Classification and drafts | `gemma3:1b` (optionally `gemma3:4b`) | Local, via Ollama |
| Embeddings | `nomic-embed-text` | Local, via Ollama |
| Hosted demo | `TBD: hosted open-weight model` | Free tier of a hosted provider |
| Baseline for comparison | `TBD: hosted closed model` | Free tier, public repos only |

<!-- TODO: verify each model tag and provider free-tier terms before publishing -->

### Why open models?

- 🔐 **Privacy:** a private repo's issues never have to leave the machine.
- 💸 **Cost:** no per-token bill for a volunteer maintainer.
- 💻 **Low-end friendly:** `TBD: measured speed and RAM on an 8 GB laptop`.
- 🔧 **Swappable:** change the model, label descriptions, or reply tone without rewriting anything.

---

## 📊 Evaluation

> 🚧 **TBD**: this section is filled with real numbers after the evaluation runs. Numbers below are placeholders.

**Method.** Items are sorted by creation date. The first 70% form the history pool, and the most recent 30% (up to 150 items) are the test set, so the model never sees the future. Only labels used at least 5 times are evaluated.

**Repos evaluated:** `TBD: owner/repo`, `TBD: owner/repo`, `TBD: owner/repo`

### Label suggestions

| Config | Where | Precision | Recall | F1 | Abstain rate | s/item |
|---|---|---|---|---|---|---|
| k-NN baseline (no LLM) | Local | TBD | TBD | TBD | TBD | TBD |
| Gemma 1B + retrieval | Local | TBD | TBD | TBD | TBD | TBD |
| Gemma 4B + retrieval | Local | TBD | TBD | TBD | TBD | TBD |
| Hosted Gemma + retrieval | Hosted | TBD | TBD | TBD | TBD | TBD |
| Hosted closed baseline | Hosted | TBD | TBD | TBD | TBD | TBD |

### Duplicates and low-effort PRs

| Task | Metric | Result |
|---|---|---|
| Duplicate detection | Recall@3 | TBD |
| Duplicate detection | Precision at threshold | TBD |
| Low-effort PR band | Precision / Recall | TBD / TBD |

> ⚠️ The PR ground truth is a **proxy** (for example closed-unmerged PRs labeled `invalid` or `spam`), so treat those numbers as indicative, not exact.

### Did the maintainer find it useful?

- Suggestions rated useful: **`TBD`%** (n = `TBD`)
- What they said: *"`TBD: quote`"*

### Where it fails

<!-- TODO: add 3–5 anonymized examples of notable misses and what we learned -->

---

## 💻 Hardware notes

Developed and tested on a low-end laptop (**Ryzen 5 5500U, 8 GB RAM**).

- Load one model at a time and keep context small.
- The 1B model is the default. The 4B model is optional and slower.
- Everything is cached, so reruns are fast.

```bash
# Optional environment tweaks for low-memory machines
export OLLAMA_MAX_LOADED_MODELS=1
```

Measured on the dev laptop: `TBD tokens/sec`, `TBD peak RAM`, `TBD seconds per item`.

---

## ⚙️ Configuration

| Variable | Purpose | Default |
|---|---|---|
| `GITHUB_TOKEN` | Read-only token for higher API limits | none |
| `OLLAMA_BASE_URL` | Ollama server | `http://localhost:11434` |
| `OLLAMA_LLM_MODEL` | Local LLM | `gemma3:1b` |
| `OLLAMA_EMBED_MODEL` | Local embeddings | `nomic-embed-text` |
| `HOSTED_BASE_URL` / `HOSTED_API_KEY` / `HOSTED_MODEL` | Hosted OpenAI-compatible provider (server only) | none |
| `APP_MODE` | `local` or `hosted` | `local` |
| `MAX_ITEMS_LIVE` | Item cap per hosted run | `50` |

Behavior such as ignored label patterns, thresholds, and signal weights lives in `triage.config.json`.

---

## 🗂️ Project structure

```
opentriage/
├─ src/
│  ├─ app/            # Next.js pages and API routes
│  ├─ components/     # UI components
│  ├─ lib/
│  │  ├─ github/      # fetcher, cache, normalizers
│  │  ├─ providers/   # Ollama, OpenAI-compatible, lexical
│  │  ├─ pipeline/    # labels, duplicates, PR signals, replies
│  │  ├─ eval/        # split, metrics, runner, report
│  │  ├─ prompts/     # versioned prompt templates
│  │  └─ schemas/     # zod schemas
│  └─ cli/            # triage command
├─ samples/           # precomputed demo results
├─ tests/             # tests for deterministic modules
└─ docs/              # screenshots and diagrams
```

---

## ⚠️ Limitations

- Small models make mistakes. Suggestions are starting points, not decisions.
- Label and duplicate "ground truth" comes from maintainers' past behavior, which is itself inconsistent.
- The low-effort PR evaluation uses a noisy proxy.
- Works best on English-language repos. Other languages are not yet evaluated.
- Hosted mode is rate-limited and may be unavailable when free-tier quotas run out.

## 🛣️ Roadmap

- [ ] GitHub Action / bot mode with maintainer approval
- [ ] Per-repo tuning from a maintainer's own history
- [ ] Multilingual issue support
- [ ] Better template-aware missing-info detection
- [ ] Optional write actions behind an explicit, opt-in flag

## 🤝 Contributing

Issues and pull requests are welcome. Please keep contributions small and focused, describe *why* the change helps, and link a related issue where one exists. Thoughtful PRs are appreciated, especially during Hacktoberfest.

## 🙏 Acknowledgments

- [Gemma](https://ai.google.dev/gemma) open-weight models
- [Ollama](https://ollama.com) for easy local inference
- The GitHub REST API
- `TBD: the maintainer who tried it and gave honest feedback`
- DEV and MLH for the Hacktoberfest Weekend Challenge

## 📄 License

MIT. See [LICENSE](LICENSE).

## 👤 Author

**Prince Kumar Prajapati**
GitHub: [@pkprajapati7402](https://github.com/pkprajapati7402) · Portfolio: [alfaceti.me](https://alfaceti.me)

---

<div align="center">
<sub>Built over a weekend, for a real maintainer, with models small enough to run on a laptop.</sub>
</div>
