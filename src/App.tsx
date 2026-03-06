import { useState, useCallback, useEffect, useRef } from "react";

/* ─── API Keys (loaded from .env) ─── */
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY as string;
const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY as string;

/* ═══════════════════════ TYPES ═══════════════════════ */

interface VideoData {
  title: string;
  description: string;
  tags: string[];
  viewCount: number;
  likeCount: number;
  commentCount: number;
}

interface ChannelData {
  name: string;
  subscriberCount: number;
  videos: VideoData[];
}

interface FullScript {
  hook: string;
  body: string;
  cta: string;
}

interface Trend {
  trend_hook: string;
  format: string;
  fit_score: number;
  fit_reason: string;
  video_concept: string;
  full_script: FullScript;
  caption: string;
  hashtags: string[];
  best_time_to_post: string;
  comment_templates: string[];
}

interface CreatorProfile {
  name: string;
  niche: string;
  content_pillars: string[];
  tone: string;
  top_performing_themes: string[];
  growth_opportunity: string;
}

interface WeeklyAction {
  day: string;
  action: string;
  format: string;
}

interface ViralPotential {
  overall_score: number;
  hook_strength: number;
  trend_alignment: number;
  audience_fit: number;
  score_reason: string;
}

interface ContentGap {
  topic: string;
  opportunity: string;
  difficulty: "Easy" | "Medium" | "Hard";
  suggested_video: string;
  example_hook: string;
}

interface ComparisonCreator {
  name: string;
  niche: string;
  content_pillars: string[];
  tone: string;
  avg_views: string;
}

interface ComparisonResult {
  creator1: ComparisonCreator;
  creator2: ComparisonCreator;
  where_you_win: string[];
  where_they_win: string[];
  your_edge: string;
}

interface AnalysisResult {
  creator_profile: CreatorProfile;
  recommended_trends: Trend[];
  weekly_plan: WeeklyAction[];
  viral_potential: ViralPotential;
  content_gaps: ContentGap[];
}

/* ═══════════════════════ CONSTANTS ═══════════════════════ */

const TRENDING_FORMATS = [
  { format: "POV storytelling", description: "First-person relatable scenario" },
  { format: "Day in my life", description: "Routine vlog with aesthetic cuts" },
  { format: "Hot take + defend it", description: "Controversial opinion with argument" },
  { format: "Before/After transformation", description: "Glow up or process reveal" },
  { format: "Respond to a comment", description: "Use a real comment as the video hook" },
  { format: "Duet bait", description: "End with a question that invites duets" },
  { format: "Storytime", description: "Narrative hook in first 2 seconds" },
  { format: "Tutorial speedrun", description: "Teach something valuable in 30 seconds" },
  { format: "Myth vs reality", description: "Bust a common misconception in your niche" },
];

const LOADING_MESSAGES = [
  "Fetching your content...",
  "Analyzing your style...",
  "Finding trends...",
  "Writing your scripts...",
  "Almost ready...",
];

/* ═══════════════════════ URL PARSING ═══════════════════════ */

function parseYouTubeUrl(url: string): { type: "video"; videoId: string } | { type: "channel"; identifier: string; isHandle: boolean } | null {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    const host = u.hostname.replace("www.", "");
    if (!host.includes("youtube.com") && !host.includes("youtu.be")) return null;

    if (host === "youtu.be") {
      const id = u.pathname.slice(1).split("/")[0];
      if (id) return { type: "video", videoId: id };
    }
    const v = u.searchParams.get("v");
    if (v) return { type: "video", videoId: v };
    if (u.pathname.startsWith("/shorts/")) {
      const id = u.pathname.split("/shorts/")[1]?.split("/")[0];
      if (id) return { type: "video", videoId: id };
    }
    if (u.pathname.startsWith("/@")) {
      const handle = u.pathname.slice(2).split("/")[0];
      if (handle) return { type: "channel", identifier: handle, isHandle: true };
    }
    if (u.pathname.startsWith("/channel/")) {
      const id = u.pathname.split("/channel/")[1]?.split("/")[0];
      if (id) return { type: "channel", identifier: id, isHandle: false };
    }
    if (u.pathname.startsWith("/c/")) {
      const name = u.pathname.split("/c/")[1]?.split("/")[0];
      if (name) return { type: "channel", identifier: name, isHandle: true };
    }
    return null;
  } catch {
    return null;
  }
}

/* ═══════════════════════ YOUTUBE API ═══════════════════════ */

async function fetchVideoData(videoId: string): Promise<VideoData> {
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoId}&key=${YOUTUBE_API_KEY}`
  );
  if (!res.ok) throw new Error(`YouTube API error (${res.status})`);
  const data = await res.json();
  if (!data.items?.length) throw new Error("Video not found. Check the URL and try again.");
  const item = data.items[0];
  return {
    title: item.snippet.title,
    description: item.snippet.description?.slice(0, 500) || "",
    tags: item.snippet.tags?.slice(0, 15) || [],
    viewCount: Number(item.statistics.viewCount || 0),
    likeCount: Number(item.statistics.likeCount || 0),
    commentCount: Number(item.statistics.commentCount || 0),
  };
}

async function fetchChannelData(identifier: string, isHandle: boolean): Promise<ChannelData> {
  const param = isHandle ? `forHandle=${identifier}` : `id=${identifier}`;
  const chRes = await fetch(
    `https://corsproxy.io/?https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&forHandle=${handle}&key=${YOUTUBE_API_KEY}`
  );
  if (!chRes.ok) throw new Error(`YouTube API error (${chRes.status})`);
  const chData = await chRes.json();
  if (!chData.items?.length) throw new Error("Channel not found. Check the URL and try again.");
  const ch = chData.items[0];
  const channelId = ch.id;

  const searchRes = await fetch(
    `https://corsproxy.io/?https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&maxResults=6&order=date&type=video&key=${YOUTUBE_API_KEY}`
  );
  if (!searchRes.ok) throw new Error(`YouTube Search API error (${searchRes.status})`);
  const searchData = await searchRes.json();
  const videoIds = (searchData.items || []).map((item: { id: { videoId: string } }) => item.id.videoId).join(",");
  if (!videoIds) return { name: ch.snippet.title, subscriberCount: Number(ch.statistics.subscriberCount || 0), videos: [] };

  const vidRes = await fetch(
    `https://corsproxy.io/?https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoId}&key=${YOUTUBE_API_KEY}`
  );
  if (!vidRes.ok) throw new Error(`YouTube Videos API error (${vidRes.status})`);
  const vidData = await vidRes.json();

  return {
    name: ch.snippet.title,
    subscriberCount: Number(ch.statistics.subscriberCount || 0),
    videos: (vidData.items || []).map(
      (item: { snippet: { title: string; description: string; tags?: string[] }; statistics: { viewCount?: string; likeCount?: string; commentCount?: string } }) => ({
        title: item.snippet.title,
        description: item.snippet.description?.slice(0, 300) || "",
        tags: item.snippet.tags?.slice(0, 10) || [],
        viewCount: Number(item.statistics.viewCount || 0),
        likeCount: Number(item.statistics.likeCount || 0),
        commentCount: Number(item.statistics.commentCount || 0),
      })
    ),
  };
}

