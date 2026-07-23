export function GridIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <line x1="34" y1="8" x2="34" y2="92" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
      <line x1="66" y1="8" x2="66" y2="92" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
      <line x1="8" y1="34" x2="92" y2="34" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
      <line x1="8" y1="66" x2="92" y2="66" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
    </svg>
  );
}