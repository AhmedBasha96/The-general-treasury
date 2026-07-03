#!/bin/bash
set -euo pipefail

# Configuration
COMPOSE_FILE="docker-compose.yml"
BRANCH="main"
ENABLE_CACHE_CLEANING=true  # Disable for dev (huge speedup)
PARALLEL_BUILDS=true

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO] $1${NC}"; }
log_warn() { echo -e "${YELLOW}[WARN] $1${NC}"; }
log_error() { echo -e "${RED}[ERROR] $1${NC}"; }

# Fast git check (no fetch if recent)
fast_git_check() {
    if [ ! -d ".git" ]; then
        return 0
    fi
    
    # Only fetch if last fetch was >5min ago
    local last_fetch=$(stat -c %Y .git/FETCH_HEAD 2>/dev/null || echo 0)
    local now=$(date +%s)
    local age=$((now - last_fetch))
    
    if [ $age -gt 300 ]; then
        log_info "Checking for updates..."
        timeout 10 git fetch origin "$BRANCH" 2>/dev/null || {
            log_warn "Git fetch timeout, using local version"
            return 0
        }
        
        if [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/$BRANCH)" ]; then
            log_info "Pulling updates..."
            git pull origin "$BRANCH"
        fi
    else
        log_info "Git check skipped (recent fetch)"
    fi
}

# Minimal cache management (only when critical)
smart_cache() {
    if [ "$ENABLE_CACHE_CLEANING" != true ]; then
        log_info "Cache cleaning disabled (dev mode)"
        return 0
    fi
    
    # Only clean if disk space critical
    local available=$(df / | awk 'NR==2 {print $4}')
    local threshold=10000000  # 10GB in KB
    
    if [ "$available" -lt "$threshold" ]; then
        log_warn "Low disk space, cleaning cache..."
        docker builder prune -f --filter "until=72h" 2>/dev/null || true
    fi
}

# Fast deployment
main() {
    local start_time=$(date +%s)
    
    log_info "🚀 Fast deployment starting..."
    
    # Quick git check
    fast_git_check
    
    # Minimal cache management
    smart_cache
    
    # Pull images in background (don't wait for all)
    log_info "Pulling images (background)..."
    docker compose -f "$COMPOSE_FILE" pull --quiet --ignore-pull-failures &
    local pull_pid=$!
    
    # Build with cache and parallel builds
    log_info "Building services..."
    if [ "$PARALLEL_BUILDS" = true ]; then
        DOCKER_BUILDKIT=1 COMPOSE_DOCKER_CLI_BUILD=1 \
        docker compose -f "$COMPOSE_FILE" build --parallel
    else
        DOCKER_BUILDKIT=1 docker compose -f "$COMPOSE_FILE" build
    fi
    
    # Wait for pulls to complete (max 30s)
    timeout 30 wait $pull_pid 2>/dev/null || log_warn "Pull timeout, continuing..."
    
    # Deploy (recreate only changed containers)
    log_info "Starting services..."
    docker compose -f "$COMPOSE_FILE" up -d --no-build --remove-orphans
    
    # Note: Database migrations and seeding are run automatically 
    # when the backend container starts up (via db.js).
    log_info "Database migrations and seeding run automatically on backend container startup."
    
    # Quick health check
    sleep 2
    local running=$(docker compose -f "$COMPOSE_FILE" ps --status running --quiet | wc -l)
    local total=$(docker compose -f "$COMPOSE_FILE" ps --quiet | wc -l)
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log_info "✅ Deployment complete in ${duration}s ($running/$total services running)"
    
    # Async cleanup (don't wait)
    (
        sleep 10
        docker image prune -f --filter "until=168h" &>/dev/null || true
    ) &
    
    # Show services
    docker compose -f "$COMPOSE_FILE" ps
}

main "$@"