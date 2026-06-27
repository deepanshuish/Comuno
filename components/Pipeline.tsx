"use client";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";

// ── Mini UI mockups inside each card ─────────────────────────────

function ScreenUI() {
  const rows = [
    { initials: "PR", name: "Priya Rajan",  skills: ["React", "TypeScript"], score: 94, color: "#22c55e" },
    { initials: "AK", name: "Amit Kumar",   skills: ["Node", "AWS"],         score: 81, color: "#22c55e" },
    { initials: "SM", name: "Sara Mehta",   skills: ["Python", "ML"],        score: 67, color: "#f59e0b" },
    { initials: "VS", name: "Vikram S.",    skills: ["Java", "K8s"],         score: 45, color: "#ef4444" },
  ];
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", padding: "0 2px", marginBottom: 10 }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.28)", textTransform: "uppercase", letterSpacing: "0.07em" }}>Candidate</span>
        <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.28)", textTransform: "uppercase", letterSpacing: "0.07em" }}>AI Match</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {rows.map((r, i) => (
          <div key={r.name} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "9px 10px", borderRadius: 8,
            background: i === 0 ? "rgba(112,89,240,0.14)" : "rgba(255,255,255,0.03)",
            border: `1px solid ${i === 0 ? "rgba(112,89,240,0.3)" : "rgba(255,255,255,0.05)"}`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                width: 26, height: 26, borderRadius: 6, flexShrink: 0,
                background: i === 0 ? "rgba(112,89,240,0.35)" : "rgba(255,255,255,0.07)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 9, fontWeight: 700, color: i === 0 ? "#8787d8" : "rgba(255,255,255,0.35)",
              }}>{r.initials}</div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: i === 0 ? "#fff" : "rgba(255,255,255,0.6)", marginBottom: 3 }}>{r.name}</div>
                <div style={{ display: "flex", gap: 3 }}>
                  {r.skills.map(s => (
                    <span key={s} style={{
                      fontSize: 9, color: "rgba(255,255,255,0.38)",
                      background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 3, padding: "1px 5px",
                    }}>{s}</span>
                  ))}
                </div>
              </div>
            </div>
            <span style={{
              fontSize: 12, fontWeight: 700,
              color: r.color, background: `${r.color}18`,
              border: `1px solid ${r.color}35`,
              borderRadius: 6, padding: "3px 9px",
            }}>{r.score}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function InterviewUI() {
  const traits = [
    { label: "Communication",   score: 82 },
    { label: "Technical Depth", score: 63 },
    { label: "Problem Solving", score: 89 },
    { label: "Leadership Fit",  score: 70 },
  ];
  const col = (s: number) => s >= 80 ? "#22c55e" : s >= 65 ? "#f59e0b" : "#8787d8";
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>Priya Rajan · Interview #47</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>SDE II · Adaptive AI Session</div>
        </div>
        <span style={{
          fontSize: 9, fontWeight: 700, letterSpacing: "0.06em",
          background: "rgba(112,89,240,0.2)", border: "1px solid rgba(112,89,240,0.35)",
          color: "#8787d8", borderRadius: 5, padding: "3px 8px",
        }}>● LIVE</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
        {traits.map(t => (
          <div key={t.label}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.44)" }}>{t.label}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: col(t.score) }}>{t.score}%</span>
            </div>
            <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,0.06)" }}>
              <div style={{ height: "100%", width: `${t.score}%`, borderRadius: 3, background: col(t.score) }} />
            </div>
          </div>
        ))}
      </div>
      <div style={{
        marginTop: 18, padding: "11px 14px", borderRadius: 9,
        background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.2)",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <span style={{ color: "#22c55e", fontSize: 15 }}>✓</span>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#22c55e" }}>Strong Hire</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>AI recommendation · 91% confidence</div>
        </div>
      </div>
    </div>
  );
}