function buildContentSummary(parsed: { type: string }, videoData?: VideoData, channelData?: ChannelData): string {
  if (parsed.type === "video" && videoData) {
    return `Single Video Analysis:
Title: ${videoData.title}
Description: ${videoData.description}
Tags: ${videoData.tags.join(", ")}
Views: ${videoData.viewCount.toLocaleString()}
Likes: ${videoData.likeCount.toLocaleString()}
Comments: ${videoData.commentCount.toLocaleString()}`;
  }
  if (parsed.type === "channel" && channelData) {
    const avgViews = channelData.videos.length
      ? Math.round(channelData.videos.reduce((s, v) => s + v.viewCount, 0) / channelData.videos.length)
      : 0;
    return `Channel Analysis:
Channel: ${channelData.name}
Subscribers: ${channelData.subscriberCount.toLocaleString()}
Average views (last 6): ${avgViews.toLocaleString()}

Recent Videos:
${channelData.videos.map((v, i) => `${i + 1}. "${v.title}" — ${v.viewCount.toLocaleString()} views, ${v.likeCount.toLocaleString()} likes`).join("\n")}

Common Tags: ${[...new Set(channelData.videos.flatMap((v) => v.tags))].slice(0, 20).join(", ")}

Sample Descriptions:
${channelData.videos.slice(0, 2).map((v) => v.description).join("\n---\n")}`;
  }
  return "";
}

/* ═══════════════════════ GROQ API ═══════════════════════ */

async function callGroq(contentSummary: string): Promise<AnalysisResult> {
  const userPrompt = `Analyze this YouTube creator's content and generate TikTok trend recommendations.

Creator Data:
${contentSummary}

Trending formats to map to:
${JSON.stringify(TRENDING_FORMATS, null, 2)}

Return this exact JSON:
{
  "creator_profile": {
    "name": "...",
    "niche": "...",
    "content_pillars": ["...", "...", "..."],
    "tone": "...",
    "top_performing_themes": ["...", "..."],
    "growth_opportunity": "one sentence on what's missing from their content"
  },
  "recommended_trends": [
    {
      "trend_hook": "...",
      "format": "...",
      "fit_score": 94,
      "fit_reason": "...",
      "video_concept": "...",
      "full_script": {
        "hook": "First 3 seconds — exact words to say",
        "body": "Main content — broken into 3-4 beats with stage directions",
        "cta": "Closing line + what to ask viewers"
      },
      "caption": "...",
      "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"],
      "best_time_to_post": "e.g. Tuesday 7pm",
      "comment_templates": ["...", "...", "..."]
    }
  ],
  "weekly_plan": [
    { "day": "Monday", "action": "...", "format": "..." },
    { "day": "Wednesday", "action": "...", "format": "..." },
    { "day": "Friday", "action": "...", "format": "..." },
    { "day": "Saturday", "action": "...", "format": "..." }
  ],
  "viral_potential": {
    "overall_score": 82,
    "hook_strength": 78,
    "trend_alignment": 88,
    "audience_fit": 80,
    "score_reason": "one sentence explaining the viral potential score"
  },
  "content_gaps": [
    {
      "topic": "trending topic they are NOT covering",
      "opportunity": "why this is an opportunity for them",
      "difficulty": "Easy or Medium or Hard",
      "suggested_video": "a specific video idea to fill this gap",
      "example_hook": "an example hook line for that video"
    }
  ]
}
Return exactly 3 trend recommendations ranked by fit_score descending. Return exactly 4 content_gaps. All viral_potential scores should be 0-100.`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_API_KEY}` },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      max_tokens: 3500,
      temperature: 0.8,
      messages: [
        { role: "system", content: "You are Social Spark, an elite short-form content strategist. You analyze YouTube creators and generate highly specific, platform-native TikTok trend recommendations with full production-ready scripts. Always respond in valid JSON only. No markdown, no preamble." },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Groq API error (${res.status}): ${errBody}`);
  }

  const data = await res.json();
  let raw: string = data.choices[0].message.content;
  raw = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();

  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("AI did not return valid JSON. Please try again.");
  }
  raw = raw.slice(firstBrace, lastBrace + 1);

  let parsed: AnalysisResult;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const sanitized = raw.replace(/"(?:[^"\\]|\\.)*"/g, (match) =>
      match.replace(/[\x00-\x1F\x7F]/g, (ch) => {
        if (ch === "\n") return "\\n";
        if (ch === "\r") return "\\r";
        if (ch === "\t") return "\\t";
        return " ";
      })
    );
    parsed = JSON.parse(sanitized);
  }

  if (!parsed.creator_profile || !parsed.recommended_trends) {
    throw new Error("AI response missing required fields.");
  }
  return parsed;
}

/* ═══════════════════════ COMPETITOR GROQ CALL ═══════════════════════ */

