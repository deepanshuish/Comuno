"use client";
import { useState, useRef } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";

/* ── Sidebar nav items ─────────────────────────────────────────── */
const NAV = [
  { id: "screen",    icon: "◈", label: "Screening"  },
  { id: "interview", icon: "⬡", label: "Interviews" },
  { id: "onboard",   icon: "◉", label: "Onboarding" },
  { id: "training",  icon: "▣", label: "Training"   },
];

/* ── Candidates ────────────────────────────────────────────────── */
const CANDIDATES = [
  { name: "Ananya Sharma",  role: "Sr. Frontend Engineer", dept: "Engineering", score: 94, match: "Strong", skills: 12, avatar: "AS", color: "#7059f0" },
  { name: "Rohan Mehta",    role: "ML Engineer",           dept: "AI / ML",     score: 89, match: "Strong", skills: 9,  avatar: "RM", color: "#8470f2" },
  { name: "Priya Nair",     role: "Product Manager",       dept: "Product",     score: 82, match: "Good",   skills: 8,  avatar: "PN", color: "#22c55e" },
  { name: "Arjun Kapoor",   role: "Backend Engineer",      dept: "Engineering", score: 76, match: "Fair",   skills: 11, avatar: "AK", color: "#94a3b8" },
  { name: "Sneha Reddy",    role: "Data Analyst",          dept: "Analytics",   score: 71, match: "Fair",   skills: 7,  avatar: "SR", color: "#f59e0b" },
];

const matchColor = (m: string) =>
  m === "Strong" ? { bg: "rgba(34,197,94,0.1)",   color: "#22c55e", border: "rgba(34,197,94,0.2)"   }
  : m === "Good" ? { bg: "rgba(79,112,245,0.1)",  color: "#8787d8", border: "rgba(112,89,240,0.2)"  }
  :                { bg: "rgba(245,158,11,0.1)",  color: "#f59e0b", border: "rgba(245,158,11,0.2)"  };

