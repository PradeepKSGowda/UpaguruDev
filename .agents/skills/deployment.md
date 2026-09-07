# Skill: Cloud Deployment & Infrastructure Management (`deployment.md`)

## Input
- **Target Deployment Tier**:
  - Frontend & Web API: Vercel Edge Platform (Next.js 15).
  - Database, Auth & Storage: Supabase Cloud (PostgreSQL 15+).
  - Background Crawler Microservice: AWS ECS Fargate / Railway container.
  - Cache & Rate Limiter: Upstash Redis.
- **Environment Configuration**: Verified environment variables (from `.env.local.example` inventory).
- **Git Branch / Release Tag**: Production (`main`) or preview branch (`preview/*`).
- **Pre-deployment Artifacts**: Production build outputs, migration SQL scripts, container images.

---

## Output
- **Zero-Downtime Deployment Execution**: Production deployment commands or Vercel/Railway build trigger status.
- **Pre-Flight & Post-Deployment Checklist**: Systematic verification of infrastructure health, DNS routing, and SSL certificates.
- **Healthcheck & Smoke Test Probes**: Automated curl/fetch scripts validating HTTP 200 responses on `/api/health` and homepage.
- **Rollback Runbook**: Explicit, step-by-step commands to restore the previous stable production release upon failure.

---

## Checklist
- [ ] All environment variables configured in hosting dashboards (Vercel, Railway, Supabase); none missing.
- [ ] Database migrations (`schema-v1.sql` updates) applied and verified in Supabase before code deployment.
- [ ] Next.js production build (`npm run build`) completes with zero TypeScript or ESLint errors.
- [ ] Docker container build for Python scrapers completes and passes local health checks.
- [ ] Sentry DSN active and error capture verified in staging environment.
- [ ] Upstash Redis connection verified and rate limiter functional.
- [ ] Supabase Storage buckets configured with CDN cache headers and signed URL rules.
- [ ] Healthchecks.io heartbeats confirmed active for all scheduled crawler jobs.
- [ ] Lighthouse score verification executed on preview deployment (SEO ≥ 95, Performance ≥ 95).
- [ ] `task-backlog.json` updated to mark deployed tasks as `Completed` (`AGENTS.md` Rule 5).

---

## Prompt Template
```markdown
You are the DevOps Engineer Agent for UPA-GURU.
Prepare and execute the deployment for: [TIER_OR_SERVICE]

Target Environment: [STAGING | PRODUCTION]
Repository Branch: [BRANCH_NAME]
Included Changes: [LIST_FEATURES_OR_MIGRATIONS]

Requirements:
1. Generate the pre-flight verification checklist for all required environment variables.
2. Provide exact commands for database migration execution.
3. Provide deployment commands or configuration specs (Vercel CLI / Dockerfile).
4. Define automated post-deployment health check probes.
5. Provide a rollback procedure in case of health check failure.
```

---

## Examples

### Example 1: Multi-Stage Dockerfile for Python Playwright Scraper
```dockerfile
# Production Dockerfile for UPA-GURU Python Crawler Microservice
# Platform: AWS ECS Fargate / Railway

FROM python:3.11-slim-bookworm AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Final runtime image
FROM python:3.11-slim-bookworm

WORKDIR /app

# Copy python dependencies
COPY --from=builder /root/.local /root/.local
ENV PATH=/root/.local/bin:$PATH

# Install Playwright browser dependencies (Chromium only)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

RUN python -m playwright install --with-deps chromium

# Copy application source code
COPY . .

# Run as non-root user for security
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# Health check probe
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Example 2: Post-Deployment Verification Script
```bash
#!/usr/bin/env bash
# Post-deployment healthcheck verification script for UPA-GURU
set -euo pipefail

BASE_URL="https://upaguru.in"

echo "Running post-deployment smoke tests on ${BASE_URL}..."

# 1. Homepage probe
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/")
if [ "$HTTP_CODE" -ne 200 ]; then
    echo "FAILED: Homepage returned HTTP ${HTTP_CODE}"
    exit 1
fi
echo "PASSED: Homepage returned HTTP 200"

# 2. Public API probe
API_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/v1/notifications?limit=1")
if [ "$API_CODE" -ne 200 ]; then
    echo "FAILED: API returned HTTP ${API_CODE}"
    exit 1
fi
echo "PASSED: Public notifications API returned HTTP 200"

# 3. Dynamic Sitemap probe
SITEMAP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/sitemap.xml")
if [ "$SITEMAP_CODE" -ne 200 ]; then
    echo "FAILED: Sitemap returned HTTP ${SITEMAP_CODE}"
    exit 1
fi
echo "PASSED: Sitemap returned HTTP 200"

echo "ALL POST-DEPLOYMENT PROBES PASSED SUCCESSFULLY."
```

---

## Failure Conditions
- **Missing Secrets**: Deploying to production with missing or mismatched environment variables.
- **Unapplied Migrations**: Code deployed that depends on database columns or tables not yet present in Supabase.
- **Failing Healthcheck**: Service failing the `/health` endpoint after container spin-up.
- **Unsanctioned Execution**: Automatically executing deployments or destructive commands without user approval (`AGENTS.md` Rule 2).
- **Silent Deployment Failure**: Deployment marked complete when build logs contain suppressed fatal errors.
