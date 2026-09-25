# sentry-alert-bridge

Internal web app that watches Sentry projects for new issues and posts them to
Slack. Each Sentry project is routed to a Slack channel from the UI.

## Getting started

```bash
cp .env.example .env
# fill in the two secrets:
openssl rand -hex 32     # -> ACCESS_TOKEN  (what you type to log in)
openssl rand -hex 32     # -> JWT_SECRET
# and the Sentry API token, from the integration page linked below:
#   SENTRY_AUTH_TOKEN=...

docker compose up
```

Then open <http://localhost:3000> and log in with `ACCESS_TOKEN`. Postgres,
migrations and both dev servers come up with that one command; the API is on
8000 and Vite proxies to it.

## How it works

The bridge asks the Sentry API for new issues every `POLL_INTERVAL_MINUTES` (5),
which needs no inbound network access. Each issue goes through one pipeline:
learn the project, claim the issue in `seen_issues` (the dedup), look up the
route, format, send, record the delivery.

Polling only asks about projects that have an enabled route, and only alerts on
issues first seen within the last two intervals — so a fresh deploy does not
replay a backlog.

## Sentry configuration

The app reads issues as an internal Sentry integration (org `sentry`, under
*Settings → Developer Settings*). Copy its **Token** into `SENTRY_AUTH_TOKEN`.

## Slack configuration

Create an incoming webhook per channel in Slack, then add it under
**Destinations** with a label like `#backend-alerts`. The URL is stored as-is in
our own Postgres and never shown again — the UI only renders a masked hint.
Use **Test** to verify a hook before any real issue arrives.

## Pages

- **Routing** — project → destination, with an enable toggle. Unrouted projects
  are pinned to the top.
- **Destinations** — Slack hooks, test sends, deletes (refused while a project
  still routes there).
- **Deliveries** — the last 100 issues handled, with outcome and error detail.
  `unrouted` rows link straight to the routing table.
- **Settings** — poll interval, last poll, **Poll now**.

## Scripts

| Command | What |
| --- | --- |
| `npm run dev` | server (tsx watch, :8000) and client (Vite, :3000) |
| `npm run build` | `dist/server` (tsc) and `dist/client` (Vite) |
| `npm start` | production server, serves the built SPA on one port |
| `npm test` | unit tests (Vitest) |
| `npm run typecheck` | server and client type checks |

## Deployment

`.github/workflows/production.yaml` builds the `Containerfile` with buildah and
pushes to `registry.version.helsinki.fi/toska/openshift/kontit/` on a published
release. It needs one repo secret, `VERSION_PUSH_SECRET`.

The image is two-stage (devDependencies to build the client, `--omit-dev` at
runtime), listens on 8000 and serves the API and the SPA together. Migrations run
at boot, so there is no separate deploy step.

Required env in production: `DATABASE_URL`, `SENTRY_AUTH_TOKEN`, `ACCESS_TOKEN`,
`JWT_SECRET`. See `.env.example` for the full list; `src/server/config.ts`
is the only place that reads `process.env`.
