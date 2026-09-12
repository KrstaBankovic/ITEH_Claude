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