async function callGroqComparison(creator1Summary: string, creator2Summary: string): Promise<ComparisonResult> {
  const userPrompt = `Compare these two YouTube creators for short-form content strategy.

Creator 1 (the user): ${creator1Summary}
Creator 2 (competitor): ${creator2Summary}

Return this JSON:
{
  "creator1": {
    "name": "...",
    "niche": "...",
    "content_pillars": ["...", "...", "..."],
    "tone": "...",
    "avg_views": "..."
  },
  "creator2": {
    "name": "...",
    "niche": "...",
    "content_pillars": ["...", "...", "..."],
    "tone": "...",
    "avg_views": "..."
  },
  "where_you_win": ["...", "...", "..."],
  "where_they_win": ["...", "...", "..."],
  "your_edge": "one bold strategic recommendation to differentiate"
}`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_API_KEY}` },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      max_tokens: 1500,
      temperature: 0.7,
      messages: [
        { role: "system", content: "You are a social media strategist. Respond in valid JSON only. No markdown, no preamble." },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Groq API error (${res.status}): ${errBody}`);
  }

  const data = await res.json();
  let raw: string = data.choices[0].message.content;
  raw = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();

  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("AI did not return valid comparison JSON.");
  }
  raw = raw.slice(firstBrace, lastBrace + 1);

  let parsed: ComparisonResult;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const sanitized = raw.replace(/"(?:[^"\\]|\\.)*"/g, (match) =>
      match.replace(/[\x00-\x1F\x7F]/g, (ch) => {
        if (ch === "\n") return "\\n";
        if (ch === "\r") return "\\r";
        if (ch === "\t") return "\\t";
        return " ";
      })
    );
    parsed = JSON.parse(sanitized);
  }

  if (!parsed.creator1 || !parsed.creator2) {
    throw new Error("Comparison response missing required fields.");
  }
  return parsed;
}

/* ═══════════════════════ SMALL COMPONENTS ═══════════════════════ */

function CopyBtn({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer
                 text-warm-text-dim hover:text-warm-text bg-cream hover:bg-cream-dark border border-warm-border"
    >
      {copied ? (
        <>
          <svg className="w-3 h-3 text-score-green" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
          Copied!
        </>
      ) : (
        <>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
          {label}
        </>
      )}
    </button>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const style = score >= 80
    ? "text-score-green bg-score-green-bg border-score-green/20"
    : score >= 60
      ? "text-score-yellow bg-score-yellow-bg border-score-yellow/20"
      : "text-score-red bg-score-red-bg border-score-red/20";
  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${style}`}>
      ★ {score}%
    </span>
  );
}

function Pill({ children, variant = "default" }: { children: React.ReactNode; variant?: "default" | "honey" | "tag" }) {
  const styles = {
    default: "bg-cream-dark border-warm-border text-warm-text-secondary",
    honey: "bg-honey-bg border-honey/20 text-honey-dark",
    tag: "bg-cream border-warm-border text-warm-text-dim hover:bg-cream-dark transition-colors",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium border ${styles[variant]}`}>
      {children}
    </span>
  );
}

/* ═══════════════════════ TREND CARD ═══════════════════════ */

function TrendCard({ trend, index }: { trend: Trend; index: number }) {
  const [tab, setTab] = useState("concept");
  const tabs = [
    { key: "concept", label: "Concept" },
    { key: "script", label: "Script" },
    { key: "caption", label: "Caption" },
    { key: "engage", label: "Engage" },
  ];

  const accentBorder = trend.fit_score >= 80 ? "border-l-score-green/40"
    : trend.fit_score >= 60 ? "border-l-honey/40" : "border-l-score-red/40";

  const renderTab = () => {
    switch (tab) {
      case "concept":
        return <p className="text-warm-text-secondary text-sm leading-relaxed">{trend.video_concept}</p>;
      case "script":
        return (
          <div className="space-y-3">
            {(["hook", "body", "cta"] as const).map((section) => (
              <div key={section} className="rounded-xl bg-cream border border-warm-border p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-warm-muted">
                    {section === "cta" ? "Call to Action" : section === "hook" ? "Hook (0-3s)" : "Body"}
                  </span>
                  <CopyBtn text={trend.full_script[section]} />
                </div>
                <p className="text-sm text-warm-text leading-relaxed font-mono whitespace-pre-line">
                  {trend.full_script[section]}
                </p>
              </div>
            ))}
          </div>
        );
      case "caption":
        return (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-warm-muted">Caption</span>
                <CopyBtn text={`${trend.caption}\n\n${trend.hashtags.join(" ")}`} />
              </div>
              <p className="text-sm text-warm-text-secondary leading-relaxed">{trend.caption}</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {trend.hashtags.map((h, i) => <Pill key={i} variant="tag">{h}</Pill>)}
            </div>
            <div className="flex items-center gap-2 pt-3 border-t border-warm-border">
              <svg className="w-3.5 h-3.5 text-warm-muted" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
              <span className="text-xs text-warm-text-secondary">Best time: <span className="text-warm-text font-semibold">{trend.best_time_to_post}</span></span>
            </div>
          </div>
        );
      case "engage":
        return (
          <div className="space-y-2.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-warm-muted block mb-3">Pin one of these comments</span>
            {trend.comment_templates.map((c, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-cream border border-warm-border group">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-honey-bg text-honey-dark flex items-center justify-center text-[10px] font-bold mt-0.5">{i + 1}</span>
                <p className="text-sm text-warm-text-secondary leading-relaxed flex-1">{c}</p>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity"><CopyBtn text={c} label="" /></div>
              </div>
            ))}
          </div>
        );
      default: return null;
    }
  };

  const trendColors = [
    { bg: "bg-honey-bg/40", border: "border-honey/10", num: "bg-honey text-white" },
    { bg: "bg-score-green-bg/40", border: "border-score-green/10", num: "bg-score-green text-white" },
    { bg: "bg-score-yellow-bg/40", border: "border-score-yellow/10", num: "bg-score-yellow text-white" },
  ];
  const colorSet = trendColors[index % trendColors.length];

  return (
    <div
      className={`bg-warm-card rounded-2xl border border-warm-border ${accentBorder} border-l-[3px] card-elevated animate-fade-up relative overflow-hidden`}
      style={{ animationDelay: `${index * 0.12}s` }}
    >
      {/* Decorative background gradient blob */}
      <div className={`absolute -top-12 -right-12 w-40 h-40 rounded-full ${colorSet.bg} blur-3xl pointer-events-none`} />
      <div className={`absolute -bottom-8 -left-8 w-28 h-28 rounded-full ${colorSet.bg} blur-2xl pointer-events-none`} />

      <div className="p-6 relative z-10">
        {/* Trend number + header */}
        <div className="flex items-start gap-4 mb-3">
          <div className={`flex-shrink-0 w-10 h-10 rounded-xl ${colorSet.num} flex items-center justify-center text-sm font-bold shadow-sm`}>
            {index + 1}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3 mb-1">
              <h3 className="text-lg font-bold text-warm-text leading-snug flex-1 font-[Georgia,serif]">{trend.trend_hook}</h3>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Pill variant="honey">{trend.format}</Pill>
                <ScoreBadge score={trend.fit_score} />
              </div>
            </div>
            <p className="text-xs italic text-warm-muted">{trend.fit_reason}</p>
          </div>
        </div>

        {/* Divider with sparkle */}
        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-warm-border" />
          <span className="text-warm-muted text-[10px]">✦</span>
          <div className="flex-1 h-px bg-warm-border" />
        </div>

        <div className="flex gap-0.5 p-1 rounded-xl bg-cream border border-warm-border mb-5">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                tab === t.key
                  ? "bg-warm-card text-warm-text shadow-sm border border-warm-border"
                  : "text-warm-muted hover:text-warm-text-secondary border border-transparent"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="min-h-[140px]">{renderTab()}</div>
      </div>
    </div>
  );
}

