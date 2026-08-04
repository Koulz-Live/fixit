# Fixit Platform

Fixit is a governed, multi-tenant artisan marketplace and enterprise architecture workspace.

## Technology

- React 19 and TypeScript
- Vite 7
- React Router
- Axios
- Supabase Authentication and PostgreSQL with row-level security
- Node.js Vercel Functions
- Vercel hosting
- OpenAI Responses API (server-side integration boundary)

## Local development

Copy `.env.example` to `.env.local`, provide the Supabase publishable key, then run:

```bash
pnpm install
pnpm dev
```

The browser application runs through Vite. In deployed environments, requests under `/api/*` are handled by authenticated Vercel Node functions.

## Build

```bash
pnpm build
```

The build type-checks the React application and Node API functions before producing the static application in `dist/`.

## Supabase

The database baseline is stored in `supabase/migrations/202608040001_fixit_platform.sql`. Apply it to project `uxzqadvbywtzbmsbmugb` with the Supabase CLI or dashboard before using authenticated workspaces.

Required Vercel environment variables are documented in `.env.example`. `OPENAI_API_KEY` is server-only and must never use the `VITE_` prefix.
