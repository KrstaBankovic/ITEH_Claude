import { appendFileSync, mkdirSync } from 'node:fs';
let raw = ''; for await (const c of process.stdin) raw += c;
const i = JSON.parse(raw || '{}');
mkdirSync(new URL('../../metrics/', import.meta.url), { recursive: true });
appendFileSync(new URL('../../metrics/sessions.jsonl', import.meta.url),
  JSON.stringify({ event: 'session_start', session_id: i.session_id, ts: new Date().toISOString() }) + '\n');
process.exit(0);
