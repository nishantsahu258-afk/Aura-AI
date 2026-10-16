# Aura AI — Intelligent Multimodal Chatbot

Aura AI is a modern, high-performance conversational AI application engineered with a decoupled architecture: a reactive **React + Vite** frontend, a secure **Node.js + Express** API gateway, **MongoDB Atlas** persistence with binary image storage, and real-time **Google Gemini** multimodal response streaming.

Designed as an end-to-end portfolio project showcasing full-stack proficiency, production-grade error handling, Server-Sent Events (SSE), and defensive API design.

---

## Architecture Overview

```text
┌────────────────────────────────────────────────────────┐
│                   Aura AI Frontend                     │
│         React 19 • Vite • Tailwind CSS v4 • SPA        │
│          Client-side Routing • Blob Export             │
└──────────────────────────┬─────────────────────────────┘
                           │
                 HTTP REST │ Server-Sent Events (SSE)
              X-Client-Id  │ JSON Payloads / Base64
                           ▼
┌────────────────────────────────────────────────────────┐
│                   Aura AI Backend                      │
│             Node.js • Express • Helmet                 │
│         Rate Limiting • CORS • Model Routing           │
└──────────────┬──────────────────────────┬──────────────┘
               │                          │
        Mongoose / BSON            HTTPS REST / SSE
               ▼                          ▼
┌─────────────────────────────┐  ┌─────────────────────────────┐
│        MongoDB Atlas        │  │      Google Gemini API      │
│  - chats collection         │  │  - gemini-2.5-flash         │
│  - attachments collection   │  │  - gemini-3.5-flash / lite  │
│  - clients collection       │  │  - Multimodal Vision API    │
└─────────────────────────────┘  └─────────────────────────────┘
```

### Data Flow Highlights
1. **Anonymous Identity**: On first launch, the browser generates an anonymous UUID v4 stored in `localStorage` and passed via `X-Client-Id` on all requests. No passwords required; sessions and chats remain isolated to the client.
2. **Real-Time Streaming**: Prompts and optional image attachments stream from Express to Google Gemini's REST SSE endpoint. Express transforms and sanitizes the chunks into custom SSE events (`start`, `chunk`, `complete`, `stopped`, `error`) piped directly to the frontend.
3. **Persistent Image Memory**: When an image is uploaded, its binary data is stored in the MongoDB `attachments` collection. Subsequent follow-up prompts in the same chat automatically fetch and inject prior images into Gemini's multimodal conversation context without requiring re-upload.
4. **Resilient Failover**: The backend includes automatic retry loops and model failover (`gemini-2.5-flash` → `gemini-3.5-flash` → `gemini-3.7-flash` etc.) to handle temporary upstream capacity spikes.

---

## Key Features

- ⚡ **Real Gemini Response Streaming**: Smooth token-by-token text streaming over Server-Sent Events with instant Stop generation support via `AbortController`.
- 🖼️ **Persistent Image Attachments & Vision Memory**: Upload JPEG, PNG, or WebP images up to 5 MB. Images persist across page refreshes and are remembered in follow-up questions.
- ✏️ **Message Editing & Regeneration**: Edit previous user messages in-place with an inline editor. Automatically replaces downstream turns and streams fresh answers.
- 💬 **Full Chat CRUD**: Create new chats, rename titles, switch active sessions with deep-link URL support (`/chat/:id`), and delete chats with cascading attachment cleanup.
- 📥 **Native Chat Export**: Export any conversation directly to clean GitHub-flavored Markdown (`.md`) or formatted Plain Text (`.txt`) using native browser Blob APIs.
- 👤 **Client Profile & Display ID**: Generates a human-friendly display tag (`USR-XXXX`) with creation date and total chat analytics.
- 🎨 **Modern Minimalist UI**: Dark-themed aesthetic with ambient canvas ripples, responsive sidebar, skeleton loading states, and custom cursor animations (auto-disabled on touch devices).

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, Vite, Tailwind CSS v4, React Router 7, Lucide Icons, React Markdown, Remark GFM |
| **Backend** | Node.js (ES Modules), Express 4, Mongoose 8, Helmet, Express Rate Limit, CORS, dotenv |
| **Database** | MongoDB Atlas (M0 Free Tier or higher) |
| **AI Engine** | Google Gemini Generative Language REST API (`gemini-2.5-flash`, `gemini-3.5-flash`, etc.) |
| **Hosting** | Vercel (Frontend SPA), Render (Backend Web Service), MongoDB Atlas (Cloud DB) |

---

## Clean Folder Structure

