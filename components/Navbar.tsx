"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Logo from "./Logo";

const LINKS = ["Platform", "Solutions", "Partners", "Pricing"];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <>
      {/* ── Cortex announcement bar ── */}
      <div style={{
        background: "#eaeaf8",
        color: "#1a1a2e",
        fontSize: 13,
        fontWeight: 500,
        textAlign: "center",
        padding: "9px 24px",
        position: "fixed",
        top: 0, left: 0, right: 0,
        zIndex: 101,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
      }}>
        Comuno is now available in 50+ languages across global markets. →
        <a href="#" style={{ color: "#7059f0", fontWeight: 700, textDecoration: "none" }}>Learn more</a>
      </div>

      {/* ── Nav ── */}
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.5, ease: [0.22,1,0.36,1] }}
        style={{
          position: "fixed",
          top: 38, left: 0, right: 0,
          zIndex: 100,
          background: scrolled ? "rgba(12,13,22,0.92)" : "transparent",
          backdropFilter: scrolled ? "blur(20px)" : "none",
          borderBottom: scrolled ? "1px solid var(--border)" : "1px solid transparent",
          transition: "background 0.3s ease, border-color 0.3s ease, backdrop-filter 0.3s ease",
        }}
      >
        <div style={{
          maxWidth: 1200, margin: "0 auto",
          padding: "0 28px", height: 62,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          {/* Logo */}
          <a href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", marginRight: 16 }}>
            <Logo size={30} />
            <span style={{ fontSize: 16, fontWeight: 700, color: "#fff", letterSpacing: "-0.2px" }}>comuno</span>
          </a>

          {/* Links */}
          <div style={{ display: "flex", alignItems: "center", flex: 1 }} className="nav-desktop">
            {LINKS.map(l => (
              <a key={l} href={`#${l.toLowerCase()}`}
                style={{
                  fontSize: 14, fontWeight: 500,
                  color: "rgba(255,255,255,0.55)",
                  textDecoration: "none",
                  padding: "6px 14px",
                  borderRadius: 7,
                  transition: "color 0.15s, background 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.55)"; e.currentTarget.style.background = "transparent"; }}>
                {l}
              </a>
            ))}
          </div>

          {/* CTA */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }} className="nav-desktop">
            <a href="/login" style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.55)", textDecoration: "none", padding: "6px 12px", transition: "color 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.color = "#fff"}
              onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.55)"}>
              Log in
            </a>
            <a href="/signup" className="btn btn-nav">Start for free →</a>
          </div>

          {/* Mobile toggle */}
          <button className="nav-mobile" onClick={() => setOpen(!open)}
            style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.7)", display: "none", padding: 4 }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              {open
                ? <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                : <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
              }
            </svg>
          </button>
        </div>

        <AnimatePresence>
          {open && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              style={{ background: "rgba(12,13,22,0.98)", borderTop: "1px solid var(--border)", overflow: "hidden" }}>
              <div style={{ padding: "12px 28px 24px", display: "flex", flexDirection: "column", gap: 2 }}>
                {LINKS.map(l => (
                  <a key={l} href={`#${l.toLowerCase()}`} onClick={() => setOpen(false)}
                    style={{ fontSize: 15, fontWeight: 500, color: "var(--t2)", textDecoration: "none", padding: "11px 0", borderBottom: "1px solid var(--border)" }}>
                    {l}
                  </a>
                ))}
                <a href="/login" style={{ fontSize: 15, fontWeight: 500, color: "var(--t2)", textDecoration: "none", padding: "11px 0" }}>Log in</a>
                <a href="/signup" className="btn btn-purple" style={{ marginTop: 14 }}>Start for free</a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>

      <style>{`
        @media(max-width:768px){
          .nav-desktop{display:none!important}
          .nav-mobile{display:flex!important}
          nav{padding:0 16px!important}
        }
      `}</style>
    </>
  );
}
