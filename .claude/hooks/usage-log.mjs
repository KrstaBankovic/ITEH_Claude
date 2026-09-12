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