function OnboardUI() {
  const tasks = [
    { label: "Personal info & documents",     done: true,  active: false },
    { label: "IT equipment provisioned",      done: true,  active: false },
    { label: "Meet your team",                done: true,  active: false },
    { label: "Product & process walkthrough", done: false, active: true  },
    { label: "First project kick-off",        done: false, active: false },
  ];
  const doneCount = tasks.filter(t => t.done).length;
  const pct = Math.round((doneCount / tasks.length) * 100);
  return (
    <div>
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "10px 12px", borderRadius: 9,
        background: "rgba(112,89,240,0.1)", border: "1px solid rgba(112,89,240,0.2)",
        marginBottom: 14,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
          background: "rgba(112,89,240,0.3)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 800, color: "#8787d8",
        }}>PS</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>Priya Sharma</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.38)" }}>Software Engineer · Day 3</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#8470f2", lineHeight: 1 }}>{pct}%</div>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>complete</div>
        </div>
      </div>
      <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,0.07)", marginBottom: 14 }}>
        <div style={{ height: "100%", width: `${pct}%`, borderRadius: 3, background: "linear-gradient(90deg, #7059f0, #8470f2)" }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {tasks.map((t, i) => (
          <div key={t.label} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "7px 10px", borderRadius: 7,
            background: t.active ? "rgba(112,89,240,0.12)" : "transparent",
            border: t.active ? "1px solid rgba(112,89,240,0.25)" : "1px solid transparent",
          }}>
            <div style={{
              width: 17, height: 17, borderRadius: 5, flexShrink: 0,
              background: t.done ? "#22c55e" : t.active ? "rgba(112,89,240,0.3)" : "rgba(255,255,255,0.07)",
              border: t.done ? "none" : t.active ? "1px solid rgba(112,89,240,0.5)" : "1px solid rgba(255,255,255,0.1)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {t.done && <span style={{ fontSize: 9, color: "#fff", lineHeight: 1 }}>✓</span>}
            </div>
            <span style={{
              fontSize: 11,
              color: t.done ? "rgba(255,255,255,0.32)" : t.active ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.28)",
              textDecoration: t.done ? "line-through" : "none",
            }}>{t.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Card data ────────────────────────────────────────────────────

const CARDS = [
  {
    num: "01",
    title: "Screen smarter",
    desc: "Rank thousands of resumes in seconds. AI extracts skills, experience, and domain fit — surfacing only candidates worth your time.",
    ui: <ScreenUI />,
    yOffset: 64,
  },
  {
    num: "02",
    title: "Interview at scale",
    desc: "Adaptive AI interviews with live scorecards. Every response scored on communication, depth, and role fit — zero scheduling overhead.",
    ui: <InterviewUI />,
    yOffset: 32,
  },
  {
    num: "03",
    title: "Onboard and develop",
    desc: "Structured onboarding per employee, personalized learning paths, and continuous skill development — all in one system of record.",
    ui: <OnboardUI />,
    yOffset: 0,
  },
];

// ── Section ──────────────────────────────────────────────────────

export default function Pipeline() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="platform" style={{ padding: "110px 24px 190px", position: "relative", overflow: "visible" }} ref={ref}>
      <div style={{ position: "absolute", top: 0, left: "10%", right: "10%", height: 1, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.13), transparent)" }} />

      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.55 }}
          style={{ marginBottom: 64 }}
        >
          <p className="section-label" style={{ marginBottom: 14 }}>The Platform</p>
          <h2 style={{ fontSize: "clamp(30px,4vw,52px)", fontWeight: 700, color: "#fff", letterSpacing: "-1.5px", lineHeight: 1.08, marginBottom: 14, maxWidth: 540 }}>
            One platform.<br />The full talent lifecycle.
          </h2>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.58)", maxWidth: 440, lineHeight: 1.65 }}>
            Every stage of your talent operations — automated, connected, intelligent.
          </p>
        </motion.div>

        {/* Staggered Cortex-style cards */}
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
          {CARDS.map((card, i) => (
            <motion.div
              key={card.num}
              initial={{ opacity: 0, y: card.yOffset + 40 }}
              animate={inView ? { opacity: 1, y: card.yOffset } : {}}
              transition={{ delay: i * 0.13, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              style={{
                flex: 1,
                background: "#13141f",
                border: "1px solid rgba(255,255,255,0.09)",
                borderRadius: 16,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                minHeight: 530,
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.16)")}
              onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)")}
            >
              {/* Text area */}
              <div style={{ padding: "28px 26px 22px" }}>
                <div style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 34, height: 22, borderRadius: 5,
                  background: "#7059f0",
                  fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", color: "#fff",
                  marginBottom: 20,
                }}>{card.num}</div>

                <h3 style={{
                  fontSize: "clamp(18px, 2vw, 23px)", fontWeight: 700,
                  color: "#fff", letterSpacing: "-0.4px", lineHeight: 1.2,
                  marginBottom: 10, display: "flex", alignItems: "center", gap: 6,
                }}>
                  {card.title}
                  <span style={{ color: "rgba(255,255,255,0.35)", fontWeight: 400 }}>→</span>
                </h3>

                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.44)", lineHeight: 1.68 }}>
                  {card.desc}
                </p>
              </div>

              {/* UI mockup */}
              <div style={{
                flex: 1,
                margin: "0 1px 1px",
                background: "#0c0d18",
                borderRadius: "0 0 15px 15px",
                borderTop: "1px solid rgba(255,255,255,0.06)",
                padding: "20px 18px",
              }}>
                {card.ui}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
