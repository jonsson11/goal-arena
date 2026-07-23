export function PodiumIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="8" y="55" width="24" height="35" rx="4" fill="currentColor" opacity="0.6" />
      <rect x="38" y="35" width="24" height="55" rx="4" fill="currentColor" />
      <rect x="68" y="65" width="24" height="25" rx="4" fill="currentColor" opacity="0.6" />
      <text
        x="50"
        y="55"
        textAnchor="middle"
        fontSize="18"
        fontWeight="bold"
        fill="#0B1220"
      >
        1
      </text>
    </svg>
  );
}