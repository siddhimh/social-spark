# ✦ Social Spark

AI-powered trend coach for content creators. Paste a YouTube channel or video URL and get TikTok/short-form trend recommendations, full scripts, a weekly content plan, viral potential analysis, content gap insights, and competitor comparisons.

![React](https://img.shields.io/badge/React-19-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue) ![Tailwind](https://img.shields.io/badge/Tailwind-4.2-blue) ![Vite](https://img.shields.io/badge/Vite-7.3-purple)

## Features

- **Channel & Video Analysis** — Fetches data from YouTube Data API v3 (titles, descriptions, tags, views, likes, subscribers)
- **AI Trend Recommendations** — 3 tailored TikTok trend ideas with fit scores, full scripts (hook/body/CTA), captions, hashtags, and comment templates
- **Viral Potential Meter** — Animated SVG gauge scoring hook strength, trend alignment, and audience fit
- **Content Gap Analysis** — Identifies trending topics in your niche you're not covering, with video ideas and example hooks
- **Competitor Comparison** — Side-by-side analysis against any competitor channel with strategic insights
- **Weekly Content Plan** — 4-day posting schedule with format suggestions
- **Copy to Clipboard** — One-click copy on scripts, captions, and comments

## Tech Stack

- **Frontend:** React 19 + TypeScript
- **Styling:** Tailwind CSS 4
- **Build:** Vite 7
- **AI:** Groq API (LLaMA 3.3 70B)
- **Data:** YouTube Data API v3
- **No backend** — runs entirely in the browser

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- A [Groq API key](https://console.groq.com/)
- A [YouTube Data API v3 key](https://console.cloud.google.com/)

### Installation

```bash
git clone https://github.com/your-username/social-spark.git
cd social-spark
npm install
```

### Environment Variables

Create a `.env` file in the project root:

```env
VITE_GROQ_API_KEY=your_groq_api_key_here
VITE_YOUTUBE_API_KEY=your_youtube_api_key_here
```

> **Important:** The `.env` file is listed in `.gitignore` and will NOT be pushed to GitHub.

### Run Locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build for Production

```bash
npm run build
```

The output will be in the `dist/` folder.

## Deploying to Vercel

This app works on Vercel out of the box.

1. Push your repo to GitHub (the `.env` file won't be included)
2. Go to [vercel.com](https://vercel.com) → **New Project** → Import your repo
3. In the Vercel project settings, go to **Settings → Environment Variables** and add:
   - `VITE_GROQ_API_KEY` → your Groq key
   - `VITE_YOUTUBE_API_KEY` → your YouTube key
4. Deploy — Vercel auto-detects Vite and builds it correctly

That's it. No server config needed.

## Project Structure

```
social-spark/
├── .env                  # API keys (git-ignored)
├── .gitignore
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
└── src/
    ├── main.tsx          # Entry point
    ├── index.css         # Tailwind + custom styles
    └── App.tsx           # Entire app (components, API logic, UI)
```

## License

MIT
