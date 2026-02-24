#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN_DIR="$ROOT_DIR/.run"
LOG_DIR="$RUN_DIR/logs"
PID_FILE="$RUN_DIR/pids"

mkdir -p "$LOG_DIR"

ensure_env_file() {
  local env_file="$1"
  local example_file="$2"

  if [[ ! -f "$env_file" && -f "$example_file" ]]; then
    cp "$example_file" "$env_file"
    echo "[env] Created $env_file from example"
  fi
}

install_if_needed() {
  local dir="$1"

  if [[ ! -d "$dir/node_modules" ]]; then
    echo "[deps] Installing in $dir"
    (cd "$dir" && npm install)
  fi
}

get_env_value() {
  local file="$1"
  local key="$2"
  grep -E "^${key}=" "$file" 2>/dev/null | head -n1 | cut -d'=' -f2-
}

set_env_value() {
  local file="$1"
  local key="$2"
  local value="$3"

  [[ -z "$value" ]] && return 0

  if grep -qE "^${key}=" "$file"; then
    sed -i '' "s|^${key}=.*|${key}=${value}|" "$file"
  else
    printf "\n%s=%s\n" "$key" "$value" >> "$file"
  fi
}

sync_backend_env_from_dashboard() {
  local backend_env="$ROOT_DIR/futpools_backend/.env"
  local dashboard_env="$ROOT_DIR/futpools_dashboard/server/.env"

  [[ ! -f "$backend_env" || ! -f "$dashboard_env" ]] && return 0

  local backend_mongo dashboard_mongo dashboard_jwt dashboard_settings_key
  backend_mongo="$(get_env_value "$backend_env" "MONGODB_URI")"
  dashboard_mongo="$(get_env_value "$dashboard_env" "MONGODB_URI")"
  dashboard_jwt="$(get_env_value "$dashboard_env" "JWT_SECRET")"
  dashboard_settings_key="$(get_env_value "$dashboard_env" "SETTINGS_API_KEY")"

  # If backend still points to localhost but dashboard already has a remote URI, reuse it.
  if [[ "$backend_mongo" == "mongodb://localhost:27017/futpools" && -n "$dashboard_mongo" ]]; then
    set_env_value "$backend_env" "MONGODB_URI" "$dashboard_mongo"
    echo "[env] Synced backend MONGODB_URI from dashboard server .env"
  fi

  # Keep JWT and SETTINGS_API_KEY aligned between APIs.
  if [[ -n "$dashboard_jwt" ]]; then
    set_env_value "$backend_env" "JWT_SECRET" "$dashboard_jwt"
  fi
  if [[ -n "$dashboard_settings_key" ]]; then
    set_env_value "$backend_env" "SETTINGS_API_KEY" "$dashboard_settings_key"
  fi
}

port_in_use() {
  local port="$1"
  node -e "const net=require('net'); const s=net.connect({host:'127.0.0.1',port:${port}},()=>{s.destroy();process.exit(0)}); s.on('error',()=>process.exit(1)); setTimeout(()=>process.exit(1),400);"
}

start_service_if_needed() {
  local name="$1"
  local port="$2"
  local dir="$3"
  local command="$4"
  local logfile="$5"

  if port_in_use "$port"; then
    echo "[skip] $name already running on :$port"
    return 0
  fi

  : > "$logfile"
  echo "[start] $name -> http://localhost:$port"
  (cd "$dir" && eval "$command" > "$logfile" 2>&1) &
  echo $! >> "$PID_FILE"
}

cleanup() {
  if [[ -f "$PID_FILE" ]]; then
    echo ""
    echo "[shutdown] Stopping services started by run-all.sh..."
    while read -r pid; do
      if [[ -n "${pid:-}" ]] && kill -0 "$pid" 2>/dev/null; then
        kill "$pid" 2>/dev/null || true
      fi
    done < "$PID_FILE"
    rm -f "$PID_FILE"
  fi
}

trap cleanup EXIT INT TERM

# 1) Ensure .env files exist
ensure_env_file "$ROOT_DIR/futpools_backend/.env" "$ROOT_DIR/futpools_backend/.env.example"
ensure_env_file "$ROOT_DIR/futpools_dashboard/server/.env" "$ROOT_DIR/futpools_dashboard/server/.env.example"
ensure_env_file "$ROOT_DIR/futpools_dashboard/web/.env" "$ROOT_DIR/futpools_dashboard/web/.env.example"

# 2) Sync env values so backend and dashboard share DB/auth settings
sync_backend_env_from_dashboard

# 3) Install dependencies only if missing
install_if_needed "$ROOT_DIR/futpools_backend"
install_if_needed "$ROOT_DIR/futpools_dashboard/server"
install_if_needed "$ROOT_DIR/futpools_dashboard/web"
install_if_needed "$ROOT_DIR/futpools_web"

# 4) Ensure dashboard admin exists (idempotent)
echo "[seed] Ensuring dashboard admin user exists..."
(cd "$ROOT_DIR/futpools_dashboard/server" && npm run seed:admin >/dev/null 2>&1) || \
  echo "[warn] Could not seed admin (check DB/API env in futpools_dashboard/server/.env)"

# 5) Start all services (or skip if already running)
: > "$PID_FILE"
start_service_if_needed "Backend API" "3000" "$ROOT_DIR/futpools_backend" "npm run dev" "$LOG_DIR/backend.log"
start_service_if_needed "Dashboard API" "4000" "$ROOT_DIR/futpools_dashboard/server" "npm run dev" "$LOG_DIR/dashboard-server.log"
start_service_if_needed "Dashboard Web" "5173" "$ROOT_DIR/futpools_dashboard/web" "npm run dev -- --host --strictPort" "$LOG_DIR/dashboard-web.log"
start_service_if_needed "Futpools Web" "5174" "$ROOT_DIR/futpools_web" "npm run dev" "$LOG_DIR/futpools-web.log"

echo ""
echo "✅ Futpools listo."
echo "- Futpools Web (app móvil): http://localhost:5174"
echo "- Dashboard web:            http://localhost:5173"
echo "- Dashboard API:            http://localhost:4000"
echo "- Backend API:              http://localhost:3000"
echo ""
echo "Logs en: $LOG_DIR"
echo "Presiona Ctrl+C para apagar lo que arrancó este script."

wait
