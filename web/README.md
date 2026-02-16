# Reason MVP Frontend Prototype (Next.js 16 + Tailwind)

Fast mobile-first prototype for the Reason flow.

## Stack
- Next.js 16 (App Router, TypeScript)
- Tailwind CSS 4
- Mocked API client contracts (no backend dependency)

## Routes
- `/checkup` — capture objective + concern input
- `/processing` — transient loading state
- `/result` — score, strengths, blind spots, recommendation
- `/recompose` — reframe output with tone/focus
- `/briefing` — stakeholder-ready talking points

## Project Structure
- `src/app/*` route pages
- `src/components/*` reusable mobile shell + UI primitives
- `src/lib/api/contracts.ts` API contract interfaces
- `src/lib/api/mock-client.ts` mocked API implementation
- `src/lib/types.ts` shared domain types

## Run Locally
```bash
cd web
npm install
npm run dev
```

Open: <http://localhost:3000>

## Notes
- Checkup data is stored in `localStorage` keyed by mock `jobId`.
- `mockReasonApi` simulates async latency and deterministic mock outputs.
- Ready to swap with a real API by implementing `ReasonApi` contract.