/* ── Screening screen ──────────────────────────────────────────── */
function ScreeningScreen() {
  const [sel, setSel] = useState(0);
  const c = CANDIDATES[sel];

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      {/* Table panel */}
      <div style={{ flex: "0 0 54%", borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* toolbar */}
        <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, background: "var(--elevated)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 7, padding: "6px 12px" }}>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)" }}>⌕</span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)" }}>Search candidates…</span>
          </div>
          <div style={{ background: "rgba(112,89,240,0.12)", border: "1px solid rgba(112,89,240,0.25)", borderRadius: 7, padding: "6px 12px", fontSize: 11, fontWeight: 600, color: "#8787d8", cursor: "pointer", whiteSpace: "nowrap" }}>+ Add Filter</div>
        </div>

        {/* table head */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 68px 70px", gap: 0, padding: "8px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)", flexShrink: 0 }}>
          {["Candidate", "Department", "Skills", "Score"].map(h => (
            <div key={h} style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.2)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{h}</div>
          ))}
        </div>

        {/* rows */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {CANDIDATES.map((cd, i) => {
            const mc = matchColor(cd.match);
            return (
              <div key={cd.name} onClick={() => setSel(i)}
                style={{ display: "grid", gridTemplateColumns: "1fr 90px 68px 70px", gap: 0, padding: "11px 20px", cursor: "pointer", borderBottom: "1px solid var(--elevated)", background: sel === i ? "rgba(112,89,240,0.08)" : "transparent", transition: "background 0.12s" }}>
                {/* name */}
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <div style={{ width: 26, height: 26, borderRadius: 6, background: cd.color + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: cd.color, flexShrink: 0 }}>{cd.avatar}</div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: sel === i ? "#e2e8f0" : "rgba(255,255,255,0.75)" }}>{cd.name}</div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>{cd.role}</div>
                  </div>
                </div>
                {/* dept */}
                <div style={{ display: "flex", alignItems: "center" }}>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", background: "var(--elevated)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4, padding: "2px 7px" }}>{cd.dept}</span>
                </div>
                {/* skills */}
                <div style={{ display: "flex", alignItems: "center" }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.45)" }}>{cd.skills}</span>
                </div>
                {/* score */}
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: cd.score >= 88 ? "#34d399" : cd.score >= 78 ? "#8787d8" : "#fbbf24" }}>{cd.score}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, background: mc.bg, color: mc.color, border: `1px solid ${mc.border}`, borderRadius: 4, padding: "2px 6px" }}>{cd.match}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ padding: "10px 20px", borderTop: "1px solid rgba(255,255,255,0.05)", flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)" }}>492 resumes processed · 5 shortlisted</span>
          <span style={{ fontSize: 10, color: "rgba(112,89,240,0.6)", cursor: "pointer" }}>View all →</span>
        </div>
      </div>

      {/* Detail panel */}
      <div style={{ flex: 1, padding: "20px", overflowY: "auto" }}>
        {/* header */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, paddingBottom: 18, borderBottom: "1px solid rgba(255,255,255,0.06)", marginBottom: 20 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: c.color + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: c.color, flexShrink: 0 }}>{c.avatar}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0" }}>{c.name}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{c.role} · {c.dept}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 26, fontWeight: 900, color: c.score >= 88 ? "#34d399" : "#8787d8", lineHeight: 1 }}>{c.score}</div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", letterSpacing: "0.06em" }}>AI SCORE</div>
          </div>
        </div>

        {/* Score breakdown */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.22)", letterSpacing: "0.09em", textTransform: "uppercase", marginBottom: 12 }}>Score Breakdown</div>
          {[
            { label: "Skills Match",   val: c.score     },
            { label: "Experience",     val: c.score - 4 },
            { label: "Culture Fit",    val: c.score - 9 },
          ].map(b => (
            <div key={b.label} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 5 }}>
                <span style={{ color: "rgba(255,255,255,0.4)" }}>{b.label}</span>
                <span style={{ fontWeight: 700, color: "rgba(255,255,255,0.6)" }}>{b.val}%</span>
              </div>
              <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
                <motion.div key={c.name + b.label} initial={{ width: 0 }} animate={{ width: `${b.val}%` }} transition={{ duration: 0.6, ease: "easeOut" }}
                  style={{ height: "100%", background: "linear-gradient(90deg,#7059f0,#8787d8)", borderRadius: 2 }} />
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 8 }}>
          <button style={{ flex: 1, background: "linear-gradient(135deg,#7059f0,#7059f0)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 0", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
            Move to Interview →
          </button>
          <button style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "9px 14px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
            Archive
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Interview screen ──────────────────────────────────────────── */
const MSGS = [
  { from: "ai",   text: "Tell me about a performance optimisation you led at scale." },
  { from: "user", text: "At my last role I reduced bundle size by 40% using code-splitting and lazy loading — cut LCP from 4.2s to 1.1s." },
  { from: "ai",   text: "Excellent. How did you measure impact and communicate it to stakeholders?" },
  { from: "user", text: "I set up Lighthouse CI in the pipeline and presented weekly Core Web Vitals dashboards to the PM and eng lead." },
  { from: "ai",   text: "Great answer. Let's move to system design — how would you architect a real-time collaboration feature?" },
];

const TRAITS = [
  { label: "Communication",   pct: 92 },
  { label: "Technical Depth", pct: 88 },
  { label: "Problem Solving", pct: 95 },
  { label: "Cultural Fit",    pct: 84 },
];

function InterviewScreen() {
  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      {/* Transcript */}
      <div style={{ flex: "0 0 58%", borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "12px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444", boxShadow: "0 0 6px #ef4444" }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.5)" }}>Ananya Sharma · Senior Frontend Engineer</span>
          <span style={{ marginLeft: "auto", fontSize: 10, background: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 5, padding: "2px 8px", fontWeight: 700 }}>● REC 18:24</span>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          {MSGS.map((m, i) => (
            <div key={i} style={{ display: "flex", gap: 10, flexDirection: m.from === "ai" ? "row" : "row-reverse" }}>
              <div style={{ width: 26, height: 26, borderRadius: 7, background: m.from === "ai" ? "rgba(112,89,240,0.2)" : "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0 }}>
                {m.from === "ai" ? "🤖" : "👤"}
              </div>
              <div style={{ maxWidth: "76%", background: m.from === "ai" ? "rgba(112,89,240,0.08)" : "var(--elevated)", border: m.from === "ai" ? "1px solid rgba(112,89,240,0.18)" : "1px solid rgba(255,255,255,0.07)", borderRadius: m.from === "ai" ? "3px 10px 10px 10px" : "10px 3px 10px 10px", padding: "9px 13px", fontSize: 11, color: "rgba(255,255,255,0.65)", lineHeight: 1.6 }}>
                {m.text}
              </div>
            </div>
          ))}
        </div>

        <div style={{ padding: "12px 20px", borderTop: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
          <div style={{ background: "var(--surface)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 7, padding: "9px 13px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.18)" }}>AI generating next question…</span>
            <div style={{ display: "flex", gap: 3 }}>
              {[0,1,2].map(i => (
                <motion.div key={i} animate={{ opacity: [0.2,1,0.2] }} transition={{ repeat: Infinity, duration: 1.2, delay: i*0.2 }}
                  style={{ width: 4, height: 4, borderRadius: "50%", background: "#7059f0" }} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Live scorecard */}
      <div style={{ flex: 1, padding: "20px 18px", overflowY: "auto" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.22)", letterSpacing: "0.09em", textTransform: "uppercase", marginBottom: 14 }}>Live Scorecard</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 20 }}>
          {[{ label: "Overall", val: "91", color: "#8787d8" }, { label: "Sentiment", val: "88%", color: "#34d399" }, { label: "Relevance", val: "94%", color: "#8787d8" }, { label: "Clarity", val: "87%", color: "#fbbf24" }].map(m => (
            <div key={m.label} style={{ background: "var(--surface)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "12px 10px", textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: m.color }}>{m.val}</div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", marginTop: 2, letterSpacing: "0.06em" }}>{m.label.toUpperCase()}</div>
            </div>
          ))}
        </div>

        <div style={{ marginBottom: 18 }}>
          {TRAITS.map(t => (
            <div key={t.label} style={{ marginBottom: 11 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 5 }}>
                <span style={{ color: "rgba(255,255,255,0.4)" }}>{t.label}</span>
                <span style={{ fontWeight: 700, color: "rgba(255,255,255,0.55)" }}>{t.pct}</span>
              </div>
              <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
                <motion.div key={t.label} initial={{ width: 0 }} animate={{ width: `${t.pct}%` }} transition={{ delay: 0.15, duration: 0.7, ease: "easeOut" }}
                  style={{ height: "100%", borderRadius: 2, background: "linear-gradient(90deg,#7059f0,#8787d8)" }} />
              </div>
            </div>
          ))}
        </div>

        <div style={{ background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.18)", borderRadius: 10, padding: "12px 14px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#34d399", marginBottom: 5, letterSpacing: "0.06em" }}>AI VERDICT</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", lineHeight: 1.55 }}>Strong candidate. Move to technical round. Above benchmark on communication and problem-solving.</div>
        </div>
      </div>
    </div>
  );
}

/* ── Onboarding screen ─────────────────────────────────────────── */
const OB_STEPS = [
  { done: true,  label: "Offer letter signed",       sub: "DocuSign · Completed",         time: "Day 0"  },
  { done: true,  label: "Background check cleared",  sub: "AuthBridge · Verified",        time: "Day 1"  },
  { done: true,  label: "IT setup & access granted", sub: "Slack, Jira, GitHub enabled",   time: "Day 2"  },
  { done: false, label: "HR orientation session",    sub: "Scheduled · 10:00 AM",          time: "Day 3"  },
  { done: false, label: "Team introduction meeting", sub: "Eng · Calendar invite sent",    time: "Day 4"  },
  { done: false, label: "First project onboarded",   sub: "Frontend Platform squad",       time: "Day 7"  },
];

function OnboardingScreen() {
  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      {/* Left — employee panel */}
      <div style={{ flex: "0 0 40%", borderRight: "1px solid rgba(255,255,255,0.06)", padding: "20px", display: "flex", flexDirection: "column", gap: 16, overflowY: "auto" }}>
        {/* employee card */}
        <div style={{ background: "var(--surface)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: "rgba(112,89,240,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "#8787d8" }}>AS</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>Ananya Sharma</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>Sr. Frontend Engineer · Engineering</div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[{ label: "Start Date", val: "Jan 15, 2025" }, { label: "Manager", val: "Vikram S." }, { label: "Location", val: "Mumbai, IN" }, { label: "Team", val: "Platform" }].map(f => (
              <div key={f.label}>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.22)", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 3 }}>{f.label}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.55)" }}>{f.val}</div>
              </div>
            ))}
          </div>
        </div>

        {/* progress */}
        <div style={{ background: "var(--surface)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 8 }}>
            <span style={{ color: "rgba(255,255,255,0.4)", fontWeight: 600 }}>Onboarding Progress</span>
            <span style={{ fontWeight: 800, color: "#f59e0b" }}>50%</span>
          </div>
          <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
            <motion.div initial={{ width: 0 }} animate={{ width: "50%" }} transition={{ delay: 0.3, duration: 0.8, ease: "easeOut" }}
              style={{ height: "100%", background: "linear-gradient(90deg,#f59e0b,#fbbf24)", borderRadius: 3 }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "rgba(255,255,255,0.22)", marginTop: 6 }}>
            <span>3 of 6 steps complete</span><span>Day 3 of 7</span>
          </div>
        </div>

        {/* quick links */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {["View HR Documents", "IT Access Portal", "Team Wiki"].map(l => (
            <div key={l} style={{ background: "var(--surface)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: "9px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{l}</span>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.2)" }}>→</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right — checklist */}
      <div style={{ flex: 1, padding: "20px", overflowY: "auto" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.22)", letterSpacing: "0.09em", textTransform: "uppercase", marginBottom: 14 }}>Onboarding Checklist</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {OB_STEPS.map((step, i) => (
            <div key={step.label} style={{ display: "flex", gap: 12 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                <div style={{ width: 22, height: 22, borderRadius: "50%", background: step.done ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.05)", border: `1.5px solid ${step.done ? "#10b981" : "rgba(255,255,255,0.1)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: step.done ? "#34d399" : "rgba(255,255,255,0.2)", fontWeight: 800 }}>
                  {step.done ? "✓" : i + 1}
                </div>
                {i < OB_STEPS.length - 1 && <div style={{ width: 1.5, flex: 1, background: step.done ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.05)", margin: "4px 0" }} />}
              </div>
              <div style={{ paddingBottom: i < OB_STEPS.length - 1 ? 18 : 0, flex: 1 }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: step.done ? "#e2e8f0" : "rgba(255,255,255,0.35)" }}>{step.label}</div>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", flexShrink: 0, marginLeft: 8 }}>{step.time}</div>
                </div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.22)", marginTop: 2 }}>{step.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Training screen ───────────────────────────────────────────── */
const MODULES = [
  { title: "Company Culture & Values",    dur: "45 min",   pct: 100, status: "done"       },
  { title: "Security & Compliance",       dur: "1h 20m",   pct: 100, status: "done"       },
  { title: "Tech Stack Fundamentals",     dur: "2h 10m",   pct: 68,  status: "in-progress"},
  { title: "Product & Domain Knowledge",  dur: "3h",       pct: 20,  status: "in-progress"},
  { title: "Cross-team Collaboration",    dur: "1h",       pct: 0,   status: "locked"     },
  { title: "Performance Review Prep",     dur: "30 min",   pct: 0,   status: "locked"     },
];

function TrainingScreen() {
  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      {/* Summary panel */}
      <div style={{ flex: "0 0 36%", borderRight: "1px solid rgba(255,255,255,0.06)", padding: "20px", display: "flex", flexDirection: "column", gap: 14, overflowY: "auto" }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0", marginBottom: 2 }}>Learning Path</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>Sr. Frontend Engineer · Onboarding Track</div>
        </div>

        {/* Ring + completion */}
        <div style={{ background: "var(--surface)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "20px 16px", textAlign: "center" }}>
          <svg width="80" height="80" style={{ marginBottom: 10 }}>
            <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
            <motion.circle cx="40" cy="40" r="32" fill="none" stroke="url(#tGrad)" strokeWidth="6" strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 32}`}
              initial={{ strokeDashoffset: 2 * Math.PI * 32 }}
              animate={{ strokeDashoffset: 2 * Math.PI * 32 * (1 - 0.37) }}
              transition={{ delay: 0.4, duration: 1, ease: "easeOut" }}
              transform="rotate(-90 40 40)" />
            <defs>
              <linearGradient id="tGrad" x1="0" y1="0" x2="80" y2="80" gradientUnits="userSpaceOnUse">
                <stop stopColor="#7059f0"/><stop offset="1" stopColor="#8787d8"/>
              </linearGradient>
            </defs>
            <text x="40" y="44" textAnchor="middle" fontSize="16" fontWeight="900" fill="#8787d8">37%</text>
          </svg>
          <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.5)" }}>2 of 6 modules complete</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginTop: 4 }}>Est. 6h 40m remaining</div>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[{ label: "Streak", val: "4 days 🔥" }, { label: "XP Earned", val: "1,240" }, { label: "Rank", val: "#3 / 18" }, { label: "Next badge", val: "Security+" }].map(s => (
            <div key={s.label} style={{ background: "var(--surface)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: "10px 10px" }}>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.22)", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 3 }}>{s.label}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.6)" }}>{s.val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Modules list */}
      <div style={{ flex: 1, padding: "20px", overflowY: "auto" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.22)", letterSpacing: "0.09em", textTransform: "uppercase", marginBottom: 14 }}>Modules</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {MODULES.map((m) => (
            <div key={m.title} style={{ background: m.status === "done" ? "rgba(16,185,129,0.04)" : "var(--surface)", border: `1px solid ${m.status === "done" ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.07)"}`, borderRadius: 10, padding: "13px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, background: m.status === "done" ? "rgba(16,185,129,0.12)" : m.status === "in-progress" ? "rgba(112,89,240,0.12)" : "var(--elevated)", color: m.status === "done" ? "#34d399" : m.status === "in-progress" ? "#8787d8" : "rgba(255,255,255,0.15)" }}>
                  {m.status === "done" ? "✓" : m.status === "in-progress" ? "▶" : "○"}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: m.status === "locked" ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.75)" }}>{m.title}</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.22)", marginTop: 1 }}>{m.dur}</div>
                </div>
                {m.status === "done" && <span style={{ fontSize: 9, fontWeight: 700, background: "rgba(16,185,129,0.12)", color: "#34d399", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 4, padding: "2px 8px" }}>DONE</span>}
                {m.status === "in-progress" && <span style={{ fontSize: 10, fontWeight: 800, color: "#8787d8" }}>{m.pct}%</span>}
                {m.status === "locked" && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.1)" }}>🔒</span>}
              </div>
              {m.status === "in-progress" && (
                <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden", marginTop: 10 }}>
                  <motion.div key={m.title} initial={{ width: 0 }} animate={{ width: `${m.pct}%` }} transition={{ delay: 0.2, duration: 0.7 }}
                    style={{ height: "100%", background: "linear-gradient(90deg,#7059f0,#8787d8)", borderRadius: 2 }} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Screens map ───────────────────────────────────────────────── */
const SCREENS: Record<string, React.ReactNode> = {
  screen:    <ScreeningScreen />,
  interview: <InterviewScreen />,
  onboard:   <OnboardingScreen />,
  training:  <TrainingScreen />,
};

/* ── Main export ───────────────────────────────────────────────── */
export default function ProductUI() {
  const [active, setActive] = useState("screen");
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <section style={{ padding: "80px 24px 120px", position: "relative" }} ref={ref}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.07),transparent)" }} />
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 80% 60% at 50% 60%, rgba(99,102,241,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />

      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 24 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.65 }}
          style={{ textAlign: "center", marginBottom: 52 }}>
          <div style={{ display: "inline-flex", alignItems: "center", background: "rgba(112,89,240,0.08)", border: "1px solid rgba(112,89,240,0.2)", borderRadius: 999, padding: "5px 14px", fontSize: 11, fontWeight: 700, color: "#8787d8", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 20 }}>
            See It In Action
          </div>
          <h2 style={{ fontSize: "clamp(30px,4.5vw,52px)", fontWeight: 900, color: "#fff", letterSpacing: "-1.5px", lineHeight: 1.08, marginBottom: 14 }}>
            The platform that does it all.
          </h2>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.38)", maxWidth: 440, margin: "0 auto" }}>
            Click through each stage of the Comuno pipeline — built for enterprise, designed for speed.
          </p>
        </motion.div>

        {/* Mockup shell */}
        <motion.div initial={{ opacity: 0, y: 48 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.2, duration: 0.8, ease: [0.22,1,0.36,1] }}
          style={{ background: "var(--bg-base)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 16, overflow: "hidden", boxShadow: "0 48px 100px rgba(0,0,0,0.7), 0 0 0 1px var(--elevated)" }}>

          {/* Browser chrome */}
          <div style={{ background: "var(--bg-surface)", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "10px 16px", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", gap: 5 }}>
              {["#ff5f57","#febc2e","#28c840"].map(c => <div key={c} style={{ width: 9, height: 9, borderRadius: "50%", background: c, opacity: 0.75 }}/>)}
            </div>
            <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
              <div style={{ background: "var(--elevated)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 6, padding: "4px 14px", display: "flex", alignItems: "center", gap: 6, minWidth: 200 }}>
                <span style={{ fontSize: 9, color: "#34d399" }}>🔒</span>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "monospace" }}>app.comuno.ai</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#34d399" }} />
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)" }}>Live</span>
            </div>
          </div>

          {/* App layout: sidebar + content */}
          <div style={{ display: "grid", gridTemplateColumns: "188px 1fr" }}>
            {/* Sidebar */}
            <div style={{ background: "var(--bg-surface)", borderRight: "1px solid rgba(255,255,255,0.07)", minHeight: 520, display: "flex", flexDirection: "column" }}>
              {/* Brand */}
              <div style={{ padding: "16px 16px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 8 }}>
                <svg width="20" height="20" viewBox="0 0 44 44" fill="none">
                  <defs><linearGradient id="slg2" x1="0" y1="0" x2="44" y2="44" gradientUnits="userSpaceOnUse"><stop stopColor="#8787d8"/><stop offset="1" stopColor="#8787d8"/></linearGradient></defs>
                  <path d="M22 3L37.5 12V30L22 39L6.5 30V12L22 3Z" stroke="url(#slg2)" strokeWidth="1.5" fill="none" opacity="0.7"/>
                  <path d="M29 15.5C26.5 13.7 24 13 22 13C16.5 13 12 17 12 22C12 27 16.5 31 22 31C24 31 26.5 30.3 29 28.5" stroke="url(#slg2)" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
                  <circle cx="22" cy="22" r="1.8" fill="url(#slg2)"/>
                </svg>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#e2e8f0" }}>comuno</span>
              </div>

              {/* Nav section label */}
              <div style={{ padding: "14px 14px 6px", fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.2)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Pipeline</div>

              {/* Nav items */}
              {NAV.map(n => (
                <button key={n.id} onClick={() => setActive(n.id)}
                  style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 14px", background: active === n.id ? "rgba(112,89,240,0.12)" : "transparent", borderLeft: active === n.id ? "2px solid #7059f0" : "2px solid transparent", border: "none", cursor: "pointer", width: "100%", transition: "all 0.12s" }}>
                  <span style={{ fontSize: 13, opacity: active === n.id ? 1 : 0.5 }}>{n.icon}</span>
                  <span style={{ fontSize: 12, fontWeight: active === n.id ? 600 : 400, color: active === n.id ? "#8787d8" : "rgba(255,255,255,0.35)" }}>{n.label}</span>
                  {active === n.id && <div style={{ marginLeft: "auto", width: 5, height: 5, borderRadius: "50%", background: "#7059f0" }} />}
                </button>
              ))}

              <div style={{ padding: "14px 14px 6px", marginTop: 8, fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.15)", letterSpacing: "0.1em", textTransform: "uppercase", borderTop: "1px solid rgba(255,255,255,0.05)" }}>Analytics</div>
              {["Dashboard","Reports","Settings"].map(item => (
                <div key={item} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 14px", cursor: "pointer" }}>
                  <span style={{ fontSize: 12, opacity: 0.25 }}>◻</span>
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)" }}>{item}</span>
                </div>
              ))}

              {/* User pill at bottom */}
              <div style={{ marginTop: "auto", padding: "14px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 24, height: 24, borderRadius: 6, background: "rgba(112,89,240,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: "#8787d8" }}>VK</div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.5)" }}>Vikram Kumar</div>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.2)" }}>HR Admin</div>
                </div>
              </div>
            </div>

            {/* Main content */}
            <div style={{ height: 520, overflow: "hidden", position: "relative" }}>
              <AnimatePresence mode="wait">
                <motion.div key={active}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  style={{ height: "100%", overflow: "hidden" }}>
                  {SCREENS[active]}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </motion.div>

        {/* Tab strip below */}
        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 28, flexWrap: "wrap" }}>
          {NAV.map(n => (
            <button key={n.id} onClick={() => setActive(n.id)}
              style={{ display: "flex", alignItems: "center", gap: 7, background: active === n.id ? "rgba(99,102,241,0.1)" : "rgba(255,255,255,0.02)", border: active === n.id ? "1px solid rgba(112,89,240,0.3)" : "1px solid rgba(255,255,255,0.07)", borderRadius: 9, padding: "8px 16px", cursor: "pointer", fontSize: 12, fontWeight: active === n.id ? 700 : 400, color: active === n.id ? "#8787d8" : "rgba(255,255,255,0.35)", transition: "all 0.15s" }}>
              {n.icon} {n.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
