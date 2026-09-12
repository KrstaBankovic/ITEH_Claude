# Manual Setup — GymTracker

Everything a human has to do. All of it before the CLI runs — the hooks in particular must exist from session one, or the first session is unmeasured and unprotected.

Paths assume Git Bash on Windows, repo at `~/KRSTA/ITEH_Claude` (`~/` = `C:/Users/Lazar/`).

---

## 1. Prerequisites

```bash
node -v     # 20 or newer
git --version
```

---

## 2. Supabase

1. New project at [supabase.com](https://supabase.com) → **New project**, region **Central EU (Frankfurt) / eu-central-1** (closest to Belgrade; pick the same region for the Gemini project so latency does not skew the comparison).
2. Save the database password when it is shown. It is not recoverable later — you would have to reset it.
3. **Project Settings → Database → Connection string**, and take two:
   - **Transaction pooler** (port `6543`) → this becomes `DATABASE_URL`
   - **Direct connection** (port `5432`) → this becomes `DIRECT_URL`
4. Repeat as a second, separate project for `ITEH_Gemini`.

Do not enable RLS, do not create tables in the dashboard, do not touch Auth. Migrations create everything.

---

## 3. Environment

Generate a JWT secret:

```bash
openssl rand -base64 32
```

Create `~/KRSTA/ITEH_Claude/.env.local`:

```
DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-0-eu-central-1.pooler.supabase.com:6543/postgres
DIRECT_URL=postgresql://postgres.<ref>:<password>@aws-0-eu-central-1.pooler.supabase.com:5432/postgres
JWT_SECRET=<paste the openssl output>
```

If the password contains `@ : / ? # [ ] %`, URL-encode it or the connection string silently parses wrong. Easiest fix is to reset it to something alphanumeric.

```bash
cd ~/KRSTA/ITEH_Claude
printf '.env.local\n.env*.local\nnode_modules\n.next\nmetrics/usage.jsonl\nmetrics/sessions.jsonl\n' >> .gitignore
```

---

## 4. Git identity

Already set, but verify — a single commit under the wrong identity is easy to miss and annoying to rewrite:

```bash
cd ~/KRSTA/ITEH_Claude
git config user.name    # KrstaBankovic
git config user.email   # 76056923+KrstaBankovic@users.noreply.github.com
```

---

## 5. Commit-message hook

The one layer that cannot be talked around, because it rewrites the finished message file.

```bash
cd ~/KRSTA/ITEH_Claude
mkdir -p .githooks
cat > .githooks/commit-msg << 'EOF'
#!/usr/bin/env bash
sed -i -E '/^(🤖 )?Generated with \[?Claude Code\]?/d; /^Co-[Aa]uthored-[Bb]y: Claude/d; /^Claude-Session:/d' "$1"
EOF
chmod +x .githooks/commit-msg
git config core.hooksPath .githooks
```

Test it:

```bash
git commit --allow-empty -m "$(printf 'test\n\nCo-Authored-By: Claude <noreply@anthropic.com>')"
git log -1 --format='%B'          # the trailer must be gone
git reset --hard HEAD~1
```

---

## 6. Claude Code configuration

```bash
cd ~/KRSTA/ITEH_Claude
mkdir -p .claude/hooks metrics
```

### `.claude/settings.json`

```json
{
  "attribution": { "commit": "", "pr": "" },
  "hooks": {
    "SessionStart": [
      { "hooks": [ { "type": "command", "command": "node",
                     "args": ["${CLAUDE_PROJECT_DIR}/.claude/hooks/session-start.mjs"] } ] }
    ],
    "Stop": [
      { "hooks": [ { "type": "command", "command": "node",
                     "args": ["${CLAUDE_PROJECT_DIR}/.claude/hooks/usage-log.mjs"] } ] }
    ],
    "PreToolUse": [
      { "matcher": "Bash",
        "hooks": [ { "type": "command", "if": "Bash(git *)", "command": "node",
                     "args": ["${CLAUDE_PROJECT_DIR}/.claude/hooks/block-attribution.mjs"] } ] }
    ]
  }
}
```

### `.claude/hooks/session-start.mjs`

```js
import { appendFileSync, mkdirSync } from 'node:fs';
let raw = ''; for await (const c of process.stdin) raw += c;
const i = JSON.parse(raw || '{}');
mkdirSync(new URL('../../metrics/', import.meta.url), { recursive: true });
appendFileSync(new URL('../../metrics/sessions.jsonl', import.meta.url),
  JSON.stringify({ event: 'session_start', session_id: i.session_id, ts: new Date().toISOString() }) + '\n');
process.exit(0);
```

### `.claude/hooks/usage-log.mjs`

Writes a cumulative snapshot per turn. The report takes the last row per session and sums across sessions, which avoids per-turn delta bookkeeping.

```js
import { appendFileSync, readFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';

let raw = ''; for await (const c of process.stdin) raw += c;
const input = JSON.parse(raw || '{}');
const totals = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
let turns = 0;

try {
  for (const line of readFileSync(input.transcript_path, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let u; try { u = JSON.parse(line)?.message?.usage; } catch { continue; }
    if (!u) continue;
    turns++;
    for (const k of Object.keys(totals)) totals[k] += u[k] ?? 0;
  }
} catch { /* transcript not readable yet */ }

let sha = 'unknown';
try { sha = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim(); } catch {}

mkdirSync(new URL('../../metrics/', import.meta.url), { recursive: true });
appendFileSync(new URL('../../metrics/usage.jsonl', import.meta.url),
  JSON.stringify({ ts: new Date().toISOString(), session_id: input.session_id, sha, turns, ...totals }) + '\n');
process.exit(0);
```

### `.claude/hooks/block-attribution.mjs`

```js
let raw = ''; for await (const c of process.stdin) raw += c;
const cmd = JSON.parse(raw || '{}')?.tool_input?.command ?? '';
if (/Co-?Authored-?By:\s*Claude|Generated with \[?Claude Code|Claude-Session:/i.test(cmd)) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: 'AI attribution is not permitted in commit messages.'
    }
  }));
}
process.exit(0);
```

### `CLAUDE.md`

```md
# GymTracker

University coursework (ITEH, FON). Spec: `IMPLEMENTATION_PLAN.md`. Procedure: `CLI_BUILD_BRIEF.md`.

## Git
Never add "Generated with Claude Code", "Co-Authored-By: Claude", a Claude-Session trailer,
or any other AI attribution to commit messages, PR descriptions, or code comments.
Commit messages contain only the conventional-commit subject and body.

## Scope
Class MVP. Where a requirement is met, stop. No tests, no logging framework, no extra dependencies.

## Constraints
- Supabase is a plain Postgres host. No supabase-js, no Supabase Auth, no RLS.
- postgres.js must be created with `prepare: false` (transaction pooler).
- Route handlers using bcryptjs need `export const runtime = 'nodejs'`.
- Never edit an applied migration. Add a new one.
- Never commit a failing build.
```

Verify with `/hooks` inside Claude Code — all three should be listed under **Project Settings**.

---

## 7. Measurement script

Built by hand, not by the CLI: the thing being measured should not write its own measuring tape, and its token cost would pollute the numbers.

### `scripts/usage-report.mjs`

```js
import { readFileSync, writeFileSync } from 'node:fs';

const rows = readFileSync('metrics/usage.jsonl', 'utf8').trim().split('\n').map(JSON.parse);
const last = new Map();
for (const r of rows) last.set(r.session_id, r);            // cumulative -> keep final row per session

const sum = (k) => [...last.values()].reduce((a, r) => a + (r[k] ?? 0), 0);
const t = {
  input: sum('input_tokens'),
  output: sum('output_tokens'),
  cacheRead: sum('cache_read_input_tokens'),
  cacheWrite: sum('cache_creation_input_tokens'),
  turns: sum('turns'),
};
const first = new Date(rows[0].ts), end = new Date(rows.at(-1).ts);

writeFileSync('metrics/REPORT.md', `# Usage report — Claude Code

| Metric | Value |
|---|---|
| Sessions | ${last.size} |
| Turns | ${t.turns} |
| Input tokens | ${t.input.toLocaleString()} |
| Output tokens | ${t.output.toLocaleString()} |
| Cache read | ${t.cacheRead.toLocaleString()} |
| Cache write | ${t.cacheWrite.toLocaleString()} |
| First turn | ${first.toISOString()} |
| Last turn | ${end.toISOString()} |
| Elapsed | ${((end - first) / 3.6e6).toFixed(1)} h |

## Per commit

| SHA | Turns | Input | Output |
|---|---|---|---|
${[...last.values()].map(r => `| \`${r.sha}\` | ${r.turns} | ${r.input_tokens} | ${r.output_tokens} |`).join('\n')}
`);
console.log('metrics/REPORT.md written');
```

Run once at the end: `node scripts/usage-report.mjs`.

**Also keep a manual stopwatch per phase.** Gemini CLI's free tier exports no token usage, so wall-clock and turn count are the only symmetric metrics. Note start and end time for each phase in both repos, in a plain text file.

---

## 8. GitHub

1. Krsta creates the repo **public**, named `ITEH_Claude`.
2. Add any other team member as a collaborator.
3. Locally:

```bash
cd ~/KRSTA/ITEH_Claude
git remote add origin https://github.com/KrstaBankovic/ITEH_Claude.git
git branch -M main
```

Pushing from your machine with your own GitHub credentials is fine — commits are authored by Krsta; only the push event shows under whoever pushed, and nobody reads that. If it matters, let Krsta push.

---

## 9. Vercel — after P1 exists

Import the GitHub repo. Framework preset: Next.js. Region: **Frankfurt (fra1)**, matching Supabase.

Environment variables (Production + Preview + Development):

| Key | Value |
|---|---|
| `DATABASE_URL` | pooler string, port 6543 |
| `DIRECT_URL` | direct string, port 5432 |
| `JWT_SECRET` | same as local |

`DIRECT_URL` is not used at runtime; it is there so `db:migrate` can be run from anywhere.

Migrations run from your machine against the same Supabase project, not in Vercel's build step:

```bash
npm run db:migrate
npm run db:seed
```

---

## 10. Kick off

```bash
cd ~/KRSTA/ITEH_Claude
claude --model claude-opus-5
```

Note the model in your metrics file, and use the same model for the whole run — switching mid-run invalidates the comparison.

---

## 11. Final checklist

- [ ] `.env.local` present and gitignored; not in `git log --stat`
- [ ] `git config core.hooksPath` → `.githooks`, hook tested
- [ ] `/hooks` in Claude Code lists all three
- [ ] Supabase reachable: `npm run db:migrate` succeeds
- [ ] Repo public, deployed on Vercel, seeded, demo login works
- [ ] `git log --format='%an <%ae>' | sort -u` → one identity
- [ ] `git log --all --format='%B' | grep -i -E 'claude|co-authored|generated with'` → nothing
- [ ] `metrics/REPORT.md` generated, manual phase timings recorded

---

## 12. Post-P0 check (both repos)

Next 16's dev server generates an agent policy file on first `npm run dev` and will
overwrite an existing one — `CLAUDE.md` for Claude Code, `AGENTS.md` for other agents.
That silently removes the Layer-2 attribution rule from plan §11.3.

After P0 in **each** repo, before anything else:

```bash
git diff --exit-code -- CLAUDE.md AGENTS.md GEMINI.md   # must be clean
grep -n "agentRules" next.config.ts                      # must show agentRules: false
```

If the policy file was overwritten: `git checkout -- <file>` and set `agentRules: false`
in `next.config.ts`. This is policy infrastructure, human-owned per brief rule 7, and
does not count as agent repair under plan §1 rule 4.

## 13. Repo B pinning

Scaffold Repo B with the same version Repo A used, not `@latest`:

    npx create-next-app@16.3.5

`@latest` will have moved by then, which would make the two runs incomparable.
