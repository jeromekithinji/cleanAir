# Clean Air

Walking and biking routes in Montréal for people who need to avoid busy, polluted roads. The browser keeps the health profile in memory for the tab. It is not saved.

BIXI is out of this version. On a bad-air or high-heat day the app can recommend the metro in text. It does not draw a transit route.

## Run the backend

From the repo root:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
npm run api
```

The API listens on [http://127.0.0.1:8000](http://127.0.0.1:8000). Interactive docs are at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).

`npm run api` uses the `uvicorn` on your `PATH`, so keep the virtualenv activated. Copy `backend/.env.example` to `backend/.env` when a feature needs it. `AI_GATEWAY_API_KEY` is only required for the assistant.

## Run the frontend

In a second terminal, from the repo root:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The app proxies `/backend/*` to `BACKEND_URL` (default `http://127.0.0.1:8000`), so the page and the API checks below can share one origin.

## Test the backend

With the API running, each command is one route. `GET /health` returns `200`. The feature routes return `501` until that module is implemented, with the file to edit in the body.

```bash
curl http://127.0.0.1:8000/health

curl http://127.0.0.1:8000/

curl "http://127.0.0.1:8000/geocode?q=Atwater%20Market"

curl "http://127.0.0.1:8000/conditions?lat=45.48&lon=-73.58&asthma=high&copd=low&heat=high&poor_air=true"

curl -X POST http://127.0.0.1:8000/routes \
  -H "content-type: application/json" \
  -d '{"origin":{"label":"Atwater Market","lat":45.479,"lon":-73.584},"destination":{"label":"Parc Lafontaine","lat":45.527,"lon":-73.570},"profile":{"asthma":"high","copd":"low","heat":"high","mode":"bike"},"poor_air":true}'

curl -X POST http://127.0.0.1:8000/assistant \
  -H "content-type: application/json" \
  -d '{"message":"I have asthma and want to bike to Atwater Market this afternoon","profile":{"asthma":"high","copd":"low","heat":"medium","mode":"bike"},"origin":{"label":"Here","lat":45.501,"lon":-73.567}}'
```

| Method | Path | What it is |
| --- | --- | --- |
| GET | `/health` | Process is up |
| GET | `/` | Feature list |
| GET | `/docs` | OpenAPI UI |
| GET | `/geocode?q=` | Address search |
| GET | `/conditions` | Nearest station, heat, and the banner |
| POST | `/routes` | Fastest route and clean-air route |
| POST | `/assistant` | Sentence in, same route payload out |

`/conditions` query fields are `lat`, `lon`, `asthma`, `copd`, `heat` (`low`, `medium`, or `high`), and `poor_air` (`true` or `false`).

## Test the frontend

With both servers running:

```bash
curl http://localhost:3000/backend/health
curl "http://localhost:3000/backend/geocode?q=Atwater%20Market"
```

Those hit the same routes through the Next.js proxy.

In the browser at [http://localhost:3000](http://localhost:3000):

1. The header should say `API connected`. If it says `API offline`, the backend is not running.
2. Set asthma, COPD, heat, and walking or biking, then choose **Plan a trip**. Nothing is written to disk.
3. Enter a start and a destination and choose **Compare routes**. The page calls `GET /geocode`, then `POST /routes`.
4. Check **Treat the air as poor** to send `poor_air: true`.
5. After a start exists, the banner calls `GET /conditions`.
6. Type a sentence and choose **Ask**. That calls `POST /assistant`.
7. Refresh the page. The profile form comes back, because the profile is only kept in memory.

## What is already here

The screen, the session profile, and the API contract are in place. Unfinished endpoints answer `501` with the module to edit. `GET /health` returns `{ "status": "ok" }`.

CO₂ math for a driven kilometre is in `backend/app/services/co2.py` (0 g for a walk or ride, 251 g/km if the same distance were driven). Wire it when routes exist.

## Push one feature at a time

Each slice has its own module. Branch from this skeleton and keep the schemas in `backend/app/schemas.py` and `src/lib/types.ts` stable.

1. **Geocoding.** Photon, biased to Montréal. `backend/app/services/geocode.py`, `src/components/trip-search.tsx`.
2. **Live air.** Nearest RSQA station. Scale is 1–25 good, 26–50 acceptable, 51+ poor. `backend/app/services/air.py`, `src/components/conditions-banner.tsx`.
3. **Heat and timing.** Open-Meteo hourly apparent temperature, plus a better time of day. `backend/app/services/weather.py` and `backend/app/services/conditions.py`.
4. **Two routes.** Fastest and clean-air, via Valhalla. `backend/app/services/routing.py`, `src/components/route-compare.tsx`. `poor_air` on the request makes avoidance stricter.
5. **Explanations and the tradeoff line.** `backend/app/services/explain.py`.
6. **Impact card.** Use `co2.py` from the route response. `src/components/impact-card.tsx` already renders it.
7. **Map.** Draw both lines. `src/components/route-map.tsx`.
8. **Assistant.** Extract the trip with AI Gateway, then call the route service. `backend/app/services/assistant.py`, `src/components/assistant-panel.tsx`.

Profile fields are asthma, COPD, and heat, each low, medium, or high, plus walking or biking. Refreshing the page clears them.