/* ═══════════════════════ VIRAL POTENTIAL METER ═══════════════════════ */

function ViralPotentialMeter({ vp }: { vp: ViralPotential }) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const [barWidths, setBarWidths] = useState({ hook: 0, trend: 0, audience: 0 });

  useEffect(() => {
    const duration = 1500;
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedScore(Math.round(eased * vp.overall_score));
      setBarWidths({
        hook: eased * vp.hook_strength,
        trend: eased * vp.trend_alignment,
        audience: eased * vp.audience_fit,
      });
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [vp]);

  // SVG arc gauge
  const radius = 70;
  const strokeWidth = 10;
  const center = 85;
  // Semi-circle: from 180° to 0° (left to right, top half)
  const circumference = Math.PI * radius;
  const fillLength = (animatedScore / 100) * circumference;
  const dashArray = `${fillLength} ${circumference - fillLength}`;

  const scoreColor = animatedScore >= 71 ? "#3d8b5e" : animatedScore >= 41 ? "#a68b2d" : "#c45c5c";
  const scoreBg = animatedScore >= 71 ? "bg-score-green-bg" : animatedScore >= 41 ? "bg-score-yellow-bg" : "bg-score-red-bg";
  const scoreLabel = animatedScore >= 71 ? "High" : animatedScore >= 41 ? "Medium" : "Low";

  const subScores = [
    { label: "Hook Strength", value: barWidths.hook, target: vp.hook_strength },
    { label: "Trend Alignment", value: barWidths.trend, target: vp.trend_alignment },
    { label: "Audience Fit", value: barWidths.audience, target: vp.audience_fit },
  ];

  return (
    <div className="p-6 rounded-2xl bg-warm-card border border-warm-border card-elevated animate-fade-up">
      <h3 className="text-sm font-bold text-warm-text mb-5 flex items-center gap-2 font-[Georgia,serif]">
        <span className="text-base">🔥</span> Viral Potential
      </h3>

      {/* Arc gauge */}
      <div className="flex justify-center mb-4">
        <div className="relative">
          <svg width={center * 2} height={center + 10} viewBox={`0 0 ${center * 2} ${center + 10}`}>
            {/* Background arc */}
            <path
              d={`M ${center - radius} ${center} A ${radius} ${radius} 0 0 1 ${center + radius} ${center}`}
              fill="none"
              stroke="#e5e0d8"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />
            {/* Color zone markers (subtle) */}
            <path
              d={`M ${center - radius} ${center} A ${radius} ${radius} 0 0 1 ${center + radius} ${center}`}
              fill="none"
              stroke={scoreColor}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={dashArray}
              style={{ transition: "stroke-dasharray 0.1s ease-out" }}
            />
            {/* Zone ticks */}
            {[0, 40, 70, 100].map((tick) => {
              const angle = Math.PI - (tick / 100) * Math.PI;
              const x1 = center + (radius - strokeWidth / 2 - 2) * Math.cos(angle);
              const y1 = center - (radius - strokeWidth / 2 - 2) * Math.sin(angle);
              const x2 = center + (radius + strokeWidth / 2 + 2) * Math.cos(angle);
              const y2 = center - (radius + strokeWidth / 2 + 2) * Math.sin(angle);
              return <line key={tick} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#d4cec4" strokeWidth="1.5" />;
            })}
          </svg>
          {/* Score text in center */}
          <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
            <span className="text-3xl font-extrabold text-warm-text" style={{ color: scoreColor }}>
              {animatedScore}
            </span>
            <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full mt-1 ${scoreBg}`} style={{ color: scoreColor }}>
              {scoreLabel}
            </span>
          </div>
        </div>
      </div>

      <p className="text-xs text-warm-text-secondary italic text-center mb-5 leading-relaxed">{vp.score_reason}</p>

      {/* Sub-scores */}
      <div className="space-y-3.5">
        {subScores.map((s) => {
          const barColor = s.target >= 71 ? "bg-score-green" : s.target >= 41 ? "bg-honey" : "bg-score-red";
          return (
            <div key={s.label}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-medium text-warm-text-secondary">{s.label}</span>
                <span className="text-[11px] font-bold text-warm-text">{Math.round(s.value)}%</span>
              </div>
              <div className="h-2 rounded-full bg-cream-dark overflow-hidden">
                <div
                  className={`h-full rounded-full ${barColor} transition-all duration-100 ease-out`}
                  style={{ width: `${s.value}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════ CONTENT GAP ANALYSIS ═══════════════════════ */

function ContentGapCard({ gaps }: { gaps: ContentGap[] }) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const difficultyStyles: Record<string, string> = {
    Easy: "bg-score-green-bg text-score-green border-score-green/20",
    Medium: "bg-score-yellow-bg text-score-yellow border-score-yellow/20",
    Hard: "bg-score-red-bg text-score-red border-score-red/20",
  };

  return (
    <div className="p-6 rounded-2xl bg-warm-card border border-warm-border card-elevated animate-fade-up" style={{ animationDelay: "0.15s" }}>
      <h3 className="text-sm font-bold text-warm-text mb-5 flex items-center gap-2 font-[Georgia,serif]">
        <span className="text-base">🔍</span> Content Gaps
      </h3>

      <div className="space-y-2">
        {(gaps || []).map((gap, i) => {
          const isExpanded = expandedIdx === i;
          return (
            <div key={i}>
              <button
                onClick={() => setExpandedIdx(isExpanded ? null : i)}
                className="w-full text-left p-3.5 rounded-xl bg-cream border border-warm-border hover:bg-cream-dark
                           transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <span className="text-sm font-bold text-warm-text group-hover:text-honey-dark transition-colors">{gap.topic}</span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${difficultyStyles[gap.difficulty] || difficultyStyles.Medium}`}>
                      {gap.difficulty}
                    </span>
                    <svg className={`w-3.5 h-3.5 text-warm-muted transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
                    </svg>
                  </div>
                </div>
                <p className="text-[11px] text-warm-text-dim leading-relaxed">{gap.opportunity}</p>
              </button>

              {/* Expanded detail */}
              <div
                className="overflow-hidden transition-all duration-300 ease-in-out"
                style={{ maxHeight: isExpanded ? "200px" : "0px", opacity: isExpanded ? 1 : 0 }}
              >
                <div className="mx-2 mt-1 mb-1 p-4 rounded-xl bg-honey-bg/30 border border-honey/10 space-y-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-honey-dark block mb-1">💡 Video Idea</span>
                    <p className="text-xs text-warm-text-secondary leading-relaxed">{gap.suggested_video}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-honey-dark block mb-1">🎣 Example Hook</span>
                    <p className="text-xs text-warm-text italic leading-relaxed">"{gap.example_hook}"</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════ COMPETITOR COMPARISON ═══════════════════════ */

function CompetitorComparison({ creatorSummary }: { creatorSummary: string }) {
  const [compUrl, setCompUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ComparisonResult | null>(null);

  const handleCompare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!compUrl.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const parsed = parseYouTubeUrl(compUrl.trim());
      if (!parsed || parsed.type !== "channel") throw new Error("Please paste a valid YouTube channel URL (not a video).");
      const channelData = await fetchChannelData(parsed.identifier, parsed.isHandle);
      const compSummary = buildContentSummary(parsed, undefined, channelData);
      if (!compSummary) throw new Error("Could not fetch competitor data.");
      const comparison = await callGroqComparison(creatorSummary, compSummary);
      setResult(comparison);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Comparison failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-up" style={{ animationDelay: "0.3s" }}>
      {/* Section header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 h-px bg-warm-border" />
        <h3 className="text-sm font-bold text-warm-text flex items-center gap-2 font-[Georgia,serif]">
          <span className="text-base">⚔️</span> Competitor Comparison
        </h3>
        <div className="flex-1 h-px bg-warm-border" />
      </div>

      {/* Input bar */}
      <form onSubmit={handleCompare} className="flex gap-3 mb-6">
        <input
          value={compUrl}
          onChange={(e) => setCompUrl(e.target.value)}
          placeholder="Paste a competitor's YouTube channel URL"
          className="flex-1 px-4 py-3 bg-cream rounded-xl text-warm-text text-sm placeholder-warm-muted
                     border border-warm-border focus:outline-none focus:border-honey focus:ring-2 focus:ring-honey/15 transition-all"
        />
        <button
          type="submit"
          disabled={!compUrl.trim() || loading}
          className="px-5 py-3 rounded-xl font-semibold text-sm text-warm-text
                     bg-honey-light hover:bg-honey/30 border border-honey/30
                     disabled:opacity-30 disabled:cursor-not-allowed
                     transition-all duration-200 flex items-center gap-2 cursor-pointer flex-shrink-0"
        >
          {loading ? (
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 border-2 border-warm-text/30 border-t-warm-text rounded-full animate-spin" />
              Comparing...
            </div>
          ) : (
            <>Compare <span>→</span></>
          )}
        </button>
      </form>

      {error && (
        <div className="p-4 rounded-xl bg-score-red-bg/50 border border-score-red/15 mb-6 animate-fade-in">
          <p className="text-xs text-score-red">{error}</p>
        </div>
      )}

      {/* Comparison result */}
      {result && (
        <div className="space-y-5 animate-fade-up">
          {/* Side-by-side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Your channel */}
            <div className="p-5 rounded-2xl bg-warm-card border border-warm-border card-elevated relative overflow-hidden">
              <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-score-green-bg/40 blur-2xl pointer-events-none" />
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-lg bg-score-green-bg border border-score-green/20 flex items-center justify-center">
                    <span className="text-[10px]">👤</span>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-score-green">Your Channel</span>
                </div>
                <h4 className="text-base font-bold text-warm-text mb-2 font-[Georgia,serif]">{result.creator1.name}</h4>
                <div className="space-y-2.5">
                  <div className="flex items-center gap-1.5">
                    <Pill variant="honey">{result.creator1.niche}</Pill>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {result.creator1.content_pillars.map((p, i) => <Pill key={i}>{p}</Pill>)}
                  </div>
                  <div className="flex items-center justify-between text-xs text-warm-text-secondary pt-2 border-t border-warm-border">
                    <span>Tone: <span className="text-warm-text font-medium">{result.creator1.tone}</span></span>
                    <span>Avg Views: <span className="text-warm-text font-medium">{result.creator1.avg_views}</span></span>
                  </div>
                </div>
              </div>
            </div>

            {/* Competitor */}
            <div className="p-5 rounded-2xl bg-warm-card border border-warm-border card-elevated relative overflow-hidden">
              <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-score-red-bg/40 blur-2xl pointer-events-none" />
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-lg bg-score-red-bg border border-score-red/20 flex items-center justify-center">
                    <span className="text-[10px]">⚔️</span>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-score-red">Competitor</span>
                </div>
                <h4 className="text-base font-bold text-warm-text mb-2 font-[Georgia,serif]">{result.creator2.name}</h4>
                <div className="space-y-2.5">
                  <div className="flex items-center gap-1.5">
                    <Pill variant="honey">{result.creator2.niche}</Pill>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {result.creator2.content_pillars.map((p, i) => <Pill key={i}>{p}</Pill>)}
                  </div>
                  <div className="flex items-center justify-between text-xs text-warm-text-secondary pt-2 border-t border-warm-border">
                    <span>Tone: <span className="text-warm-text font-medium">{result.creator2.tone}</span></span>
                    <span>Avg Views: <span className="text-warm-text font-medium">{result.creator2.avg_views}</span></span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Win/Lose analysis */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Where you're winning */}
            <div className="p-5 rounded-2xl bg-warm-card border border-warm-border card-inset">
              <span className="text-[10px] font-bold uppercase tracking-widest text-score-green block mb-3">✅ Where you're winning</span>
              <div className="space-y-2">
                {(result.where_you_win || []).map((w, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <svg className="w-4 h-4 text-score-green flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                    </svg>
                    <p className="text-xs text-warm-text-secondary leading-relaxed">{w}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Where they're winning */}
            <div className="p-5 rounded-2xl bg-warm-card border border-warm-border card-inset">
              <span className="text-[10px] font-bold uppercase tracking-widest text-score-red block mb-3">❌ Where they're winning</span>
              <div className="space-y-2">
                {(result.where_they_win || []).map((w, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <svg className="w-4 h-4 text-score-red flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                    <p className="text-xs text-warm-text-secondary leading-relaxed">{w}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Your Edge */}
          <div className="p-5 rounded-2xl bg-honey-bg/40 border border-honey/15 relative overflow-hidden">
            <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-honey-bg blur-2xl pointer-events-none" />
            <div className="relative z-10">
              <span className="text-[10px] font-bold uppercase tracking-widest text-honey-dark block mb-2">🏆 Your Strategic Edge</span>
              <p className="text-sm font-semibold text-warm-text leading-relaxed">{result.your_edge}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════ INPUT SCREEN ═══════════════════════ */

function InputScreen({ onAnalyze }: { onAnalyze: (url: string) => void }) {
  const [mode, setMode] = useState<"channel" | "video">("channel");
  const [url, setUrl] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    onAnalyze(url.trim());
  };

  return (
    <div className="min-h-screen bg-cream grid-pattern flex flex-col">
      {/* Nav */}
      <nav className="px-8 sm:px-12 pt-8 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-honey-bg border border-honey/20 flex items-center justify-center">
            <span className="text-sm">✦</span>
          </div>
          <span className="text-base font-bold tracking-tight text-warm-text">Social Spark</span>
        </div>
        <span className="text-[11px] text-warm-muted hidden sm:block">AI Trend Coach for Creators</span>
      </nav>

      {/* Center hero */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-xl animate-fade-up">
          <div className="text-center mb-12">
            <h1 className="text-4xl sm:text-[3.25rem] font-extrabold text-warm-text leading-[1.1] mb-4 font-[Georgia,serif] tracking-tight">
              Know What To Post Next.
            </h1>
            <p className="text-warm-text-secondary text-base sm:text-lg max-w-md mx-auto leading-relaxed">
            Understand what works for your audience and plan your next viral videos.
            </p>
          </div>

          {/* Card */}
          <div className="bg-warm-card rounded-2xl border border-warm-border p-6 sm:p-8 card-elevated">
            {/* Tabs */}
            <div className="flex gap-0 mb-6 border-b border-warm-border">
              {(["channel", "video"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setUrl(""); inputRef.current?.focus(); }}
                  className={`px-5 py-3 text-sm font-medium transition-all cursor-pointer relative ${
                    mode === m ? "text-warm-text" : "text-warm-muted hover:text-warm-text-secondary"
                  }`}
                >
                  {m === "channel" ? "📺 Channel" : "🎬 Video"}
                  {mode === m && <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-honey rounded-full" />}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <input
                  ref={inputRef}
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder={mode === "channel" ? "Paste your YouTube channel URL" : "Paste a YouTube video URL"}
                  className="w-full px-4 py-3.5 bg-cream rounded-xl text-warm-text text-sm placeholder-warm-muted
                             border border-warm-border focus:outline-none focus:border-honey focus:ring-2 focus:ring-honey/15 transition-all"
                />
                <p className="text-[11px] text-warm-muted mt-2 pl-1">
                  {mode === "channel"
                    ? "e.g. youtube.com/@MrBeast or youtube.com/channel/UC..."
                    : "e.g. youtube.com/watch?v=dQw4w9WgXcQ"}
                </p>
              </div>

              <button
                type="submit"
                disabled={!url.trim()}
                className="w-full py-3.5 rounded-xl font-semibold text-sm text-warm-text
                           bg-honey-light hover:bg-honey/30 border border-honey/30
                           disabled:opacity-30 disabled:cursor-not-allowed
                           transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
              >
                Analyze
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"/>
                </svg>
              </button>
            </form>
          </div>

          {/* Features */}
          <div className="grid grid-cols-3 gap-4 mt-8">
            {[
              { icon: "📊", label: "Channel Analysis" },
              { icon: "✍️", label: "Full Scripts" },
              { icon: "📅", label: "Weekly Plan" },
            ].map((f) => (
              <div key={f.label} className="text-center p-3 rounded-xl bg-warm-card border border-warm-border card-inset">
                <span className="text-lg block mb-1">{f.icon}</span>
                <span className="text-[11px] text-warm-text-dim font-medium">{f.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-8 sm:px-12 pb-6 flex items-center justify-between">
        <p className="text-[11px] text-warm-muted">Powered by Groq + YouTube Data API</p>
        <p className="text-[11px] text-warm-muted">© 2026 Social Spark</p>
      </div>
    </div>
  );
}

/* ═══════════════════════ LOADING SCREEN ═══════════════════════ */

function LoadingScreen() {
  const [msgIdx, setMsgIdx] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setMsgIdx((i) => (i + 1) % LOADING_MESSAGES.length), 1500);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-cream grid-pattern flex flex-col items-center justify-center px-6">
      <div className="text-center space-y-8 animate-fade-up">
        <div className="flex items-center justify-center gap-2.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2.5 h-2.5 rounded-full bg-honey animate-dot-bounce"
              style={{ animationDelay: `${i * 0.16}s` }}
            />
          ))}
        </div>
      <div>
          <p className="text-warm-text-secondary text-sm font-medium h-5" key={msgIdx}>
            {LOADING_MESSAGES[msgIdx]}
          </p>
        </div>
        {/* Skeleton */}
        <div className="w-full max-w-sm space-y-3 mt-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-warm-card rounded-xl border border-warm-border p-5 space-y-2.5 card-inset"
              style={{ animationDelay: `${i * 0.2}s` }}>
              <div className="h-4 w-3/4 rounded-lg bg-cream-dark animate-pulse" />
              <div className="h-3 w-1/2 rounded-lg bg-cream-dark animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════ ERROR SCREEN ═══════════════════════ */

function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="min-h-screen bg-cream grid-pattern flex items-center justify-center px-6">
      <div className="max-w-sm w-full text-center space-y-5 animate-fade-up">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-score-red-bg border border-score-red/15 flex items-center justify-center">
          <svg className="w-6 h-6 text-score-red" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/>
          </svg>
        </div>
        <div>
          <h3 className="text-base font-bold text-warm-text mb-1 font-[Georgia,serif]">Something went wrong</h3>
          <p className="text-sm text-warm-text-secondary leading-relaxed">{message}</p>
        </div>
        <button
          onClick={onRetry}
          className="px-6 py-2.5 rounded-xl text-sm font-medium bg-warm-card border border-warm-border text-warm-text
                     hover:bg-cream-dark transition cursor-pointer card-inset"
        >
          ← Try again
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════ DECORATIVE SVGs ═══════════════════════ */

function DecoHexagons({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M100 10L170 50V130L100 170L30 130V50L100 10Z" stroke="currentColor" strokeWidth="0.5" opacity="0.15" />
      <path d="M100 40L145 65V115L100 140L55 115V65L100 40Z" stroke="currentColor" strokeWidth="0.5" opacity="0.1" />
      <path d="M100 70L120 82V106L100 118L80 106V82L100 70Z" stroke="currentColor" strokeWidth="0.5" opacity="0.08" />
    </svg>
  );
}

function DecoFlow({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 400 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M0 60C50 60 50 20 100 20C150 20 150 100 200 100C250 100 250 40 300 40C350 40 350 80 400 80"
        stroke="currentColor" strokeWidth="1" strokeDasharray="4 6" opacity="0.12" />
      <path d="M0 80C60 80 60 40 120 40C180 40 180 90 240 90C300 90 300 30 360 30"
        stroke="currentColor" strokeWidth="0.8" strokeDasharray="3 8" opacity="0.08" />
      <circle cx="100" cy="20" r="3" fill="currentColor" opacity="0.1" />
      <circle cx="200" cy="100" r="3" fill="currentColor" opacity="0.1" />
      <circle cx="300" cy="40" r="3" fill="currentColor" opacity="0.1" />
    </svg>
  );
}

function DecoSparkle({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0L13.4 8.6L22 10L13.4 11.4L12 20L10.6 11.4L2 10L10.6 8.6L12 0Z" opacity="0.15" />
    </svg>
  );
}

function DecoDots({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 40" fill="currentColor">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <circle key={i} cx={10 + i * 22} cy="20" r={2 + (i % 3)} opacity={0.06 + (i % 3) * 0.04} />
      ))}
      <line x1="10" y1="20" x2="120" y2="20" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 8" opacity="0.06" />
    </svg>
  );
}

/* ═══════════════════════ RESULTS SCREEN ═══════════════════════ */

function ResultsScreen({ data, onBack, creatorSummary }: { data: AnalysisResult; onBack: () => void; creatorSummary: string }) {
  const { creator_profile: cp, recommended_trends: trends, weekly_plan: plan, viral_potential: vp, content_gaps: gaps } = data;

  return (
    <div className="min-h-screen bg-cream">
      <div className="flex flex-col xl:flex-row min-h-screen">

        {/* ── LEFT SIDEBAR ── */}
        <aside className="w-full xl:w-[340px] xl:flex-shrink-0 xl:sticky xl:top-0 xl:h-screen xl:overflow-y-auto border-b xl:border-b-0 xl:border-r border-warm-border bg-warm-white relative">
          {/* Decorative hex pattern in sidebar background */}
          <DecoHexagons className="absolute top-4 right-4 w-32 h-32 text-honey pointer-events-none" />
          <DecoHexagons className="absolute bottom-20 left-2 w-24 h-24 text-warm-muted pointer-events-none rotate-45" />

          <div className="p-6 xl:p-7 space-y-5 relative z-10">
            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-honey-bg border border-honey/20 flex items-center justify-center">
                <span className="text-sm">✦</span>
              </div>
              <span className="text-base font-bold tracking-tight text-warm-text">Social Spark</span>
            </div>

            {/* Creator Profile */}
            <div className="space-y-4 animate-fade-up">
              <div className="p-5 rounded-2xl bg-warm-card border border-warm-border card-elevated relative overflow-hidden">
                {/* Decorative corner sparkle */}
                <DecoSparkle className="absolute -top-1 -right-1 w-10 h-10 text-honey" />

                <h2 className="text-lg font-bold text-warm-text font-[Georgia,serif] mb-2">{cp.name}</h2>
                <div className="mb-4"><Pill variant="honey">{cp.niche}</Pill></div>

                <div className="space-y-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-warm-muted block mb-2">Content Pillars</span>
                    <div className="flex flex-wrap gap-1.5">
                      {cp.content_pillars.map((p, i) => <Pill key={i}>{p}</Pill>)}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-warm-muted block mb-1">Tone</span>
                    <p className="text-sm text-warm-text-secondary leading-relaxed">{cp.tone}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-warm-muted block mb-2">Top Themes</span>
                    <div className="flex flex-wrap gap-1.5">
                      {cp.top_performing_themes.map((t, i) => <Pill key={i}>{t}</Pill>)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Growth Opportunity */}
              <div className="p-4 rounded-xl bg-honey-bg/50 border border-honey/15 relative overflow-hidden">
                <DecoSparkle className="absolute top-2 right-2 w-6 h-6 text-honey/40" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-honey-dark block mb-1.5">💡 Growth Opportunity</span>
                <p className="text-xs text-warm-text-secondary italic leading-relaxed">{cp.growth_opportunity}</p>
              </div>

              {/* Weekly Plan */}
              <div className="animate-fade-up" style={{ animationDelay: "0.15s" }}>
                <span className="text-[10px] font-bold uppercase tracking-widest text-warm-muted block mb-3">📅 Weekly Plan</span>
                <div className="space-y-2">
                  {(plan || []).map((item, i) => (
                    <div key={i} className="p-3.5 rounded-xl bg-warm-card border border-warm-border card-inset">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-warm-text">{item.day}</span>
                        <Pill variant="honey">{item.format}</Pill>
                      </div>
                      <p className="text-[11px] text-warm-text-secondary leading-relaxed">{item.action}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* ── MAIN CENTER CONTENT ── */}
        <main className="flex-1 min-w-0 pb-20 relative">
          {/* Background decoration */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <DecoHexagons className="absolute top-8 right-8 w-48 h-48 text-warm-muted" />
            <DecoSparkle className="absolute top-24 right-56 w-8 h-8 text-honey animate-pulse-soft" />
            <DecoSparkle className="absolute top-80 right-12 w-6 h-6 text-warm-muted animate-pulse-soft" style={{ animationDelay: "1s" }} />
          </div>

          <div className="p-6 lg:p-10 max-w-3xl relative z-10">
            {/* Header with decorative flow */}
            <div className="mb-10 animate-fade-up">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-2xl font-bold text-warm-text font-[Georgia,serif]">Recommended Trends</h2>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-honey-bg border border-honey/20 text-honey-dark">
                  {trends.length}
                </span>
              </div>
              <DecoDots className="w-48 h-6 text-warm-muted -ml-1" />
            </div>

            {/* Trend cards with connectors */}
            <div className="space-y-6 relative">
              {/* Vertical connector line */}
              <div className="absolute left-7 top-8 bottom-8 w-px border-l border-dashed border-warm-border hidden lg:block" />

              {trends.map((trend, i) => (
                <div key={i} className="relative">
                  {/* Connector dot */}
                  <div className="absolute left-5 top-8 w-5 h-5 rounded-full bg-cream border-2 border-warm-border z-10 hidden lg:flex items-center justify-center">
                    <div className={`w-2 h-2 rounded-full ${
                      trend.fit_score >= 80 ? "bg-score-green" : trend.fit_score >= 60 ? "bg-honey" : "bg-score-red"
                    }`} />
                  </div>

                  {/* Card with left padding for connector */}
                  <div className="lg:pl-14">
                    {/* Decorative flow between cards */}
                    {i < trends.length - 1 && (
                      <DecoFlow className="w-full h-8 text-warm-muted mt-2 hidden lg:block" />
                    )}
                    <TrendCard trend={trend} index={i} />
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom decorative element */}
            <div className="mt-12 flex items-center gap-4 animate-fade-up" style={{ animationDelay: "0.4s" }}>
              <div className="flex-1 h-px bg-warm-border" />
              <div className="flex items-center gap-2">
                <DecoSparkle className="w-4 h-4 text-honey" />
                <span className="text-[11px] text-warm-muted font-medium">End of recommendations</span>
                <DecoSparkle className="w-4 h-4 text-honey" />
              </div>
              <div className="flex-1 h-px bg-warm-border" />
            </div>

            {/* ── COMPETITOR COMPARISON ── */}
            <div className="mt-12 lg:pl-14">
              <CompetitorComparison creatorSummary={creatorSummary} />
            </div>
          </div>
        </main>

        {/* ── RIGHT PANEL ── */}
        <aside className="w-full xl:w-[320px] xl:flex-shrink-0 xl:sticky xl:top-0 xl:h-screen xl:overflow-y-auto border-t xl:border-t-0 xl:border-l border-warm-border bg-warm-white">
          <div className="p-6 xl:p-7 space-y-5">
            {vp && <ViralPotentialMeter vp={vp} />}
            {gaps && gaps.length > 0 && <ContentGapCard gaps={gaps} />}
          </div>
        </aside>
      </div>

      {/* ── BOTTOM BAR ── */}
      <div className="fixed bottom-0 left-0 right-0 bg-warm-white/80 backdrop-blur-sm border-t border-warm-border z-20">
        <div className="max-w-6xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-xs font-medium text-warm-text-dim hover:text-warm-text transition cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"/>
            </svg>
            Analyze another creator
          </button>
          <span className="text-[10px] text-warm-muted">✦ Social Spark</span>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════ APP ═══════════════════════ */

export default function App() {
  const [screen, setScreen] = useState<"input" | "loading" | "results" | "error">("input");
  const [results, setResults] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState("");
  const [creatorSummary, setCreatorSummary] = useState("");

  const handleAnalyze = useCallback(async (url: string) => {
    setScreen("loading");
    setError("");
    try {
      const parsed = parseYouTubeUrl(url);
      if (!parsed) throw new Error("Invalid YouTube URL. Please paste a valid channel or video link.");
      let contentSummary = "";
      if (parsed.type === "video") {
        const videoData = await fetchVideoData(parsed.videoId);
        contentSummary = buildContentSummary(parsed, videoData);
      } else {
        const channelData = await fetchChannelData(parsed.identifier, parsed.isHandle);
        contentSummary = buildContentSummary(parsed, undefined, channelData);
      }
      if (!contentSummary) throw new Error("Could not extract content data from the URL.");
      setCreatorSummary(contentSummary);
      const analysis = await callGroq(contentSummary);
      setResults(analysis);
      setScreen("results");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred.";
      console.error("Social Spark Error:", err);
      setError(message);
      setScreen("error");
    }
  }, []);

  const handleReset = () => { setScreen("input"); setResults(null); setError(""); setCreatorSummary(""); };

  switch (screen) {
    case "loading": return <LoadingScreen />;
    case "results": return <ResultsScreen data={results!} onBack={handleReset} creatorSummary={creatorSummary} />;
    case "error": return <ErrorScreen message={error} onRetry={handleReset} />;
    default: return <InputScreen onAnalyze={handleAnalyze} />;
  }
}
