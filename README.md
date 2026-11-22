# Clean Air

Walking and biking routes in Montréal for people who need to avoid busy, polluted roads. The browser keeps the health profile in memory for the tab. It is not saved.

BIXI is out of this version. On a bad-air or high-heat day the app can recommend the metro in text. It does not draw a transit route.

## Where to look

Everything for the API is flat files in `backend/`. Open the file named after the task. The web page is in `src/`.

| File | Who edits it |
| --- | --- |
| `backend/routing.py` | Task A. Two routes, busy-road %, tradeoff sentence |
| `backend/graphhopper/` | Task A. Map config and the two rules files |
| `backend/air.py` | Task B. Nearest station, and the hourly download at the bottom of the same file |
| `backend/main.py` | The URLs (`/api/route`, `/api/air`, and the rest). Usually leave this alone |
| `backend/models.py` | The JSON shapes both sides share |
| `src/components/` | The page sections |

There is no `jobs` folder. The hourly air download is `download_latest()` at the bottom of `backend/air.py`. Run it with `cd backend && python air.py`.

## Task A — routing

Start here. This is the riskiest piece. Until Task B is ready, use **Treat the air as poor** (`poor_air: true`) to force the strict rules. When Task B returns level `poor`, this task should switch to those rules on its own.

GraphHopper runs on its own (Java, port 8989). The FastAPI route calls it twice. Do not commit the jar, the map file, or the `graph-cache` folder.

| What | Where |
| --- | --- |
| Profiles and map path | [backend/graphhopper/config.yml](backend/graphhopper/config.yml) |
| Clean-air rules | [backend/graphhopper/clean.json](backend/graphhopper/clean.json) |
| Stricter rules for poor air | [backend/graphhopper/clean-strict.json](backend/graphhopper/clean-strict.json) |
| Call GraphHopper, busy-road %, tradeoff text | [backend/routing.py](backend/routing.py) |
| `POST /api/route` | [backend/main.py](backend/main.py) |
| Browser call | `planRoutes` in [src/lib/api.ts](src/lib/api.ts) |
| Side-by-side stats and the tradeoff line | [src/components/route-compare.tsx](src/components/route-compare.tsx) |

