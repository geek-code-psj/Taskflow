# TaskFlow — Setup & Deployment Guide

## 🚀 Local Development Setup

### Prerequisites
- **Node.js** 18+ and npm/pnpm
- **PostgreSQL** 13+ (local instance)
- **Redis** (local instance or use an online service)

### Step 1: Install Dependencies
```bash
cd taskflow
pnpm install
```

### Step 2: Set Up Local Database

#### Option A: Using Docker (Recommended)
```bash
# Start PostgreSQL and Redis in Docker
docker run -d --name taskflow-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=taskflow_dev \
  -p 5432:5432 \
  postgres:15

docker run -d --name taskflow-redis \
  -p 6379:6379 \
  redis:7
```

#### Option B: Using Local PostgreSQL Installation
1. Create a database:
   ```bash
   createdb taskflow_dev
   ```
2. Ensure PostgreSQL is running on `localhost:5432`

### Step 3: Run Database Migrations
```bash
cd apps/api
pnpm run migrate
```

This will:
- Create all required tables (users, projects, tasks, etc.)
- Set up Row-Level Security (RLS) policies
- Create indexes for performance
- Create the `taskflow_app` database role

### Step 4: Environment Configuration
Copy the `.env.local` file to each app:

**Already provided in:**
- `apps/api/.env.local`
- `apps/web/.env.example` → copy to `.env.local`

### Step 5: Start Development Servers
```bash
# From project root, start both apps simultaneously:
pnpm dev
```

**Expected output:**
```
✅ API worker running on port 4000
✅ Web app ready at http://localhost:3000
```

Or start them individually:
```bash
# Terminal 1: Backend
pnpm --filter @taskflow/api dev

# Terminal 2: Frontend
pnpm --filter @taskflow/web dev
```

### Step 6: Access the Application
- **Frontend:** http://localhost:3000
- **API:** http://localhost:4000/api
- **API Docs:** http://localhost:4000/api/health

### Test Account
After migration, you can create accounts by signing up via the frontend.

---

## 🔧 Local Development Troubleshooting

### Port Already in Use
If port 4000 is already in use:
```bash
# Kill the process using port 4000 (Windows)
netstat -ano | findstr :4000
taskkill /PID <PID> /F

# Or change PORT in apps/api/.env.local
PORT=4001
```

### PostgreSQL Connection Refused
```bash
# Check if PostgreSQL is running
# Windows: Open Services and start PostgreSQL
# macOS: brew services start postgresql
# Linux: sudo systemctl start postgresql
```

### Redis Connection Refused
```bash
# Check if Redis is running
# Docker: docker start taskflow-redis
# Local: redis-server

# Or use a Redis service like Redis Cloud
# Update REDIS_URL in .env.local
```

### CSS Error: "text-text-primary class does not exist"
This is now fixed in `tailwind.config.js` — the custom text colors have been added. If you still see it:
```bash
# Clear Tailwind cache
rm -rf node_modules/.vite
pnpm dev
```

---

## 📦 Production Deployment (Railway)

