#!/usr/bin/env bash
# Install the omo Devin plugin from a local path inside the sandbox env.
# Usage: eval "$(scripts/sandbox-home.sh)" && scripts/install-local.sh /abs/path/to/plugin
set -euo pipefail

PLUGIN_PATH="${1:?usage: install-local.sh <absolute plugin path>}"
if [[ "${1:-}" == "--self-test" ]]; then
	"$0" 2>&1 | grep -q "usage:" && echo "install-local.sh --self-test OK" && exit 0
fi

devin plugins install --local "$PLUGIN_PATH" -y
echo "=== devin plugins info omo ==="
devin plugins info omo
