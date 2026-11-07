# Sunday Cards

A cozy, first-person trading card collecting game. Open packs at your desk, reveal five illustrated cards, build a searchable collection, and spend earned coins in the shop.

## Run

Requires Node.js 24 or newer. No external packages or service credentials are required.

```sh
npm start
```

The server listens on port 3000, or `PORT` when supplied. `npm run dev` restarts the server on source changes. `npm test` runs an isolated end-to-end API journey using a temporary database.

## Included

- Three pack sets, 36 collectible cards, rarity tiers, five-card reveals, duplicate counts, search, and rarity filters.
- Three free starter packs and 500 coins. Daily gift: 250 coins, resetting at midnight UTC. No real-money purchases.
- Persistent guest sessions; email/password registration preserves the guest collection. Sign-in restores the registered collection across browsers. Signing into an existing account does not merge guest cards.
- SQLite persistence, salted scrypt password hashes, HttpOnly session cookies, same-origin mutation checks, login throttling, reduced-motion support, and responsive layouts.
- Locally served generated desk and wildlife artwork. Three sets share the initial wildlife illustrations with different color treatments.

## Persistence and deployment

`data/game.db` and its WAL files hold all accounts and progress. Keep the directory on a persistent disk and back it up using SQLite's online backup facilities. Override the file location with `DB_PATH`; its parent directory must exist. Database files are ignored by Git.

Run one Node process per database behind an HTTPS reverse proxy. Set `NODE_ENV=production` to require secure session cookies. Expose `PORT` through your host. Do not deploy on an ephemeral filesystem or horizontally scale separate database copies.

This is a playable initial release, not a published service. Before public launch, add email verification, password recovery via an email provider, operational monitoring/backups, and durable distributed abuse controls if scaling beyond one process. Authentication currently supports registration and sign-in, but no password reset. Guest collections depend on the browser cookie until registered.

## Validation

`npm test` covers starter inventory, five-card opening, guaranteed final-slot rarity, persistence, invalid sets, purchases, insufficient funds, daily reward limits, registration, failed and successful sign-in, account isolation, and cross-origin rejection.

The browser flow has also been exercised in system Chromium at desktop and mobile sizes, including opening, revealing, searching, reloading, shop navigation, and daily rewards.

## GitHub Pages playable preview

`npm run build:pages` creates `dist/`, a static version with pack opening, collection, shop, and daily rewards. It uses browser localStorage instead of the server. No real accounts, passwords, or server database are included. Browser progress is separate from the server app, device-specific, and removable by clearing site data. Never use this client-controlled game state as a real economy.

Push to `main`, then in GitHub repository **Settings → Pages → Build and deployment → Source**, select **GitHub Actions**. The included Pages workflow tests, builds, and deploys the preview. If the workflow failed before Pages was enabled, rerun it in the Actions tab. GitHub reports the final published URL in the deployment; the expected project path is `https://taylonc.github.io/codex/`.

For a local static test, serve `dist/` with any static HTTP server. All paths are relative, including artwork, so the preview works at a GitHub Pages project subpath. The standard `npm start` app continues to use server-backed accounts and SQLite.
