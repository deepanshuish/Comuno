"use client";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";

// ── Logo images ───────────────────────────────────────────────────

// ── Partner data ────────────────────────────────────────────────

const PARTNERS = [
  {
    logo: <img src="https://upload.wikimedia.org/wikipedia/en/thumb/7/75/Aditya_Birla_Group_Logo.svg/1280px-Aditya_Birla_Group_Logo.svg.png" alt="ABG" style={{ width: 50, height: 50, objectFit: "contain" }} />,
    name: "Aditya Birla Group",
    type: "Global Enterprise Partner",
    desc: "Full-cycle talent intelligence deployed across a multinational conglomerate spanning 40+ countries — from AI screening to structured onboarding at global scale.",
  },
  {
    logo: <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/Indian_Army_Circular_Insignia.svg/1280px-Indian_Army_Circular_Insignia.svg.png" alt="Defence" style={{ width: 50, height: 50, objectFit: "contain" }} />,
    name: "National Defence Forces",
    type: "Strategic Defence Partner",
    desc: "Mission-critical talent pipeline and technical development programmes built to the highest operational standards and security compliance.",
  },
];

export default function Partners() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="partners" style={{ padding: "100px 24px", position: "relative" }} ref={ref}>
      <div style={{ position: "absolute", top: 0, left: "10%", right: "10%", height: 1, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.13), transparent)" }} />

      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.55 }}
          style={{ marginBottom: 56 }}
        >
          <p className="section-label" style={{ marginBottom: 14 }}>Trusted Partners</p>
          <h2 style={{ fontSize: "clamp(28px,4vw,48px)", fontWeight: 700, color: "#fff", letterSpacing: "-1.5px", lineHeight: 1.1, marginBottom: 14, maxWidth: 520 }}>
            Trusted by world-class organisations.
          </h2>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.58)", maxWidth: 420, lineHeight: 1.65 }}>
            From global enterprise conglomerates to national defence forces — powering the talent intelligence layer that operates at the highest stakes.
          </p>
        </motion.div>

        {/* Partner cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 16, marginBottom: 16 }}>
          {PARTNERS.map((p, i) => (
            <motion.div
              key={p.name}
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.15 + i * 0.12, duration: 0.5 }}
              style={{
                background: "#13141f",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 14, padding: "28px 26px",
                transition: "border-color 0.18s",
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.16)")}
              onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}
            >
              {/* Identity row */}
              <div style={{ display: "flex", alignItems: "center", gap: 14, paddingBottom: 20, borderBottom: "1px solid rgba(255,255,255,0.07)", marginBottom: 20 }}>
                {/* Logo container */}
                <div style={{
                  width: 58, height: 58, borderRadius: 12, flexShrink: 0,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  filter: "grayscale(1) brightness(0.9)",
                }}>
                  {p.logo}
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 4 }}>{p.name}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.35)", letterSpacing: "0.03em" }}>{p.type}</div>
                </div>
              </div>

              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.42)", lineHeight: 1.7 }}>{p.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* Testimonial */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.4, duration: 0.5 }}
          style={{ background: "#13141f", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "28px 32px" }}
        >
          <div style={{ display: "flex", gap: 2, marginBottom: 16 }}>
            {[1,2,3,4,5].map(n => <span key={n} style={{ fontSize: 13, color: "#f59e0b" }}>★</span>)}
          </div>
          <p style={{ fontSize: 16, color: "rgba(255,255,255,0.58)", lineHeight: 1.7, fontStyle: "italic", marginBottom: 20, maxWidth: 580 }}>
            "Comuno transformed how we operate talent across a global footprint. What used to take months now happens in days — with better outcomes and full visibility."
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 8,
              background: "rgba(112,89,240,0.12)", border: "1px solid rgba(112,89,240,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, fontWeight: 800, color: "#8787d8",
            }}>VP</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>VP, Talent Acquisition</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.34)" }}>Aditya Birla Group</div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