1. Install Java 17 or newer. `java -version` should report 17 or higher. On macOS, `brew install openjdk@17`.
2. Download a GraphHopper web jar from the [GraphHopper releases](https://github.com/graphhopper/graphhopper/releases) into `backend/graphhopper/`. Leave it untracked.
3. Download the Montréal extract from BBBike and save it as `backend/graphhopper/montreal.osm.pbf` (also untracked): [Montreal.osm.pbf](https://download.bbbike.org/osm/bbbike/Montreal/Montreal.osm.pbf).
4. From `backend/graphhopper`, import the map and start the server. The first start builds `graph-cache` and takes a while. `config.yml` already defines the `bike` and `foot` profiles, with contraction hierarchies off so a request can attach a custom model.

```bash
cd backend/graphhopper
java -Xmx2g -jar graphhopper-web-*.jar server config.yml
```

5. Confirm a normal bike route before writing any clean-air logic:

```bash
curl "http://127.0.0.1:8989/route?point=45.479,-73.584&point=45.527,-73.570&profile=bike&points_encoded=false&details=road_class"
```

6. The rules files are already sketched. `clean.json` avoids motorways, trunks, and primary roads, and prefers cycleways and quiet streets. `clean-strict.json` is the bad-air version: primary is avoided harder, and secondary is pushed down too. Tune the numbers once a test route works. GraphHopper rejects a model it cannot parse, so adjust the `if` expressions to the jar version you downloaded.
7. Implement `plan_routes` in `backend/routing.py`. `POST /api/route` in `backend/main.py` already calls it and returns 501 until that function is filled in.
   - Call GraphHopper twice. Both requests use `details: ["road_class"]`.
   - First call: profile `bike` or `foot` from the health profile, no custom model. That is the fastest route.
   - Second call: the same profile plus `clean.json`. If the air level is `poor`, or the body has `poor_air: true`, use `clean-strict.json` instead.
   - Busy-road % is distance on `MOTORWAY`, `TRUNK`, `PRIMARY`, and `SECONDARY` divided by total distance. The bike and foot profiles already avoid primary roads in Montréal, so without `SECONDARY` every route shows 0%.
   - Build the tradeoff line from the two durations and the two percentages, for example `+4 min, 60% less on busy roads`.
8. The page already posts to `/api/route` from **Compare routes** and prints `tradeoff` above the two cards.

`GRAPHHOPPER_URL` defaults to `http://127.0.0.1:8989` in [backend/.env.example](backend/.env.example).

## Task B — air quality

| What | Where |
| --- | --- |
| Hourly download and nearest station | [backend/air.py](backend/air.py) |
| `GET /api/air` | [backend/main.py](backend/main.py) |
| Browser call | `getAir` in [src/lib/api.ts](src/lib/api.ts) |
| Colour-coded banner | [src/components/conditions-banner.tsx](src/components/conditions-banner.tsx) |
| Database file (not committed) | `backend/data/air.sqlite` |

1. Download the RSQA station list. It has coordinates, names, and neighbourhoods: [rsqa-liste-des-stations](https://donnees.montreal.ca/dataset/rsqa-liste-des-stations).
2. Download the hourly file **IQA par station en temps réel** from [rsqa-indice-qualite-air](https://donnees.montreal.ca/dataset/rsqa-indice-qualite-air). The city refreshes it about once an hour.
3. Implement `download_latest()` at the bottom of `backend/air.py`. It loads the station list once and then saves the latest reading per station. Run it from `backend/`:

```bash
cd backend
python air.py
```

Schedule that command every hour. The sqlite path is `Settings.air_database` (`AIR_DATABASE` in `.env`, default `backend/data/air.sqlite`). Do not commit the database or the CSVs.
4. Implement `nearest_station` in the same file. `GET /api/air?lat=&lon=` should return the closest station, its IQA, and a level:

- 1–25 `good`
- 26–50 `acceptable`
- 51 or more `poor`

5. Pass that level into Task A. `POST /api/route` accepts `air_level`. `plan_routes` should call `nearest_station` for the trip origin and use `clean-strict.json` when the level is `poor`. The **Treat the air as poor** checkbox sends `poor_air: true` so routing can be tested before this job is live.
6. After a start point exists, the banner calls `GET /api/air` and colours the level. Until `nearest_station` is implemented, that call returns 501 and names `backend/air.py`.

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

curl "http://127.0.0.1:8000/conditions?lat=45.48&lon=-73.58"

curl "http://127.0.0.1:8000/api/air?lat=45.48&lon=-73.58"

curl -X POST http://127.0.0.1:8000/api/route \
  -H "content-type: application/json" \
  -d '{"origin":{"label":"Atwater Market","lat":45.479,"lon":-73.584},"destination":{"label":"Parc Lafontaine","lat":45.527,"lon":-73.570},"profile":{"asthma":"high","copd":"low","heat":"high","mode":"bike"},"air_level":"poor","poor_air":true}'

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
| GET | `/api/air` | Task B. Nearest station, IQA, and level |
| GET | `/conditions` | Weather: hourly apparent temperature (`python weather.py` stores it hourly) |
| POST | `/api/route` | Task A. Fastest route and clean-air route |
| POST | `/assistant` | Sentence in, same route payload out |

`/conditions` query fields are `lat` and `lon`.

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
3. Enter a start and a destination and choose **Compare routes**. The page calls `GET /geocode`, then `POST /api/route`.
4. Check **Treat the air as poor** to send `poor_air: true`. Task A uses that, or `air_level: "poor"`, to pick the strict rules file.
5. After a start exists, the banner calls `GET /api/air`.
6. Type a sentence and choose **Ask**. That calls `POST /assistant`.
7. Refresh the page. The profile form comes back, because the profile is only kept in memory.

## What is already here

The screen, the session profile, and the API contract are in place. Unfinished endpoints answer `501` with the module to edit. `GET /health` returns `{ "status": "ok" }`.

CO₂ math for a driven kilometre is in `backend/co2.py` (0 g for a walk or ride, 251 g/km if the same distance were driven). Wire it when routes exist.

## Push one feature at a time

Each slice has its own file in `backend/`. Keep `backend/models.py` and `src/lib/types.ts` stable so the pieces still fit together.

1. **Task A, routing.** See the section above. GraphHopper, `POST /api/route`.
2. **Task B, air quality.** See the section above. `backend/air.py` and `GET /api/air`.
3. **Geocoding.** Photon, biased to Montréal. `backend/geocode.py`, `src/components/trip-search.tsx`.
4. **Heat and timing.** Open-Meteo hourly apparent temperature, plus a better time of day. `backend/weather.py`.
5. **Street explanations.** Separate from the tradeoff line Task A builds. `backend/explain.py`.
6. **Impact card.** Use `co2.py` from the route response. `src/components/impact-card.tsx` already renders it.
7. **Map.** Draw both lines. `src/components/route-map.tsx`.
8. **Assistant.** Extract the trip with AI Gateway, then call the route service. `backend/assistant.py`, `src/components/assistant-panel.tsx`.

Profile fields are asthma, COPD, and heat, each low, medium, or high, plus walking or biking. Refreshing the page clears them.
