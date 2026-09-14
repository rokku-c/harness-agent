export const COLLECTOR_LIMIT = 200

export const COLLECTOR_KINDS = ["claude-code", "pi", "codex", "gemini"] as const

export const COLLECTOR = `set -u
H="$HOME"
LIM="\${1:-200}"
mtime() { stat -f '%m' "$1" 2>/dev/null || stat -c '%Y' "$1" 2>/dev/null || echo 0; }
size() { stat -f '%z' "$1" 2>/dev/null || stat -c '%s' "$1" 2>/dev/null || echo 0; }
field() { head -c "$3" "$1" 2>/dev/null | grep -o "\\"$2\\":\\"[^\\"]*\\"" | head -1 | cut -d'"' -f4; }
emit() { printf '%s\\t%s\\t%s\\t%s\\t%s\\t%s\\n' "$1" "$2" "$3" "$4" "$5" "$6"; }

jsonl_store() {
  kind="$1"; root="$2"
  [ -d "$root" ] || return 0
  find "$root" -name '*.jsonl' -type f 2>/dev/null | head -n "$LIM" | while read -r f; do
    emit "$kind" "$(basename "$f" .jsonl)" "$(field "$f" cwd 8192)" "$(mtime "$f")" "$(size "$f")" "$f"
  done
}

codex_store() {
  root="$H/.codex/sessions"
  [ -d "$root" ] || return 0
  find "$root" -name 'rollout-*.jsonl' -type f 2>/dev/null | head -n "$LIM" | while read -r f; do
    line=$(head -1 "$f" 2>/dev/null)
    id=$(printf '%s' "$line" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    cwd=$(printf '%s' "$line" | grep -o '"cwd":"[^"]*"' | head -1 | cut -d'"' -f4)
    [ -n "$id" ] || id=$(basename "$f" .jsonl)
    emit codex "$id" "$cwd" "$(mtime "$f")" "$(size "$f")" "$f"
  done
}

gemini_store() {
  root="$H/.gemini/tmp"
  [ -d "$root" ] || return 0
  find "$root" -name 'session-*.json' -type f 2>/dev/null | head -n "$LIM" | while read -r f; do
    id=$(field "$f" sessionId 4096)
    [ -n "$id" ] || id=$(basename "$f" .json)
    emit gemini "$id" "" "$(mtime "$f")" "$(size "$f")" "$f"
  done
}

jsonl_store claude-code "$H/.claude/projects"
jsonl_store pi "$H/.pi/agent/sessions"
codex_store
gemini_store
`
