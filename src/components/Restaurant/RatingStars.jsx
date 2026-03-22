import { motion } from "framer-motion";

const sizeMap = {
  sm: 14,
  md: 20,
  lg: 28,
};

function StarFull({ size, color }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z" />
    </svg>
  );
}

function StarHalf({ size, color }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="halfGrad">
          <stop offset="50%" stopColor={color} />
          <stop offset="50%" stopColor={color} stopOpacity="0.2" />
        </linearGradient>
      </defs>
      <path
        d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z"
        fill="url(#halfGrad)"
      />
    </svg>
  );
}

function StarEmpty({ size, color }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z"
        fill={color}
        opacity="0.2"
      />
    </svg>
  );
}

export default function RatingStars({
  rating = 0,
  size = "md",
  animated = false,
  className = "",
}) {
  const starSize = sizeMap[size] || sizeMap.md;
  const color = "#E85D3A";
  const fullStars = Math.floor(rating);
  const hasHalf = rating - fullStars >= 0.25 && rating - fullStars < 0.75;
  const adjustedFull = rating - fullStars >= 0.75 ? fullStars + 1 : fullStars;

  const stars = [];
  for (let i = 0; i < 5; i++) {
    if (i < adjustedFull) {
      stars.push(<StarFull key={i} size={starSize} color={color} />);
    } else if (i === adjustedFull && hasHalf) {
      stars.push(<StarHalf key={i} size={starSize} color={color} />);
    } else {
      stars.push(<StarEmpty key={i} size={starSize} color={color} />);
    }
  }

  return (
    <div className={`inline-flex items-center gap-0.5 ${className}`}>
      {stars.map((star, i) =>
        animated ? (
          <motion.span
            key={i}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              delay: i * 0.2,
              type: "spring",
              stiffness: 400,
              damping: 15,
            }}
          >
            {star}
          </motion.span>
        ) : (
          <span key={i}>{star}</span>
        )
      )}
    </div>
  );
}
