#!/usr/bin/env bash
# Smoke test for a deployed webshop + simulation server (e.g. on the Synology NAS).
# Usage: scripts/nas-smoke-test.sh http://<nas-lan-ip>:51020
# Run it from a laptop/phone-reachable network position (the same Wi-Fi the students use).
set -u
BASE="${1:?Usage: $0 <base-url, e.g. http://<host>:51020>}"
BASE="${BASE%/}"
fail=0
ok()   { printf '  \033[32mOK\033[0m   %s\n' "$1"; }
bad()  { printf '  \033[31mFAIL\033[0m %s\n' "$1"; fail=1; }
check() { if [ "$2" = "$3" ]; then ok "$1"; else bad "$1 (expected '$3', got '$2')"; fi; }
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
json() { curl -s -H 'Content-Type: application/json' "$@"; }
field() { python3 -c "import sys,json;d=json.load(sys.stdin);print($1)" 2>/dev/null; }

echo "Smoke test against $BASE"
check "GET /health" "$(curl -s "$BASE/health")" '{"status":"ok"}'
check "GET / serves the SPA (200)" "$(code "$BASE/")" 200
check "QR deep link /?session=1234&role=customer serves the SPA (200)" "$(code "$BASE/?session=1234&role=customer")" 200
check "join link /join/1234 serves the SPA (200)" "$(code "$BASE/join/1234")" 200
check "SPA fallback for an unknown path (200)" "$(code "$BASE/some/deep/link")" 200
check "index.html is not cached" "$(curl -s -D - -o /dev/null "$BASE/" | tr -d '\r' | grep -i '^cache-control' | cut -d' ' -f2-)" "no-cache"

SID=$(json -X POST "$BASE/simulation/session/create" | field "d['session_id']")
[ -n "$SID" ] && ok "create session -> code $SID" || { bad "create session"; exit 1; }
S="$BASE/simulation/session/$SID"
check "GET session state is CONFIGURING" "$(json "$S" | field "d['state']")" CONFIGURING
check "claim station 3 as Mia" "$(code -X POST -H 'Content-Type: application/json' -d '{"student_name":"Mia","station_id":3}' "$S/claim")" 200
check "second claim on station 3 -> 409" "$(code -X POST -H 'Content-Type: application/json' -d '{"student_name":"Jan","station_id":3}' "$S/claim")" 409
check "409 detail names the holder" "$(json -X POST -d '{"student_name":"Jan","station_id":3}' "$S/claim" | field "d['detail']")" Mia
check "config in CONFIGURING" "$(code -X POST -H 'Content-Type: application/json' -d '{"daily_orders":{"S-RT":1}}' "$S/config")" 200
check "customer order accepted before start" "$(code -X POST -H 'Content-Type: application/json' -d '{"customer_name":"Test","items":[{"variant":"S-RT","quantity":1}]}' "$S/orders/add")" 200
check "start the day" "$(json -X POST -d '{"state":"RUNNING"}' "$S/state" | field "d['state']")" RUNNING
check "config after start -> 409" "$(code -X POST -H 'Content-Type: application/json' -d '{"strategy":"PUSH"}' "$S/config")" 409
check "customer order after start -> 409" "$(code -X POST -H 'Content-Type: application/json' -d '{"items":[{"variant":"S-RT","quantity":1}]}' "$S/orders/add")" 409
check "unknown session -> 404" "$(code "$BASE/simulation/session/0000")" 404
check "reset" "$(json -X POST "$S/reset" | field "d['state']")" CONFIGURING
check "reset keeps the claim of station 3" "$(json "$S" | field "d['stations'][2]['claimed_by']")" Mia

echo
if [ "$fail" -eq 0 ]; then echo "All checks passed."; else echo "Some checks FAILED."; fi
exit "$fail"
