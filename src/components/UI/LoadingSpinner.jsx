import { LogoLoader } from './Logo'

export function LoadingSpinner({ size = 48, className = "" }) {
  return <LogoLoader size={size} className={className} />
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
