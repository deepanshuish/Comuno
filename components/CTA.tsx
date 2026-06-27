"use client";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import Logo from "./Logo";

export default function CTA() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section style={{ padding: "80px 24px 120px", position: "relative" }} ref={ref}>
      <div style={{ position: "absolute", top: 0, left: "10%", right: "10%", height: 1, background: "linear-gradient(90deg, transparent, var(--border-md), transparent)" }} />

      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.65, ease: [0.22,1,0.36,1] }}
          style={{
            position: "relative",
            background: "var(--surface)",
            border: "1px solid var(--border-md)",
            borderRadius: 18,
            padding: "clamp(40px,6vw,72px) clamp(28px,5vw,64px)",
            textAlign: "center",
            overflow: "hidden",
          }}
        >
          {/* Cortex-style purple glow top */}
          <div style={{
            position: "absolute",
            top: -80, left: "50%", transform: "translateX(-50%)",
            width: 400, height: 200,
            background: "radial-gradient(ellipse, rgba(112,89,240,0.22) 0%, transparent 70%)",
            pointerEvents: "none",
          }} />

          {/* Faint grid */}
          <div style={{
            position: "absolute", inset: 0,
            backgroundImage: "linear-gradient(rgba(112,89,240,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(112,89,240,0.04) 1px,transparent 1px)",
            backgroundSize: "44px 44px",
            pointerEvents: "none",
          }} />

          <div style={{ position: "relative", zIndex: 2 }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
              <Logo size={44} />
            </div>

            <p className="tag" style={{ justifyContent: "center", marginBottom: 18 }}>
              The Talent Intelligence Platform
            </p>

            <h2 style={{
              fontSize: "clamp(30px,4.5vw,56px)",
              fontWeight: 700,
              color: "#fff",
              letterSpacing: "-1.5px",
              lineHeight: 1.06,
              marginBottom: 16,
            }}>
              Ready to transform<br />your talent operations?
            </h2>

            <p style={{ fontSize: 15, color: "var(--t2)", maxWidth: 420, margin: "0 auto 38px", lineHeight: 1.65 }}>
              Join global enterprises and organisations that run their full talent lifecycle on Comuno.
            </p>

            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginBottom: 32 }}>
              <a href="mailto:hello@easecruit.com" className="btn btn-purple" style={{ fontSize: 15, padding: "13px 30px" }}>
                Book a live demo
              </a>
              <a href="mailto:hello@easecruit.com" className="btn btn-ghost" style={{ fontSize: 14, padding: "13px 22px" }}>
                Contact sales
              </a>
            </div>

            <div style={{ display: "flex", gap: 28, justifyContent: "center", flexWrap: "wrap" }}>
              {["No credit card required", "14-day free trial", "Enterprise SLAs"].map(item => (
                <span key={item} style={{ fontSize: 12, color: "var(--t3)", display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ color: "var(--green)", fontSize: 13 }}>✓</span>{item}
                </span>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
