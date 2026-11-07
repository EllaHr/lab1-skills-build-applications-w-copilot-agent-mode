# OctoFit Tracker architecture

OctoFit Tracker is a three-tier application for a school fitness program. The starter code includes API contracts and intentionally incomplete implementation points so you can use GitHub Copilot agent mode in a test-driven loop.

![Three-tier OctoFit architecture](../.github/images/octofit-architecture.svg)

## Tier boundaries

- **Presentation tier**: React 19, Vite, React Router, Bootstrap, and a shared API client in `octofit-tracker/frontend/src`.
- **Logic tier**: Express and TypeScript routes/services in `octofit-tracker/backend/src` expose `/api/*` behavior on port `8000`.
- **Data tier**: Mongoose models and seed data in `octofit-tracker/backend/src/models` and `src/scripts/seed.ts` persist to MongoDB on port `27017`.

## Ports and environment rules

- MongoDB: `27017`
- Express API: `8000`
- Vite frontend: `5173`
- The browser calls relative `/api` paths. Vite proxies them to `http://localhost:8000`, so the unauthenticated API port stays private in Codespaces. `VITE_API_BASE_URL` can override the base URL.

## API contract

| Capability | Method and path | Expected behavior |
| --- | --- | --- |
| Activity tracking | `GET /api/activities`, `POST /api/activities` | List and create valid activity records. POST accepts `userId`, `teamId`, `type`, and `minutes`; `userId` and `teamId` must be well-formed IDs for an existing user and team; otherwise respond with a deliberate 4xx (never a 500 from a cast error). A created activity stores the submitted `user`, `team`, `type`, and `minutes` plus computed `points` and `occurredAt`. |
| Teams | `GET /api/teams`, `POST /api/teams` | List and create teams with members. Created and listed teams keep the submitted `name` and `mascot`. Reject a team without a name with `400`. |
| Leaderboard | `GET /api/leaderboard` | Return teams ordered by the sum of their activity points, highest first. Each entry has `teamName`, `totalPoints`, and a 1-based `rank`. |
| Workout suggestions | `GET /api/workouts/suggestions/:userEmail` | Recommend workouts from recent activity patterns for the matching seeded user's email address. The first suggestion's `focus` matches that user's goal or recent activity, with a `reason` explaining why. An email with no matching user returns a deliberate 4xx (for example, `404`). |

## Implementation decisions

- Presentation tier decision: Keep the React app as a thin client that fetches from `/api/*`, renders the returned data, and handles loading, empty, and error states without business logic.
- Logic tier decision: Implement the Express routes and services in the backend first, with schema-aware validation, `400`/`404` responses for invalid data, and no authentication or cross-tier coupling.
- Data tier decision: Use Mongoose schemas that enforce required data contracts for users, teams, activities, and workouts so the API layer can trust the database shape.
- Activity tracking approach: Accept `userId`, `teamId`, `type`, and `minutes`, validate both IDs exist, store `user`, `team`, `type`, `minutes`, and computed `points` plus `occurredAt`.
- Team management approach: Require `name` and `mascot` for team creation, keep `members` as an array of user IDs, and preserve member relationships when listing teams.
- Leaderboard approach: Aggregate points by team, sort descending by total points, and assign a 1-based rank so the UI can render a stable leaderboard.
- Workout suggestions approach: Match the request email to a seeded user, infer the most relevant focus from recent activity or fitnessGoal, and return a `reason` string that explains the recommendation.

## Test plan

Record the commands you run and what each failure means.

- Data-tier command: `npm run test:data --prefix octofit-tracker/backend`
  - Purpose: validates the Mongoose contracts for `User`, `Team`, `Activity`, and `Workout`.
  - Current failure pattern: required validation is missing; the failing assertions show `name`, `email`, `fitnessGoal`, `type`, `user`, `team`, `minutes`, `points`, `occurredAt`, and workout focus fields are not yet enforced.
- API command: `npm run test:api --prefix octofit-tracker/backend`
  - Purpose: validates the Express `/api/*` behavior for activities, teams, leaderboard, and workout suggestions.
  - Current failure pattern: invalid POSTs return `501` instead of a deliberate `4xx`, the leaderboard is empty, and workout suggestion matching is missing or incomplete.
- Frontend command: `npm test --prefix octofit-tracker/frontend`
  - Purpose: validates the React UI contract for loading states, empty states, error alerts, and data rendering.
  - Current failure pattern: all routes still render the placeholder “Implementation pending” shell and do not fetch, display, or handle API state transitions correctly.
- Backend build command: `npm run build --prefix octofit-tracker/backend`
  - Purpose: confirms the TypeScript backend compiles once the data and API contracts are implemented.
- Frontend build command: `npm run build --prefix octofit-tracker/frontend`
  - Purpose: confirms the React app compiles once the presentation tier is wired to the API contract and accessibility requirements are satisfied.

## Smallest safe implementation order

1. Fix data validation contracts in the Mongoose models.
2. Implement the Express API endpoints and service logic that depend on those schemas.
3. Finish the React presentation layer last, wiring fetches and state handling to the backend contract.

This order preserves the architecture boundaries while minimizing rework: schema rules first, then business behavior, then UI rendering.
