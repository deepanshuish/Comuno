"use client";
import { motion } from "framer-motion";

const STATS = [
  { value: "10×",  label: "Faster talent decisions"  },
  { value: "94%",  label: "Candidate match accuracy"  },
  { value: "60%",  label: "Reduction in time-to-hire" },
];

export default function Hero() {
  return (
    <section style={{
      position: "relative",
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      padding: "0 16px",
      paddingTop: "clamp(80px, 12vw, 120px)",
    }}>

      {/* ── Cortex-style centered purple radial glow ── */}
      <div style={{
        position: "absolute",
        top: "30%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: 700, height: 500,
        background: "radial-gradient(ellipse at center, rgba(112,89,240,0.28) 0%, rgba(112,89,240,0.08) 40%, transparent 70%)",
        pointerEvents: "none",
        animation: "hero-glow 6s ease-in-out infinite",
      }} />

      {/* Subtle grid — Cortex has no grid, keep very faint */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "linear-gradient(rgba(112,89,240,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(112,89,240,0.04) 1px,transparent 1px)",
        backgroundSize: "64px 64px",
        maskImage: "radial-gradient(ellipse 60% 60% at 50% 40%, black 20%, transparent 100%)",
        WebkitMaskImage: "radial-gradient(ellipse 60% 60% at 50% 40%, black 20%, transparent 100%)",
        pointerEvents: "none",
      }} />

      {/* ── Content ── */}
      <div style={{ position: "relative", zIndex: 10, maxWidth: 820, width: "100%", textAlign: "center" }}>

        {/* Cortex-style periwinkle tag line */}
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.55 }}
          className="tag"
          style={{ justifyContent: "center", marginBottom: 22 }}
        >
          Mission Control for the AI Talent Factory
        </motion.p>

        {/* Headline — Cortex style: very large, 700 weight, white, tight */}
        <motion.h1
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28, duration: 0.65, ease: [0.22,1,0.36,1] }}
          style={{
            fontSize: "clamp(44px, 7.5vw, 88px)",
            fontWeight: 800,
            lineHeight: 1.02,
            letterSpacing: "-3px",
            background: "linear-gradient(180deg, #ffffff 20%, rgba(255,255,255,0.62) 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            marginBottom: 24,
          }}
        >
          Talent is no longer<br />
          the bottleneck.
        </motion.h1>

        {/* Sub */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.42, duration: 0.55 }}
          style={{
            fontSize: 17,
            color: "var(--t2)",
            maxWidth: 540,
            margin: "0 auto 38px",
            lineHeight: 1.65,
            fontWeight: 400,
          }}
        >
          Comuno is the unified talent intelligence platform — AI screening, adaptive interviews, smart onboarding, and continuous training in one system of record.
        </motion.p>

        {/* Single Cortex-style CTA */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.5 }}
          style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 72 }}
        >
          <a href="/signup" className="btn btn-purple" style={{ fontSize: 15, padding: "13px 28px" }}>
            Book a live demo
          </a>
          <a href="#product" className="btn btn-ghost" style={{ fontSize: 15, padding: "13px 24px" }}>
            See the platform →
          </a>
        </motion.div>

        {/* Stats row — clean, bordered */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.55 }}
          style={{
            display: "flex",
            maxWidth: 500,
            margin: "0 auto",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          {STATS.map((s, i) => (
            <div key={s.label} style={{
              flex: 1,
              padding: "20px 16px",
              textAlign: "center",
              borderRight: i < STATS.length - 1 ? "1px solid var(--border)" : "none",
            }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: "var(--purple-hi)", letterSpacing: "-1px", lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 5, fontWeight: 500, lineHeight: 1.3 }}>{s.label}</div>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Bottom fade to section below */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        height: 120,
        background: "linear-gradient(to bottom, transparent, var(--bg))",
        pointerEvents: "none",
      }} />
    </section>
  );
}
