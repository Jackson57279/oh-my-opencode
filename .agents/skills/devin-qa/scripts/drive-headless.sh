#!/usr/bin/env bash
# Drive one headless `devin -p` session in a scratch workdir with hook logging.
# Usage: eval "$(scripts/sandbox-home.sh)" && scripts/drive-headless.sh "<prompt>" [workdir]
set -euo pipefail

if [[ "${1:-}" == "--self-test" ]]; then
	"$0" 2>&1 | grep -q "usage:" && echo "drive-headless.sh --self-test OK" && exit 0
fi

PROMPT="${1:?usage: drive-headless.sh <prompt> [workdir]}"
WORKDIR="${2:-$(mktemp -d)/work}"
mkdir -p "$WORKDIR"
cd "$WORKDIR"
echo "workdir: $WORKDIR"
OMO_DEVIN_HOOK_LOG="$WORKDIR/hook.jsonl" \
	timeout 300 devin -p --permission-mode bypass --respect-workspace-trust false -- "$PROMPT"
echo "=== hook.jsonl ==="
cat "$WORKDIR/hook.jsonl" 2>/dev/null || echo "(no hook log written)"
