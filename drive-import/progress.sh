#!/bin/bash
# Live view of the R2 upload: files done, percent, failures and time left. Read-only; Ctrl-C to stop.
HERE="$(cd "$(dirname "$0")" && pwd)"
TOTAL=$(wc -l <"$HERE/uploads.tsv" | tr -d ' ')
prev=$(wc -l <"$HERE/uploaded.log" | tr -d ' ')
start=$(date +%s)
while true; do
	done_n=$(wc -l <"$HERE/uploaded.log" | tr -d ' ')
	fails=$(wc -l <"$HERE/failures.log" 2>/dev/null | tr -d ' ')
	elapsed=$(($(date +%s) - start))
	rate="…"; eta="…"
	if [ "$elapsed" -ge 20 ] && [ "$done_n" -gt "$prev" ]; then
		per_min=$(((done_n - prev) * 60 / elapsed))
		rate="$per_min files/min"
		[ "$per_min" -gt 0 ] && eta="$(((TOTAL - done_n) / per_min)) min"
	fi
	pct=$((done_n * 100 / TOTAL))
	bar=$(printf '%*s' $((pct / 2)) '' | tr ' ' '#')
	running=$(pgrep -f "bash ./upload.sh" >/dev/null && echo "running" || echo "NOT running")
	printf '\r[%-50s] %3d%%  %s/%s files  %s  ~%s left  failures: %s  (%s)   ' "$bar" "$pct" "$done_n" "$TOTAL" "$rate" "$eta" "${fails:-0}" "$running"
	[ "$done_n" -ge "$TOTAL" ] && { echo; echo "Upload finished."; break; }
	sleep 5
done
