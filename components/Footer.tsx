"use client";
import Logo from "./Logo";

const COLS = [
  { heading: "Platform",  links: ["AI Screening","AI Interviews","Onboarding","Training","Analytics"] },
  { heading: "Solutions", links: ["Enterprise","Defence","Startups","Staffing","Government"] },
  { heading: "Company",   links: ["About","Blog","Careers","Press","Contact"] },
  { heading: "Legal",     links: ["Privacy","Terms","Security","Cookies"] },
];

export default function Footer() {
  return (
    <footer style={{ borderTop: "1px solid var(--border)", padding: "56px 24px 32px" }}>
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        {/* Top row */}
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr repeat(4,1fr)", gap: 40, marginBottom: 52 }} className="footer-grid">
          {/* Brand */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <Logo size={24} />
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--t1)" }}>comuno</span>
            </div>
            <p style={{ fontSize: 12, color: "var(--t3)", lineHeight: 1.7, maxWidth: 220 }}>
              The unified talent intelligence platform for enterprises that need to move fast without compromising quality.
            </p>
          </div>

          {/* Link columns */}
          {COLS.map(col => (
            <div key={col.heading}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--t3)", letterSpacing: "0.09em", textTransform: "uppercase", marginBottom: 14 }}>{col.heading}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {col.links.map(l => (
                  <a key={l} href="#" style={{ fontSize: 13, color: "var(--t3)", textDecoration: "none", transition: "color 0.15s" }}
                    onMouseEnter={e => e.currentTarget.style.color = "var(--t1)"}
                    onMouseLeave={e => e.currentTarget.style.color = "var(--t3)"}>
                    {l}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom row */}
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 24, display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <span style={{ fontSize: 12, color: "var(--t4)" }}>
            © 2024 Easecruit Technologies Pvt. Ltd. All rights reserved.
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            {["SOC 2", "ISO 27001", "GDPR", "CCPA"].map(b => (
              <span key={b} style={{ fontSize: 10, fontWeight: 700, color: "var(--t4)", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 4, padding: "3px 8px" }}>{b}</span>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @media(max-width:768px){
          .footer-grid{grid-template-columns:1fr 1fr!important}
        }
      `}</style>
    </footer>
  );
}
