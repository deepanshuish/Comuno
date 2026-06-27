"use client";
import { motion, useInView } from "framer-motion";
import { useRef, type ReactNode } from "react";

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      width="15" height="15" viewBox="0 0 24 24"
      fill="none" stroke="#8787d8" strokeWidth="1.75"
      strokeLinecap="round" strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

const FEATURES: { icon: ReactNode; title: string; desc: string }[] = [
  {
    icon: (
      <Icon>
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </Icon>
    ),
    title: "Sub-second intelligence",
    desc: "10,000 candidate profiles ranked in under 60 seconds with 98.5% attribute extraction accuracy.",
  },
  {
    icon: (
      <Icon>
        <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </Icon>
    ),
    title: "Domain-tuned AI",
    desc: "Models fine-tuned on industry-specific talent data — engineering, finance, operations, and defence.",
  },
  {
    icon: (
      <Icon>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="M9 12l2 2 4-4" />
      </Icon>
    ),
    title: "Enterprise security",
    desc: "SOC 2 Type II, end-to-end encryption, GDPR & DPDPA compliant. Audit logs on every action.",
  },
  {
    icon: (
      <Icon>
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </Icon>
    ),
    title: "Unified analytics",
    desc: "Live dashboards across pipeline health, DEI metrics, offer conversion, and workforce readiness.",
  },
  {
    icon: (
      <Icon>
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </Icon>
    ),
    title: "100+ integrations",
    desc: "HRIS, ATS, payroll, and communication tools — connected via pre-built connectors, no engineering needed.",
  },
  {
    icon: (
      <Icon>
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </Icon>
    ),
    title: "25+ languages",
    desc: "Full platform support across 50+ languages — English, Spanish, Mandarin, Arabic, French, and more.",
  },
];

export default function Features() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="solutions" style={{ padding: "100px 24px", position: "relative" }} ref={ref}>
      <div style={{ position: "absolute", top: 0, left: "10%", right: "10%", height: 1, background: "linear-gradient(90deg, transparent, var(--border-md), transparent)" }} />
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 55% 40% at 50% 50%, rgba(112,89,240,0.05) 0%, transparent 70%)", pointerEvents: "none" }} />

      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.55 }}
          style={{ marginBottom: 56 }}
        >
          <p className="section-label" style={{ marginBottom: 14 }}>Why Comuno</p>
          <h2 style={{ fontSize: "clamp(28px,4vw,48px)", fontWeight: 700, color: "#fff", letterSpacing: "-1.5px", lineHeight: 1.1, maxWidth: 500 }}>
            Built for enterprise scale from day one.
          </h2>
        </motion.div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))",
          gap: 1,
          background: "var(--border)",
          borderRadius: 14,
          overflow: "hidden",
          border: "1px solid var(--border)",
        }}
        className="features-grid">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0 }} animate={inView ? { opacity: 1 } : {}}
              transition={{ delay: i * 0.07, duration: 0.45 }}
              style={{ background: "#13141f", padding: "28px 26px", transition: "background 0.15s" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#1a1b28")}
              onMouseLeave={e => (e.currentTarget.style.background = "#13141f")}
            >
              {/* Icon container */}
              <div style={{
                width: 34, height: 34,
                borderRadius: 8,
                background: "rgba(135,135,216,0.08)",
                border: "1px solid rgba(135,135,216,0.18)",
                display: "flex", alignItems: "center", justifyContent: "center",
                marginBottom: 18,
              }}>
                {f.icon}
              </div>

              <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 8, letterSpacing: "-0.1px" }}>
                {f.title}
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.34)", lineHeight: 1.7 }}>
                {f.desc}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <style>{`
        @media(max-width:768px){
          .features-grid{grid-template-columns:1fr!important}
        }
      `}</style>
    </section>
  );
}
