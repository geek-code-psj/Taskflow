# TaskFlow — Complete Deployment Guide

## Railway Deployment (10,000+ Concurrent Users)

---

### Prerequisites
- Railway account (railway.app) — Hobby plan minimum ($5/mo)
- GitHub account with the taskflow repo pushed
- `openssl` available locally for secret generation

---

### Phase 1: Database Setup

1. **Create Railway project**
   - railway.app → New Project → Deploy from GitHub repo → Select `taskflow`

2. **Add PostgreSQL plugin**
   - Inside your Railway project → + New → Database → Add PostgreSQL
   - Railway auto-sets `DATABASE_URL` as a reference variable

3. **Increase PostgreSQL max connections** (for PgBouncer headroom)
   - Railway PostgreSQL → Settings → Add variable:
   ```
   PGARGS = -c max_connections=500 -c shared_buffers=256MB -c effective_cache_size=768MB
   ```

4. **Add Redis plugin** (for cross-replica rate limiting)
   - + New → Database → Add Redis
   - Railway auto-sets `REDIS_URL`

---

### Phase 2: API Service

1. **Create API service**
   - + New → GitHub Repo → Select `taskflow` repo
   - Root Directory: `/apps/api`
   - Service name: `api`

2. **Set environment variables** (Variables tab):
   ```
   DATABASE_URL       = ${{Postgres.DATABASE_URL}}
   REDIS_URL          = ${{Redis.REDIS_URL}}
   JWT_SECRET         = [run: openssl rand -hex 64]
   JWT_REFRESH_SECRET = [run: openssl rand -hex 64]
   FRONTEND_URL       = https://[your-web-service].up.railway.app
   NODE_ENV           = production
   PORT               = 4000
   ```

3. **Set Watch Paths** (Settings → Watch Paths):
   ```
   /apps/api/**
   /packages/**
   ```

4. **After first successful deploy**, run migrations via Railway shell:
   ```bash
   pnpm db:migrate
   pnpm db:seed
   ```

---

### Phase 3: Web Service

1. **Create Web service**
   - + New → GitHub Repo → Same `taskflow` repo
   - Root Directory: `/apps/web`
   - Service name: `web`

2. **Set environment variables**:
   ```
   VITE_API_URL = https://[your-api-service].up.railway.app
   ```

3. **Set Watch Paths**:
   ```
   /apps/web/**
   /packages/**
   ```

---

### Phase 4: PgBouncer (Optional but Strongly Recommended for 10,000+ users)

Railway has a one-click PgBouncer template:

1. In your project → + New → Template → Search "PgBouncer"
2. Configure:
   ```
   DATABASE_URL       = ${{Postgres.DATABASE_URL}}
   POOL_MODE          = transaction
   MAX_CLIENT_CONN    = 10000
   DEFAULT_POOL_SIZE  = 200
   ```
3. Update your `api` service's `DATABASE_URL` to point to PgBouncer:
   ```
   DATABASE_URL = ${{PgBouncer.DATABASE_URL}}
   ```

---

### Phase 5: Scaling

For sustained 10,000+ concurrent users, set in `api` service variables:
```
WEB_CONCURRENCY = 4    # Match to Railway instance CPU count
```
And update `start` command in railway.toml to:
```
startCommand = "node cluster.mjs"
```

For Railway Pro: enable **horizontal scaling** (multiple replicas) — Redis ensures rate limits
work correctly across all replicas since counters are shared.

---

### Verifying the Deployment

```bash
# Check API health
curl https://your-api.up.railway.app/health

# Expected response:
{
  "status": "ok",
  "timestamp": "2026-...",
  "pid": 123,
  "uptime": 42
}

# Test auth
curl -X POST https://your-api.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@taskflow.dev","password":"Admin@1234"}'
```

---

### Production Checklist

- [ ] `NODE_ENV=production` set
- [ ] Both JWT secrets are 64 hex chars (not default values)
- [ ] `FRONTEND_URL` points to actual Railway web URL
- [ ] `DATABASE_URL` points to PgBouncer (not raw Postgres) for 10k+ users
- [ ] Redis connected (verify with health endpoint)
- [ ] Migrations run successfully (`pnpm db:migrate`)
- [ ] Demo seed data loaded (`pnpm db:seed`)
- [ ] Watch Paths configured (prevents full rebuilds on unrelated changes)
- [ ] Custom domain configured (optional)
- [ ] HTTPS enforced (Railway does this automatically)

---

### Monitoring & Troubleshooting

**Slow queries?**
- Check Railway Postgres metrics → look for connections approaching max
- Enable PgBouncer if not already done
- Run `EXPLAIN ANALYZE` on slow queries

**Rate limit false positives?**
- Check Redis connection in `/health` endpoint
- Verify `REDIS_URL` is set and Redis service is running

**Auth issues?**
- Verify both JWT secrets are set and not empty
- Check that `FRONTEND_URL` matches the exact origin of the web app (including https://)
- Confirm cookies are not being blocked (SameSite=Strict requires same eTLD+1 for cross-site)

**Memory issues on Railway Free tier?**
- Free tier: 512MB RAM — insufficient for 10,000 users
- Upgrade to Hobby ($5/mo) minimum
- For 10,000+ concurrent: Pro plan recommended

---

### Architecture at Scale

```
Internet → Railway Load Balancer
         → web service (React SPA, CDN-served statics)
         → api service (4x cluster workers via Node.js cluster)
              → Redis (rate limiting, token blacklist)
              → PgBouncer (connection pooling)
                   → PostgreSQL (10 TB SSD, 500 connections)
```

At 10,000 concurrent users:
- PgBouncer handles 10,000 client connections → 200 PG connections
- Redis handles ~10,000 rate limit checks/sec (sub-millisecond INCR+TTL)
- Node cluster: each worker handles ~2,500 concurrent requests
- Dashboard: 8 parallel SQL queries, all hitting indexed columns
