"use client";
export default function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7059f0"/>
          <stop offset="1" stopColor="#8470f2"/>
        </linearGradient>
      </defs>
      <path d="M20 2L34 10.5V27.5L20 36L6 27.5V10.5L20 2Z" stroke="url(#lg)" strokeWidth="1.5" fill="none"/>
      <path d="M20 2L34 10.5V27.5L20 36L6 27.5V10.5L20 2Z" fill="url(#lg)" opacity="0.08"/>
      <path d="M26.5 14C24.5 12.5 22.3 12 20 12C14.5 12 10.5 15.6 10.5 20C10.5 24.4 14.5 28 20 28C22.3 28 24.5 27.5 26.5 26"
        stroke="url(#lg)" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
      <circle cx="20" cy="20" r="2" fill="#7059f0"/>
      <circle cx="26.5" cy="14" r="1.5" fill="#8470f2" opacity="0.85"/>
      <circle cx="26.5" cy="26" r="1.5" fill="#8470f2" opacity="0.85"/>
    </svg>
  );
}