```text
ai-chat-bot/
├── backend/                        # Express API server
│   ├── middleware/
│   │   ├── clientId.js             # Validates and extracts X-Client-Id header
│   │   └── rateLimit.js            # General and message-specific IP rate limiters
│   ├── models/
│   │   ├── Attachment.js           # Binary image storage with chat linkage
│   │   ├── Chat.js                 # Chat sessions and message schemas
│   │   └── Client.js               # Client display ID and activity metadata
│   ├── routes/
│   │   ├── chats.js                # Chat CRUD, streaming, editing, attachment serving
│   │   └── me.js                   # Client profile and statistics
│   ├── services/
│   │   ├── displayId.js            # Random unique display ID generator
│   │   ├── gemini.js               # Gemini API client, retries, model failover
│   │   └── prompt.js               # Persona system instructions & chat titling
│   ├── .env.example                # Backend environment template
│   ├── db.js                       # Mongoose connection with DNS fallback
│   ├── index.js                    # Express application entry point & CORS
│   └── package.json
│
├── frontend/                       # React + Vite Single Page Application
│   ├── public/                     # Icons, favicon, and SVG assets
│   ├── src/
│   │   ├── components/             # Modular UI components
│   │   │   ├── ChatInput.jsx       # Chat composer with image attachment preview
│   │   │   ├── ChatWindow.jsx      # Message feed and scroll orchestration
│   │   │   ├── ExportMenu.jsx      # Markdown (.md) and Text (.txt) export
│   │   │   ├── HeroInput.jsx       # Landing page prompt composer
│   │   │   ├── MessageBubble.jsx   # Message rendering, editing, and code blocks
│   │   │   ├── SettingsModal.jsx   # Profile modal with Display ID and stats
│   │   │   ├── Sidebar.jsx         # Chat list, new chat, rename, delete
│   │   │   └── ...
│   │   ├── context/
│   │   │   └── AppContext.jsx      # Global UI state (sidebar, profile modal)
│   │   ├── hooks/
│   │   │   └── useChats.js         # Chat state machine, SSE streaming, persistence
│   │   ├── lib/
│   │   │   ├── api.js              # Fetch client with X-Client-Id and SSE consumer
│   │   │   ├── exportChat.js       # Native Blob download generators
│   │   │   ├── gemini.js           # Model registry and metadata
│   │   │   └── storage.js          # Defensive localStorage helpers
│   │   ├── pages/
│   │   │   ├── ChatPage.jsx        # Primary chat interface
│   │   │   └── LandingPage.jsx     # Welcome screen
│   │   ├── App.jsx                 # Route definitions (/ and /chat/:id)
│   │   ├── index.css               # Tailwind CSS v4 imports & styling tokens
│   │   └── main.jsx
│   ├── .env.example                # Frontend environment template
│   ├── package.json
│   ├── vercel.json                 # SPA routing rewrites for Vercel
│   └── vite.config.js              # Vite config with dev proxy
│
├── .gitignore                      # Git exclusion rules
├── package.json                    # Workspace convenience scripts
└── README.md
```

---

## Prerequisites