### Prerequisites
- Railway account (https://railway.app)
- GitHub repository with this project

### Step 1: Create Railway Project
1. Go to https://railway.app/dashboard
2. Click "New Project"
3. Connect your GitHub repository

### Step 2: Add Services

#### PostgreSQL Plugin
1. In project, click "+ Add Service"
2. Select "PostgreSQL"
3. Click "Add"
4. Set `DATABASE_URL` → `${{Postgres.DATABASE_URL}}` in API variables

#### Redis Plugin (Optional but Recommended)
1. Click "+ Add Service"
2. Select "Redis"
3. Set `REDIS_URL` → `${{Redis.REDIS_URL}}` in API variables

#### Deploy from GitHub (API Service)
1. Click "+ Add Service" → "GitHub Repo"
2. Select this repo
3. Select `Root Directory`: `/apps/api`
4. Set `Start Command`: `node cluster.mjs`

#### Deploy from GitHub (Web Service)
1. Click "+ Add Service" → "GitHub Repo"
2. Select this repo
3. Select `Root Directory`: `/apps/web`
4. Set `Start Command`: `npm run preview` (or `npm run build && npm run preview`)

### Step 3: Environment Variables

#### API Service Variables
```
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
JWT_SECRET=<generate: openssl rand -hex 64>
JWT_REFRESH_SECRET=<generate: openssl rand -hex 64>
DB_APP_PASSWORD=<generate strong password>
FRONTEND_URL=${{web.RAILWAY_PUBLIC_DOMAIN}}
NODE_ENV=production
PORT=4000
```

#### Web Service Variables
```
VITE_API_URL=${{api.RAILWAY_PRIVATE_URL}}/api
```

### Step 4: Domain Configuration
1. In Railway dashboard, go to Web service
2. Under "Networking", set a public domain (e.g., taskflow-web.up.railway.app)
3. Update `FRONTEND_URL` in API service

### Step 5: Deploy
1. Push to main branch on GitHub
2. Railway automatically deploys
3. Check deployment status in Railway dashboard

---

## 🔐 Security Checklist

Before deploying to production, ensure:

- [ ] `JWT_SECRET` and `JWT_REFRESH_SECRET` are strong 64-character hex strings
- [ ] `DB_APP_PASSWORD` is a strong random password
- [ ] Database backups are enabled
- [ ] CORS `FRONTEND_URL` is set to your actual domain
- [ ] `NODE_ENV=production` is set
- [ ] All environment variables are configured in Railway
- [ ] SSL/TLS is enabled (Railway provides automatic HTTPS)
- [ ] Rate limiting is active (default: 15 requests per 15 minutes)
- [ ] Row-Level Security (RLS) is active in PostgreSQL

---

## 📝 Build & Deployment Scripts

### Build All Packages
```bash
pnpm build
```

### Build Specific App
```bash
# Frontend
pnpm --filter @taskflow/web build

# Backend
pnpm --filter @taskflow/api build
```

### Run Tests (if available)
```bash
pnpm test
```

### Type Check
```bash
pnpm tsc --noEmit
```

---

## 🗂️ Project Structure

```
taskflow/
├── apps/
│   ├── api/           # Express backend
│   │   └── src/
│   │       ├── controllers/   # Route handlers
│   │       ├── middlewares/   # Auth, validation, security
│   │       ├── routes/        # Route definitions
│   │       ├── db/            # Database migrations
│   │       ├── lib/           # JWT, Redis, response helpers
│   │       └── index.ts       # Server entry point
│   │
│   └── web/           # React/Vite frontend
│       └── src/
│           ├── pages/         # Route pages
│           ├── components/    # Reusable components
│           ├── contexts/      # Auth context
│           ├── lib/           # API client, utilities
│           └── main.tsx       # App entry point
│
├── packages/
│   ├── types/         # Shared TypeScript types
│   └── validators/    # Zod validation schemas
│
└── infra/
    └── pgbouncer/     # Database connection pooling
```

---

## 🚨 Known Issues & Fixes

### Issue 1: Multiple Tab Token Refresh Race Condition
**Symptom:** Refresh token errors when using multiple browser tabs
**Status:** ✅ Fixed - Token refresh queue implemented

### Issue 2: Unsafe Type Casts
**Symptom:** TypeScript `any` type errors
**Status:** ✅ Fixed - All type casts replaced with proper types

### Issue 3: Hardcoded Database Password
**Symptom:** Security vulnerability in migration file
**Status:** ✅ Fixed - Password now uses `DB_APP_PASSWORD` env variable

### Issue 4: Authorization Inconsistency
**Symptom:** Task creation required admin but update didn't
**Status:** ✅ Fixed - Both operations now require 'member' role or higher

---

## 📚 Additional Resources

- **Railway Docs:** https://docs.railway.app
- **Express.js:** https://expressjs.com
- **React:** https://react.dev
- **TypeScript:** https://www.typescriptlang.org
- **Tailwind CSS:** https://tailwindcss.com
- **Zod Validation:** https://zod.dev

---

## 🤝 Support

For issues or questions:
1. Check troubleshooting section above
2. Review project logs: `pnpm logs` (Railway)
3. Check console errors: Dev Tools (Frontend) or Terminal (Backend)

---

**Last Updated:** May 31, 2026
**Status:** ✅ All critical issues fixed and deployment ready
