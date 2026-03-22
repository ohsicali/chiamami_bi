export function LoadingSpinner({ size = 40, className = "" }) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        xmlns="http://www.w3.org/2000/svg"
        className="animate-spin"
      >
        <circle
          cx="20"
          cy="20"
          r="16"
          fill="none"
          stroke="#E85D3A"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="80"
          strokeDashoffset="60"
          opacity="0.9"
        />
        <circle
          cx="20"
          cy="20"
          r="16"
          fill="none"
          stroke="#E85D3A"
          strokeWidth="3"
          opacity="0.2"
        />
      </svg>
    </div>
  );
}

export function SkeletonCard({ className = "" }) {
  return (
    <div
      className={`rounded-2xl overflow-hidden bg-white shadow-md ${className}`}
    >
      {/* Image placeholder */}
      <div className="skeleton h-40 w-full" />

      <div className="p-4 space-y-3">
        {/* Title */}
        <div className="skeleton h-5 w-3/4 rounded-md" />

        {/* Rating row */}
        <div className="flex items-center gap-2">
          <div className="skeleton h-4 w-20 rounded-md" />
          <div className="skeleton h-4 w-10 rounded-md" />
        </div>

        {/* Category badges */}
        <div className="flex gap-2">
          <div className="skeleton h-5 w-16 rounded-full" />
          <div className="skeleton h-5 w-20 rounded-full" />
        </div>

        {/* Address */}
        <div className="skeleton h-4 w-full rounded-md" />
        <div className="skeleton h-4 w-2/3 rounded-md" />
      </div>
    </div>
  );
}

export default LoadingSpinner;
