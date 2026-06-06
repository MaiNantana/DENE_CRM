#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: bash scripts/deploy/prod_windows_static.sh [options]

Options:
  --check-only    Check public URL and remote target without rebuilding/deploying
  --skip-build    Skip npm build and deploy the current dist folder
  --help          Show this help

Environment:
  DEPLOY_HOST          Default: crm.serveftp.com
  DEPLOY_USER          Default: Administrator
  DEPLOY_PUBLIC_URL    Default: http://crm.serveftp.com/
  DEPLOY_TARGET_DIR    Default: C:\Program Files\iisnode\www\crm
  DEPLOY_STAGE_ROOT    Optional remote Windows stage parent path
  DEPLOY_STAGE_NAME    Default: crm_stage_<timestamp>
  DEPLOY_PASSWORD      Optional password auth for ssh/scp via SSH_ASKPASS
EOF
}

CHECK_ONLY=0
SKIP_BUILD=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --check-only)
      CHECK_ONLY=1
      shift
      ;;
    --skip-build)
      SKIP_BUILD=1
      shift
      ;;
    --help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
if command -v wslpath &>/dev/null; then
  WINDOWS_REPO_ROOT="$(wslpath -w "$REPO_ROOT")"
elif command -v cygpath &>/dev/null; then
  WINDOWS_REPO_ROOT="$(cygpath -w "$REPO_ROOT")"
else
  WINDOWS_REPO_ROOT="$(echo "$REPO_ROOT" | sed 's|/\([a-zA-Z]\)/|\1:\\|;s|/|\\|g')"
fi

DEPLOY_HOST="${DEPLOY_HOST:-crm.serveftp.com}"
DEPLOY_USER="${DEPLOY_USER:-Administrator}"
DEPLOY_PUBLIC_URL="${DEPLOY_PUBLIC_URL:-http://crm.serveftp.com/}"
DEPLOY_TARGET_DIR="${DEPLOY_TARGET_DIR:-C:\\Program Files\\iisnode\\www\\crm}"
DEPLOY_STAGE_ROOT="${DEPLOY_STAGE_ROOT:-}"
STAMP="$(date +%Y%m%d_%H%M%S)"
DEPLOY_STAGE_NAME="${DEPLOY_STAGE_NAME:-crm_stage_${STAMP}}"
LOCAL_STAGE_DIR="/tmp/${DEPLOY_STAGE_NAME}"
REMOTE_STAGE_DIR_PS=""
REMOTE_APPLY_SCRIPT_WIN=""

SSH_COMMON_OPTS=(
  -o StrictHostKeyChecking=accept-new
  -o ConnectTimeout=20
  -o ServerAliveInterval=10
  -o ServerAliveCountMax=3
  -o PreferredAuthentications=password
  -o PubkeyAuthentication=no
)

cleanup() {
  if [[ -n "${DEPLOY_ASKPASS_FILE:-}" && -f "${DEPLOY_ASKPASS_FILE:-}" ]]; then
    rm -f "$DEPLOY_ASKPASS_FILE"
  fi
}
trap cleanup EXIT

if [[ -n "${DEPLOY_PASSWORD:-}" ]]; then
  DEPLOY_ASKPASS_FILE="$(mktemp)"
  chmod 700 "$DEPLOY_ASKPASS_FILE"
  cat >"$DEPLOY_ASKPASS_FILE" <<EOF
#!/bin/sh
printf '%s' '${DEPLOY_PASSWORD}'
EOF
  SSH_ENV=(env DISPLAY=:0 SSH_ASKPASS="$DEPLOY_ASKPASS_FILE" SSH_ASKPASS_REQUIRE=force)
  if command -v setsid &>/dev/null; then
    SSH_PREFIX=(setsid)
  else
    SSH_PREFIX=()
  fi
else
  SSH_ENV=()
  SSH_PREFIX=()
fi

ssh_run() {
  "${SSH_ENV[@]}" "${SSH_PREFIX[@]}" ssh "${SSH_COMMON_OPTS[@]}" "${DEPLOY_USER}@${DEPLOY_HOST}" "$@"
}

ps_run() {
  local script="$1"
  local encoded
  encoded="$(printf '%s' "\$ProgressPreference='SilentlyContinue'; $script" | iconv -f UTF-8 -t UTF-16LE | base64 -w 0)"
  ssh_run "powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand $encoded"
}

trim_trailing_cr() {
  printf '%s' "$1" | tr -d '\r'
}

resolve_remote_stage_dir() {
  local stage_root
  if [[ -n "$DEPLOY_STAGE_ROOT" ]]; then
    stage_root="$DEPLOY_STAGE_ROOT"
  else
    stage_root="$(ps_run '[Environment]::GetFolderPath("UserProfile")')"
    stage_root="$(trim_trailing_cr "$stage_root")"
  fi

  if [[ -z "$stage_root" ]]; then
    echo "Could not resolve remote stage root" >&2
    exit 1
  fi

  stage_root="${stage_root%\\}"
  stage_root="${stage_root%/}"
  REMOTE_STAGE_DIR_PS="${stage_root}\\${DEPLOY_STAGE_NAME}"
  REMOTE_APPLY_SCRIPT_WIN="${REMOTE_STAGE_DIR_PS}\\windows_static_apply.ps1"
}

public_check() {
  echo "== Public Root =="
  curl -I -sS --max-time 20 "$DEPLOY_PUBLIC_URL"
  echo
}

remote_check() {
  echo "== Remote Target =="
  ps_run "if (Test-Path '$DEPLOY_TARGET_DIR') { Write-Output 'TARGET_EXISTS' } else { Write-Output 'TARGET_MISSING'; exit 1 }"
  echo
}

if [[ "$CHECK_ONLY" -eq 1 ]]; then
  public_check
  remote_check
  exit 0
fi

if [[ "$SKIP_BUILD" -eq 0 ]]; then
  echo "== Build frontend =="
  cmd.exe /c "cd /d $WINDOWS_REPO_ROOT && npm run build"
  echo
fi

echo "== Prepare stage =="
rm -rf "$LOCAL_STAGE_DIR"
mkdir -p "$LOCAL_STAGE_DIR/dist"
cp -r "$REPO_ROOT/dist/." "$LOCAL_STAGE_DIR/dist/"
cp -r "$REPO_ROOT/server" "$LOCAL_STAGE_DIR/"
cp "$REPO_ROOT/web.config" "$LOCAL_STAGE_DIR/"
cp "$REPO_ROOT/scripts/deploy/windows_static_apply.ps1" "$LOCAL_STAGE_DIR/"
find "$LOCAL_STAGE_DIR" -maxdepth 3 -type f | sort
echo

echo "== Upload stage =="
resolve_remote_stage_dir
ps_run "New-Item -ItemType Directory -Force -Path '$REMOTE_STAGE_DIR_PS' | Out-Null"
tar -C "$LOCAL_STAGE_DIR" -cf - . | ssh_run "tar -xf - -C \"$REMOTE_STAGE_DIR_PS\""
echo

echo "== Apply remote deploy =="
ps_run "& '$REMOTE_APPLY_SCRIPT_WIN' -StageDir '$REMOTE_STAGE_DIR_PS' -TargetDir '$DEPLOY_TARGET_DIR'"
echo

public_check
echo "Deploy completed with stage: $DEPLOY_STAGE_NAME"