- **Node.js**: v18.0.0 or v20+ recommended
- **npm**: v9.0.0 or higher
- **MongoDB Atlas Database**: A free MongoDB Atlas cluster connection string
- **Google Gemini API Key**: Free API key from [Google AI Studio](https://aistudio.google.com/app/apikey)

---

## Local Development Setup

### 1. Clone the Repository
```bash
git clone https://github.com/nishantsahu258-afk/Aura-AI.git
cd Aura-AI
```

### 2. Configure Backend Environment
Navigate to `backend/` and create your `.env` file from the template:
```bash
cd backend
cp .env.example .env
```
Edit `backend/.env` with your credentials:
```env
PORT=5000
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/aura?retryWrites=true&w=majority
GEMINI_API_KEY=your_actual_gemini_api_key_here
CLIENT_ORIGIN=http://localhost:5173
DAILY_MESSAGE_CAP=2000
```

### 3. Configure Frontend Environment (Optional in Dev)
In development, the Vite dev server automatically proxies `/api` calls to `http://localhost:5000`. You only need a `frontend/.env` if pointing to an external backend:
```bash
cd ../frontend
cp .env.example .env
```
Leave `VITE_API_URL=` blank for local development, or set `VITE_API_URL=http://localhost:5000`.

### 4. Install Dependencies
Install dependencies in both directories:
```bash
# In backend directory:
cd ../backend
npm install

# In frontend directory:
cd ../frontend
npm install
```

### 5. Run the Application
Open two terminal windows:

**Terminal 1 (Backend):**
```bash
cd backend
npm run dev
# Server will start on http://0.0.0.0:5000
```

**Terminal 2 (Frontend):**
```bash
cd frontend
npm run dev
# Vite client will start on http://localhost:5173
```

Open `http://localhost:5173` in your browser to interact with Aura AI.

---

## Environment Variables Reference

### Backend (`backend/.env`)

| Variable | Required | Default | Description | Example |
|---|---|---|---|---|
| `PORT` | No | `5000` | Port for the Express server to listen on. Render assigns this dynamically. | `5000` |
| `MONGODB_URI` | **Yes** | — | MongoDB connection URI including database name. | `mongodb+srv://<username>:<password>@cluster.mongodb.net/aura` |
| `GEMINI_API_KEY` | **Yes** | — | Google Gemini API key obtained from Google AI Studio. | `AIzaSy...` |
| `CLIENT_ORIGIN` | No | `http://localhost:5173` | Allowed frontend URL for CORS headers. Supports comma-separated list. | `https://aura.vercel.app,http://localhost:5173` |
| `DAILY_MESSAGE_CAP` | No | `2000` | Global daily request cap to prevent runaway upstream costs. | `2000` |

### Frontend (`frontend/.env`)

| Variable | Required in Prod | Default in Dev | Description | Example |
|---|---|---|---|---|
| `VITE_API_URL` | **Yes (Prod)** | `""` (empty) | Base URL of the deployed backend. Leave empty for local Vite dev proxy. | `https://aura-backend.onrender.com` |

---

## API Endpoints

All client-facing endpoints (except health and root) require the `X-Client-Id` HTTP header.

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/` | API status and health link | No |
| `GET` | `/api/health` | Deployment monitoring health check | No |
| `GET` | `/api/me` | Fetch client profile and total chat count | `X-Client-Id` |
| `GET` | `/api/chats` | List all chats for current client | `X-Client-Id` |
| `POST` | `/api/chats` | Create a new chat session | `X-Client-Id` |
| `GET` | `/api/chats/:id` | Fetch chat details and message history | `X-Client-Id` |
| `PATCH` | `/api/chats/:id` | Rename a chat title | `X-Client-Id` |
| `DELETE` | `/api/chats/:id` | Delete chat and cascade-delete attachments | `X-Client-Id` |
| `GET` | `/api/chats/:id/attachments/:attachmentId` | Serve stored binary image attachment | Query or `X-Client-Id` |
| `POST` | `/api/chats/:id/messages/stream` | Send message & stream Gemini response (SSE) | `X-Client-Id` |
| `PUT` | `/api/chats/:id/messages/:messageId/stream` | Edit message & stream replacement response (SSE) | `X-Client-Id` |
| `POST` | `/api/generate` | Direct standalone text generation | Rate Limited |

---

## Verification & Testing

### Automated Checks
Run these commands from the repository root:

```bash
# Run ESLint on the frontend codebase
npm run lint

# Build the frontend production bundle
npm run build

# Syntax check backend files
node --check backend/index.js backend/db.js backend/routes/chats.js backend/services/gemini.js
```

### Manual Feature Verification Checklist
- [x] **Landing Page Submission**: Submitting a prompt on `/` navigates to `/chat/:id` and starts streaming immediately.
- [x] **Text-Only SSE Streaming & Stop**: Message streams in real-time; clicking "Stop" cleanly halts generation and persists partial response.
- [x] **Image Attachments**: Attach a PNG/JPEG/WebP image (up to 5 MB); streams answer based on visual content.
- [x] **Persistent Image Memory**: Refresh the page — the image thumbnail persists. Ask a follow-up question ("What colors were in the image?") without re-uploading — Gemini correctly references the earlier image.
- [x] **Message Editing & Regeneration**: Click the edit icon on a user message, alter the prompt, and click "Save & Regenerate"; prior reply is replaced with a new stream.
- [x] **Chat CRUD**: Create new chat, switch chats via sidebar, rename chat title, and delete chat (verifying MongoDB document and attachment deletion).
- [x] **Export Chat**: Open the top-right export menu and download both Markdown (`.md`) and Plain Text (`.txt`).
- [x] **Profile Modal**: Click profile avatar; display ID (`USR-XXXX`), creation date, and chat count render properly.

---

## Deployment Guide

### 1. MongoDB Atlas Setup
1. Log in to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Create or select a cluster (the **M0 Free Tier** is suitable).
3. Under **Security → Database Access**, create a database user (e.g. `aura_user`) with **Read and write to any database** permissions and a strong password.
4. Under **Security → Network Access**, add an IP Access List entry:
   - Click **Add IP Address**.
   - Select **Allow Access from Anywhere** (`0.0.0.0/0`) and confirm.
   > **Why `0.0.0.0/0` is required for Render**: Cloud platforms like Render assign dynamic, ephemeral outbound IP addresses from a shared pool to free-tier Web Services. Restricting by a single static IP is only possible with a dedicated enterprise egress proxy. With `0.0.0.0/0`, all network traffic remains encrypted with TLS and strictly authenticated via your MongoDB database username and password.
5. Under **Deployment → Database**, click **Connect** → **Drivers** (Node.js) and copy the connection string. Replace `<username>` and `<password>` with your credentials and append the database name `/aura` (e.g. `mongodb+srv://<username>:<password>@cluster.mongodb.net/aura?retryWrites=true&w=majority`).

---

### 2. Backend Deployment on Render
1. Ensure your latest changes are pushed to GitHub on your working branch (default: `master`):
   ```bash
   git add -A
   git commit -m "chore: prepare Aura AI for production deployment"
   git push origin master
   ```
   *(If your GitHub repository default branch is `main`, replace `master` with `main`).*
2. Log in to [Render](https://render.com) and click **New + → Web Service**.
3. Connect your GitHub repository (`Aura-AI`).
4. Fill in the service configuration:
   - **Name**: `aura-backend` (or your preferred name)
   - **Region**: Choose the region closest to you or your target users
   - **Branch**: `master` (or your active default branch)
   - **Root Directory**: `backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. Under **Environment Variables**, add:
   - `PORT`: `5000` (Render binds to its own dynamic port automatically, which is read via `process.env.PORT`)
   - `MONGODB_URI`: Your full MongoDB Atlas connection string
   - `GEMINI_API_KEY`: Your Google Gemini API key
   - `CLIENT_ORIGIN`: Your anticipated Vercel frontend URL, e.g. `https://aura-ai.vercel.app,http://localhost:5173`
   > **CORS Behavior**: The backend accepts comma-separated origins, automatically strips trailing slashes, permits local development origins (`http://localhost:*`, `http://127.0.0.1:*`), and dynamically allows Vercel preview domains (`*.vercel.app`).
6. Under **Advanced Settings**:
   - **Health Check Path**: `/api/health`
7. Click **Create Web Service**. Wait for the build and deployment to complete, then copy your service URL (e.g. `https://aura-backend.onrender.com`).
8. Verify in your browser: visiting `https://aura-backend.onrender.com/api/health` should return `{"status":"ok",...}`.

---

### 3. Frontend Deployment on Vercel
1. Log in to [Vercel](https://vercel.com) and click **Add New... → Project**.
2. Import your GitHub repository (`Aura-AI`).
3. Configure the project settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: Click **Edit** and select `frontend`
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `dist` (default)
   - **Install Command**: `npm install` (default)
4. Under **Environment Variables**, add:
   - `VITE_API_URL`: Your deployed Render backend URL from Step 2 (e.g. `https://aura-backend.onrender.com`, **without** trailing slash).
5. Click **Deploy**.
6. When deployment finishes, copy your live frontend URL (e.g. `https://aura-ai.vercel.app`).
7. **Final CORS Sync**: Return to Render, open your Web Service's **Environment** tab, ensure `CLIENT_ORIGIN` matches your Vercel URL, and save changes. Render will automatically redeploy the service.

> **Note on SPA Routing**: The repository includes `frontend/vercel.json` with rewrite rules pointing all non-asset routes to `/index.html`. This ensures that refreshing deep links like `/chat/:id` functions properly without 404 errors.

---

## Troubleshooting & Known Behaviors

### 1. Backend "CORS blocked by origin policy"
- Verify that `CLIENT_ORIGIN` on Render contains your exact Vercel frontend domain (protocol included, e.g. `https://aura-ai.vercel.app`).
- The backend automatically permits local development (`http://localhost:*`, `http://127.0.0.1:*`) and any `*.vercel.app` preview branch.

### 2. Render Free Tier Spin-Down (Cold Start)
- On Render's free tier, the web service enters sleep mode after 15 minutes of inactivity. The first request after sleep may take 30–50 seconds to respond while the container boots. This is normal behavior for free tier instances.

### 3. MongoDB "querySrv ETIMEOUT" on Windows
- If running locally on Windows and encountering DNS SRV lookup timeouts, `backend/db.js` automatically configures Google (`8.8.8.8`) and Cloudflare (`1.1.1.1`) public DNS servers. On Linux and cloud hosts, this fallback gracefully bypasses if custom DNS is restricted.

### 4. Gemini API High Demand (429 / 503)
- The backend automatically handles temporary model quota limits by cycling through fallback models (`gemini-2.5-flash`, `gemini-3.5-flash`, `gemini-3.7-flash`, etc.) with exponential backoff before returning an error to the user.

---

## License

This project is open-source and available under the [MIT License](LICENSE).
