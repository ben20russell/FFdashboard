# Fantasy Football Dashboard (Next.js App Router)

A production-ready starter for a secure fantasy football analytics dashboard and model playground.

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Create local environment file:

```bash
cp .env.example .env.local
```

3. Add your FantasyPros API key in `.env.local`:

```bash
FANTASYPROS_API_KEY=your_real_key_here
FANTASYPROS_SPORT=NFL
```

4. Start development server:

```bash
npm run dev
```

## Testing

```bash
npm run test
```

## Build

```bash
npm run build
npm run start
```

## Deploying to Vercel

- Add `FANTASYPROS_API_KEY` in Vercel Project Settings -> Environment Variables.
- Optionally add `FANTASYPROS_SPORT` (defaults to `NFL`).
- Deploy and verify the dashboard updates with ISR every 3600 seconds.

## FantasyPros Docs

- API docs reference: https://api.fantasypros.com/public/v2/docs
- Typed API wrappers are available in `lib/fantasypros-client.ts` for:
  - `getFantasyProsPlayers(...)`
  - `getFantasyProsRankings(...)`
  - `getFantasyProsProjections(...)`
  - `getFantasyProsInjuries(...)`
