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

## Per session

| SHA | Turns | Input | Output |
|---|---|---|---|
${[...last.values()].map(r => `| \`${r.sha}\` | ${r.turns} | ${r.input_tokens} | ${r.output_tokens} |`).join('\n')}
`);
console.log('metrics/REPORT.md written');
