/** Comuno mark: a solid rounded square with a "c" cut-out and a brand-green signal dot. */
export default function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#18181b" />
      <path d="M21.5 11.2A7 7 0 1 0 21.5 20.8" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" />
      <circle cx="22.6" cy="16" r="2.4" fill="#12b76a" />
    </svg>
  );
}
