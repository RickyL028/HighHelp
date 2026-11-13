#!/bin/bash
# Upload every file in uploads.tsv to the production R2 bucket. Not run yet: needs approval.
# Safe to re-run: keys already listed in uploaded.log are skipped.
#   ./upload.sh "/Users/ricky/Downloads/SBHS 2026 DRIVE"
set -euo pipefail
DRIVE="$1"
HERE="$(cd "$(dirname "$0")" && pwd)"
APP="/Users/ricky/Desktop/Rickys Codespace/HighHelp/highhelp"
LOG="$HERE/uploaded.log"
TMP="$(mktemp -d)"
touch "$LOG"

put_one() {
	local key="$1" rel="$2" mode="$3" src="$DRIVE/$2"
	# Images are re-encoded without metadata (no GPS locations); HEIC becomes JPEG.
	if [ "$mode" = "heic" ] || [ "$mode" = "img" ]; then
		src="$TMP/$(basename "$key")"
		magick "$DRIVE/$rel" -auto-orient -strip "$src"
	fi
	if (cd "$APP" && npx wrangler r2 object put "highhelp-storage/$key" --file "$src" --remote >/dev/null 2>&1); then
		echo "$key" >>"$LOG"
	else
		echo "FAILED $key ($rel)" >&2
	fi
}
export -f put_one
export DRIVE APP LOG TMP

# Eight uploads at a time; anything already in the log is skipped.
awk -F'\t' 'FILENAME == ARGV[1] { done[$0]=1; next } !($1 in done) { print $1 "\t" $2 "\t" $3 }' "$LOG" "$HERE/uploads.tsv" |
	tr '\t\n' '\0\0' | xargs -0 -n 3 -P 8 bash -c 'put_one "$0" "$1" "$2"'

echo "Uploaded $(wc -l <"$LOG") of $(wc -l <"$HERE/uploads.tsv") files."
