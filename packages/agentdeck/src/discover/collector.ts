/**
 * The remote session index, as POSIX sh shipped over stdin (`sh -s`).
 *
 * Deliberately not the TypeScript readers: a target machine may have no bun and
 * certainly has no copy of this repo. `find`, `head`, `grep` and `stat` are on
 * every machine that has these agents installed, so the script is streamed in
 * and never written to disk.
 *
 * Output is one TAB-separated record per session - kind, id, cwd, mtime, size,
 * and the path the record lives at - because tabs need no quoting and no JSON
 * escaping in a shell loop. The path is what a tail is read from later; the
 * reading is a second call, so an index of a busy machine stays an index.
 */
export const COLLECTOR_LIMIT = 200

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
