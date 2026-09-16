#!/usr/bin/env bash
set -u

PASS=0
WARN=0
MISS=0

pass() { printf "PASS  %s\n" "$1"; PASS=$((PASS+1)); }
warn() { printf "WARN  %s\n" "$1"; WARN=$((WARN+1)); }
miss() { printf "MISS  %s\n" "$1"; MISS=$((MISS+1)); }

echo "=== PALTA MACHINE READINESS ==="
echo

OS="$(uname -s 2>/dev/null || echo unknown)"
ARCH="$(uname -m 2>/dev/null || echo unknown)"
echo "OS:   $OS"
echo "ARCH: $ARCH"

if command -v sw_vers >/dev/null 2>&1; then
  echo "macOS: $(sw_vers -productVersion)"
fi

if command -v system_profiler >/dev/null 2>&1; then
  CHIP="$(system_profiler SPHardwareDataType 2>/dev/null | awk -F': ' '/Chip/ {print $2; exit}')"
  [ -n "${CHIP:-}" ] && echo "Chip: $CHIP"
fi

echo
echo "--- Core tools ---"
command -v git >/dev/null 2>&1 && pass "git $(git --version | sed 's/git version //')" || miss "git"
command -v node >/dev/null 2>&1 && pass "node $(node -v)" || miss "node >= 22"
command -v npm >/dev/null 2>&1 && pass "npm $(npm -v)" || miss "npm"
command -v npx >/dev/null 2>&1 && pass "npx available" || miss "npx"

if command -v node >/dev/null 2>&1; then
  NODE_MAJOR="$(node -e "process.stdout.write(process.versions.node.split('.')[0])")"
  if [ "$NODE_MAJOR" -ge 22 ]; then
    pass "Node major version >= 22"
  else
    miss "Node >= 22 required; found $(node -v)"
  fi
fi

echo
echo "--- Recommended developer tools ---"
command -v code >/dev/null 2>&1 && pass "VS Code CLI" || warn "VS Code CLI not found"
command -v gh >/dev/null 2>&1 && pass "GitHub CLI $(gh --version | head -1)" || warn "GitHub CLI not found"
command -v watchman >/dev/null 2>&1 && pass "Watchman" || warn "Watchman not found (recommended on macOS for React Native)"
command -v python3 >/dev/null 2>&1 && pass "python3 $(python3 --version 2>&1)" || warn "python3 not found"

if [ "$OS" = "Darwin" ]; then
  echo
  echo "--- macOS / iOS tools ---"
  if xcode-select -p >/dev/null 2>&1; then
    pass "Xcode Command Line Tools"
  else
    miss "Xcode Command Line Tools"
  fi

  if command -v xcodebuild >/dev/null 2>&1; then
    XCODE_INFO="$(xcodebuild -version 2>/dev/null | head -1 || true)"
    [ -n "$XCODE_INFO" ] && pass "$XCODE_INFO" || warn "xcodebuild present but version unreadable"
  else
    warn "Full Xcode not found (required before iOS simulator/native build)"
  fi

  command -v pod >/dev/null 2>&1 && pass "CocoaPods $(pod --version)" || warn "CocoaPods not found (install when native iOS build requires it)"
fi

echo
echo "--- Android tools ---"
if [ -n "${ANDROID_HOME:-}" ]; then
  pass "ANDROID_HOME=$ANDROID_HOME"
else
  warn "ANDROID_HOME not set (not a blocker until Android native/simulator work)"
fi

command -v adb >/dev/null 2>&1 && pass "adb available" || warn "adb not found"
command -v java >/dev/null 2>&1 && pass "Java available" || warn "Java/JDK not found"

echo
echo "--- GitHub status ---"
if command -v gh >/dev/null 2>&1; then
  if gh auth status >/dev/null 2>&1; then
    pass "GitHub CLI authenticated"
  else
    warn "GitHub CLI installed but not authenticated"
  fi
else
  warn "Use browser/Git credential auth or install GitHub CLI"
fi

echo
echo "--- Disk ---"
if command -v df >/dev/null 2>&1; then
  df -h . | tail -1
fi

echo
echo "--- Optional provider CLIs (NOT required on day zero) ---"
command -v wrangler >/dev/null 2>&1 && pass "Cloudflare Wrangler" || warn "Wrangler not installed — install when Cloudflare work starts"
command -v supabase >/dev/null 2>&1 && pass "Supabase CLI" || warn "Supabase CLI not installed — install when Auth/DB work starts"
command -v eas >/dev/null 2>&1 && pass "Expo EAS CLI" || warn "EAS CLI not installed — install when EAS build workflow starts"

echo
echo "=== SUMMARY ==="
echo "PASS=$PASS WARN=$WARN MISS=$MISS"
echo
if [ "$MISS" -gt 0 ]; then
  echo "RESULT: MACHINE SETUP REQUIRED"
  exit 2
fi

echo "RESULT: CORE DEVELOPMENT READY"
exit 0
