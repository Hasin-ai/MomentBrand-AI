# MomentBrand AI

> **AI BuildFest 2026 — Track 2: MarTech**

AI-powered brand intelligence, creative direction, and neuromarketing platform. Set your brand identity, plan event-driven campaigns, generate pixel-perfect creative variants (A–E) in Bangla & English across social media formats, and evaluate them using predicted brain responses (TRIBE v2) — all in under 60 seconds.

---

## Core Platform Workflows

1. **Brand Brain**: Create custom brand profiles manually through a detailed form or load the pre-configured *Volt BD* demo. The brand profile sets colors, typography, voice tone, target audience, and prohibited claims or keywords that are strictly enforced by the system.
2. **Event Acceptance**: Import national/seasonal holidays from the [Calendarific API](https://calendarific.com/) and accept recommended marketing opportunities.
3. **Ad Concept & Layout**: Generate up to 5 creative ad variants (A–E) with Gemini, defining emotional angles, headlines, CTAs, visual directions, and IP compliance risk. Configure formats (1:1, 9:16, 16:9) and layout choices.
4. **Studio & Composition**: Backgrounds are generated using *Cloudflare Flux* (excluding text). Logos, transparent product cutouts, and multilingual Bangla/English copy are rendered on-brand as HTML/CSS using *Playwright* to ensure pixel-perfect typography.
5. **Neuromarketing Analysis (TRIBE v2)**: Standalone or bulk-analyze generated ad variants using Facebook's TRIBE v2 fMRI predicted brain-response model. It scores creative stopping power across 9 research-backed neuromarketing indices and visualizes brain activation maps.

---

## How It Works

```
                        User Input (Manual Form or Demo Load)
                                         │
                                         ▼
                             Brand Brain (PostgreSQL)
                                         │
                                         ▼
Holiday/Event Opportunities ─────► Campaign Concept Planning (Gemini 2.5 Flash)
(Calendarific API)                       │
                                         ▼
                                Variant Briefs (A–E)
                                         │
                                         ▼
                       Background Image Gen (Cloudflare Flux)
                                         │
                                         ▼
                         Compositor (Playwright Headless)
                   Renders logo, product cuts, Bangla/English text
                                         │
                                         ▼
                                Final Poster PNGs
                                         │
                                         ▼
                          Kaggle TRIBE v2 Brain API Tunnel
                       Image → Silent Video → fsaverage5 vertex
                                         │
                                         ▼
                             Nilearn Destrieux Atlas
                                         │
                                         ▼
                       9 Neuromarketing Engagement Indices
                          (Overall Ad Engagement Score)
```

**Key Compositing Principle**: The image model (Flux) generates *only* the background. All brand marks, product images, CTAs, and headlines are rendered on top as HTML/CSS by Playwright. This ensures that typography is never warped, branding is pixel-perfect, and bilingual Bangla and English text remains completely crisp and legible.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, Vite, Custom HSL styling system |
| **Backend** | Python 3.11+, FastAPI, Uvicorn |
| **Database** | PostgreSQL (local or hosted) |
| **AI Creative Director** | Google Gemini 2.5 Flash |
| **AI Background Generation** | Cloudflare Workers AI — Flux 1 Schnell / Flux 2 Pro |
| **Compositing Renderer** | Playwright (headless Chromium) |
| **Background Stripper** | Remove.bg API |
| **Color Extractor** | ColorThief |
| **Event Database** | Calendarific Holiday API |
| **Neuromarketing API** | Facebook TRIBE v2 model, Nilearn (Destrieux surface atlas), PyNgrok |

---

## The Neuromarketing API (`brain_response.ipynb`)

Exposes a FastAPI endpoint `/analyze-ad` running on Kaggle/Colab via an ngrok tunnel. Standalone images or bulk campaign variants are proxied by the backend through `POST /api/brain/analyze`.

### Under the Hood
1. **OOM-Safe Video Pipeline**: Static ad images are resized to a maximum side of 512px (for GPU memory safety) and converted into a 1-second silent MP4 video at 1 fps using `ffmpeg`.
2. **TRIBE v2 Model Inference**: The silent video is passed to the official model loader: `TribeModel.from_pretrained("facebook/tribev2")` on CUDA to predict vertex-level `fsaverage5` cortical activations.
3. **Nilearn Atlas ROI Mapping**: Converts the unlabeled vertex activations into region scores mapping across 14 canonical brain areas using Nilearn's Destrieux surface atlas. If the atlas is unavailable or shapes mismatch, the API gracefully falls back to unlabeled surface profiles.
4. **9 Neuromarketing Indices**: Weighted average scores computed from region activations:
   - **Attention Capture**: stopping power (visual cortex, dorsal attention parietal, anterior cingulate).
   - **Desirability & Reward**: purchase intent (ventral striatum, orbitofrontal cortex/vmPFC).
   - **Memory Encoding**: brand recall (parahippocampal memory, hippocampus, PCC/precuneus, temporal semantic).
   - **Self-Relevance & Persuasion**: personal connection (OFC/vmPFC, PCC/precuneus, prefrontal control).
   - **Social Sharing**: share-worthiness (temporal semantic, PCC, OFC, insula).
   - **Affective Salience**: emotional intensity (insula, anterior cingulate, amygdala).
   - **Cognitive Load**: utilitarian processing (prefrontal control, dorsal attention parietal).
   - **Hedonic Appeal**: visual liking (OFC, ventral striatum, visual cortex, ventral visual form).
   - **Novelty & Surprise**: unexpectedness (high-activation tail, anterior cingulate).
5. **Overall Ad Engagement Index**: Calculated as a weighted average of the core neuromarketing indices to rank variants.
6. **Visualization**: Returns a brain activation surface chart and a neuromarketing index breakdown chart.

---

## Setup & Run

### 1. Database Setup
Create a PostgreSQL database and run the migration script:
```bash
psql "$DATABASE_URL" -f scripts/migrate_postgres.sql
```

### 2. Environment Configuration
Create a `.env` file in the root directory:
```env
GOOGLE_AI_API_KEY=your_google_ai_studio_api_key
CLOUDFLARE_API_TOKEN=your_cloudflare_api_token
CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id
REMOVEBG_API_KEY=your_removebg_api_key
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/momentbrand
UPLOADS_DIR=uploads
PUBLIC_BASE_URL=http://localhost:8000
CALENDARIFIC_API_KEY=your_calendarific_api_key
BRAIN_API_BASE_URL=https://your-kaggle-ngrok-url.ngrok-free.app
BRAIN_API_TIMEOUT_SECONDS=180
APP_ENV=development
DEMO_FALLBACK_MODE=false
```

### 3. Start Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
playwright install chromium    # Install headless browser
uvicorn main:app --reload --port 8000
```
- API Docs: **http://localhost:8000/docs**

### 4. Start Frontend
```bash
cd app
npm install
npm run dev
```
- Frontend: **http://localhost:3000**

### 5. Launch the Neuromarketing API (Kaggle/Colab)
1. Open a Kaggle Notebook or Google Colab session.
2. Upload the `brain_response.ipynb` notebook.
3. Configure your Kaggle user secrets or environment variables for `HF_TOKEN` (Hugging Face token) and `NGROK_AUTHTOKEN`.
4. Run all cells to download the Facebook TRIBE v2 model weights, configure dependencies, start FastAPI locally, and expose the endpoint via ngrok.
5. Copy the generated ngrok URL into your `.env` as `BRAIN_API_BASE_URL` and restart the backend.

---

## Project Structure

```
momentbrand-ai/
├── backend/
│   ├── main.py                     # FastAPI server, CORS, router mounts
│   ├── config.py                   # Pydantic configuration settings
│   ├── requirements.txt            # Python dependencies
│   ├── models/
│   │   ├── brand.py                # Pydantic Brand validation schema
│   │   └── blueprint.py            # Pydantic Poster Blueprint schema
│   ├── routers/
│   │   ├── brands.py               # /api/brands/* (manual setup & demo loading)
│   │   ├── campaigns.py            # /api/campaigns/* (concept planning, variants & renders)
│   │   ├── brain.py                # /api/brain/* (TRIBE v2 API proxy)
│   │   ├── events.py               # /api/events/* (Calendarific fetch & opportunities)
│   │   └── export.py               # /api/export (format re-rendering)
│   ├── services/
│   │   ├── gemini.py               # Gemini planning and ad concept variants
│   │   ├── flux.py                 # Cloudflare Workers AI background gen
│   │   ├── colorthief_service.py   # Color Thief logo color palette extractor
│   │   ├── removebg.py             # Remove.bg background stripping API
│   │   ├── db.py                   # Raw PostgreSQL connection queries
│   │   └── supabase_client.py      # PostgreSQL client wrapper facade
│   └── compositor/
│       ├── template.py             # Blueprint JSON → HTML templates
│       └── renderer.py             # HTML/CSS → PNG via Playwright Chromium
├── app/
│   ├── index.html                  # React app entry page
│   ├── src/
│   │   ├── main.jsx                # DOM mount
│   │   ├── App.jsx                 # Router page setups
│   │   ├── api/
│   │   │   └── client.js           # API request helpers
│   │   ├── components/
│   │   │   └── ui.jsx              # Reusable layout and custom visual components
│   │   ├── pages/
│   │   │   ├── Landing.jsx         # Landing page
│   │   │   ├── BrandSetup.jsx      # Manual setup & database brand loading
│   │   │   ├── Events.jsx          # Holiday and event opportunities dashboard
│   │   │   ├── CampaignContext.jsx # Step 1: Brief, platform & reference uploads
│   │   │   ├── AdConcept.jsx       # Step 2: Variant concepts briefs (A–E)
│   │   │   ├── AdLayout.jsx        # Step 3: Social formats, density, and CTAs
│   │   │   ├── Studio.jsx          # Step 4: Flux generation & Playwright compositing
│   │   │   ├── Scoring.jsx         # Step 5: Bulk ad variant brain scoring
│   │   │   ├── BrainResponse.jsx   # Standalone ad analyzer & detailed index report
│   │   │   ├── Winner.jsx          # Performance analytics and campaign winner selection
│   │   │   ├── Experiment.jsx      # Live test manager
│   │   │   └── Analytics.jsx       # Campaign analytics reporting dashboard
│   │   ├── store/
│   │   │   └── store.jsx           # State management
│   │   └── styles/
│   │       └── index.css           # Global HSL styling system & tokens
├── mock-data/
│   ├── brand_volt_bd.json          # Demo brand details: Volt BD
│   ├── blueprint_eid_1x1.json      # Pre-calculated Eid Square poster
│   ├── blueprint_eid_9x16.json     # Pre-calculated Eid Portrait poster
│   └── blueprint_eid_16x9.json     # Pre-calculated Eid Landscape poster
├── scripts/
│   └── migrate_postgres.sql        # Database table initialization
└── brain_response.ipynb            # Jupyter notebook hosting TRIBE v2 FastAPI endpoint
```

---

## API Reference

Interactive API documentation is served at `http://localhost:8000/docs` when the backend is running.

### Key Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Check backend server status |
| `POST` | `/api/brands/manual` | Create a brand profile manually (inputs name, colors, typography, voice, logo) |
| `POST` | `/api/brands/load-demo` | Loads the Volt BD mock brand directly into the database |
| `GET` | `/api/brands` | Fetch list of all saved brands |
| `GET` | `/api/events/opportunities` | List Calendarific opportunity cards |
| `POST` | `/api/events/{event_id}/accept` | Accept opportunity, creates campaign draft shell |
| `PATCH` | `/api/campaigns/{id}/context` | Save step 1 campaign parameters |
| `PATCH` | `/api/campaigns/{id}/layout` | Save step 3 formats & layout configurations |
| `PATCH` | `/api/campaigns/{id}/concept` | Save step 2 approved ad concepts |
| `POST` | `/api/campaigns/{id}/variants` | Generate ad concept variants (A–E) |
| `POST` | `/api/campaigns/{id}/ads/generate` | Render selected variant posters (combines Flux + Playwright) |
| `POST` | `/api/campaigns/{id}/brain-analyses/run` | Bulk trigger standalone variant ad images to Kaggle TRIBE API |
| `POST` | `/api/brain/analyze` | Standalone proxy to analyze any ad image |
| `GET` | `/api/brain/health` | Check Kaggle TRIBE v2 API tunnel connection status |

---

## Troubleshooting

- **`RESOURCE_EXHAUSTED` (Gemini Rate Limits)**: The free tier of the Gemini API has limits. If you exhaust your quota, enable `DEMO_FALLBACK_MODE=true` in `.env` and restart the backend. This loads Volt BD mock files without using API keys.
- **Ngrok Tunnel Failures**: Ensure the ngrok tunnel token is correctly active in your Kaggle notebook settings, and the ngrok tunnel hasn't expired. Copy-paste the new tunnel address into `BRAIN_API_BASE_URL` in `.env`.
- **Kaggle Session Out Of Memory (OOM)**: TRIBE v2 is resource-heavy. If it runs out of memory, trigger a memory garbage collection by calling the `/memory` endpoint or restart the notebook session. Avoid feeding images larger than 512px for inference.
- **Playwright Chromium Not Found**: Run `playwright install chromium` inside your virtual environment to ensure headless rendering is installed.

---

## License

MIT
# MomentBrand-AI
