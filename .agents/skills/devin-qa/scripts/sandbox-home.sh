#!/usr/bin/env bash
# Create an isolated Devin home (XDG dirs + copied auth) and print env exports.
# Usage: eval "$(scripts/sandbox-home.sh [dir])"  or  scripts/sandbox-home.sh --self-test
set -euo pipefail

if [[ "${1:-}" == "--self-test" ]]; then
	tmp="$(mktemp -d)"
	out="$("$0" "$tmp/home")"
	echo "$out" | grep -q "XDG_CONFIG_HOME"
	for d in config data state cache; do [[ -d "$tmp/home/$d" ]] || { echo "FAIL: missing $d"; exit 1; }; done
	rm -rf "$tmp"
	echo "sandbox-home.sh --self-test OK"
	exit 0
fi

SANDBOX="${1:-$(mktemp -d)/home}"
mkdir -p "$SANDBOX/config/devin" "$SANDBOX/data/devin" "$SANDBOX/state" "$SANDBOX/cache"
cp "$HOME/.local/share/devin/credentials.toml" "$SANDBOX/data/devin/" 2>/dev/null || true
cp "$HOME/.config/devin/config.json" "$SANDBOX/config/devin/" 2>/dev/null || true
cat <<EOF
export OMO_DEVIN_SANDBOX="$SANDBOX"
export XDG_CONFIG_HOME="$SANDBOX/config"
export XDG_DATA_HOME="$SANDBOX/data"
export XDG_STATE_HOME="$SANDBOX/state"
export XDG_CACHE_HOME="$SANDBOX/cache"
EOF
