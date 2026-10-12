// Marketing copy shared by the human landing page and its machine-readable version.
// Keep claims factual: only describe what Comuno actually does.

export const ROTATING = ["reps", "founders", "RevOps", "you", "GTM engineers"];

export const PRODUCTS = [
  {
    id: "prospect",
    eyebrow: "Prospect",
    title: "Find your ideal customers, with sources.",
    body: "Describe who you sell to in plain English. Comuno's agents search the live web for real companies and decision makers that match your ICP, then enrich, verify and score every record.",
    points: ["AI lead and account discovery grounded in Google Search", "Waterfall enrichment, email finder and MX verification", "0–100 ICP fit scoring with reasons", "CSV import/export, lists and deduplication"],
    href: "/prospect",
  },
  {
    id: "engage",
    eyebrow: "Engage",
    title: "Personalized outreach across every channel.",
    body: "Build multi-step sequences across email, LinkedIn and phone. Gemini rewrites every touch for the person receiving it, using their role, company research and buying signals.",
    points: ["Email + LinkedIn + call + task sequences", "AI personalization per prospect, sent from your mailbox", "Unified inbox that classifies replies and drafts responses", "Power dialer with AI talk tracks and call summaries"],
    href: "/sequences",
  },
  {
    id: "manage",
    eyebrow: "Manage",
    title: "A CRM that tells you what to do next.",
    body: "Run the full deal cycle on a drag-and-drop pipeline. Every deal gets an AI read on risks, gaps and the next best action, built from its whole activity history.",
    points: ["Kanban pipeline with weighted forecast", "Activity timelines across people, companies and deals", "AI deal insights and suggested follow-ups", "Funnel, outreach and pipeline analytics"],
    href: "/deals",
  },
  {
    id: "signals",
    eyebrow: "Signals",
    title: "Reach buyers at the right moment.",
    body: "Know who is on your website and which accounts are changing. Comuno identifies visiting companies and people, and watches your accounts for funding, hiring and leadership moves.",
    points: ["Website visitor identification (company and person)", "Funding, hiring, launch and leadership signals", "Job-change alerts for your contacts", "One click from signal to outreach or deal"],
    href: "/signals",
  },
];

export const AGENT_PROMPTS = [
  "Find 20 VPs of Sales at Series B SaaS companies in the US and save them to a list",
  "Research Stripe and tell me the best angle for outreach",
  "Write a 5-step email + LinkedIn sequence to book demos with RevOps leaders",
  "Which deals need attention this week?",
];

export const HOW_IT_WORKS = [
  { n: "01", title: "Tell Comuno who you sell to", body: "Paste your website. Gemini researches it and drafts your company profile and ideal customer profile in seconds." },
  { n: "02", title: "Agents build your pipeline", body: "Discover and enrich real prospects, score fit, and draft personalized multi-channel outreach for each one." },
  { n: "03", title: "You stay in control", body: "Approve every send, work replies from one inbox, and run deals on a pipeline that tells you what to do next." },
];

export const TRUST = [
  { title: "Human approval", body: "The agent queues emails and sequence enrollments for your approval. Nothing goes out unseen." },
  { title: "Workspace isolation", body: "Every record is scoped to your workspace, with row-level security on the database." },
  { title: "Your own mailbox", body: "Send from your Google Workspace, Microsoft 365 or SMTP account, with open and click tracking." },
  { title: "Open by design", body: "REST API, inbound webhooks and an MCP server so Comuno works inside Claude and other agents." },
  { title: "Credits, not surprises", body: "Every AI and data action has a clear credit cost, with a full usage ledger." },
  { title: "Powered by Gemini", body: "Google Gemini with live Google Search grounding, and source links on research." },
];

export const PLANS = [
  { name: "Free", price: "$0", cadence: "", credits: "2,000 one-time credits", seats: "1 seat", features: ["Every module, including the Agent", "AI lead discovery & enrichment", "Sequences, inbox & dialer", "CRM, signals & visitor tracking"], cta: "Start for free", href: "/signup", featured: false },
  { name: "Solo", price: "$60", cadence: "/mo", credits: "480K credits / year", seats: "1 seat", features: ["Everything in Free", "Credits for daily prospecting", "API & MCP access", "Email support"], cta: "Start for free", href: "/signup", featured: true },
  { name: "Team", price: "$200", cadence: "/mo", credits: "1.2M credits / year", seats: "5 seats", features: ["Everything in Solo", "Credits for a full team", "Priority support"], cta: "Start for free", href: "/signup", featured: false },
  { name: "Enterprise", price: "Custom", cadence: "", credits: "Custom credits", seats: "5+ seats", features: ["Custom limits", "Self-hosting option", "Dedicated support"], cta: "Contact sales", href: "mailto:sales@comuno.ai", featured: false },
];

export const FAQ = [
  { q: "Where does Comuno's prospect data come from?", a: "Comuno's agents search the live web with Google Search grounding and return real, publicly listed companies and decision makers with the source link for each. You can also import your own CSVs or push contacts through the API." },
  { q: "How are emails found and verified?", a: "Comuno generates the common address patterns for a person's company domain, checks that the domain accepts mail (MX), and uses public information about the company's email format to rank candidates. Each address is labelled valid, risky or invalid." },
  { q: "Will the AI send emails without me?", a: "Sequences you activate run on schedule. When the Comuno Agent wants to send an email or enroll people in a sequence, it asks for your approval first." },
  { q: "Which AI model does Comuno use?", a: "Google Gemini, including search-grounded Gemini for research, discovery and buying signals." },
  { q: "Can I use Comuno from Claude or my own tools?", a: "Yes. Create an API key in Settings to use the REST API, the inbound reply webhook, or Comuno's MCP server from Claude and other MCP clients." },
  { q: "How do credits work?", a: "Each AI or data action costs a few credits. For example, writing an email costs 1, enriching a company costs 5, and a discovery search costs 10. The free plan includes 2,000 credits." },
];
