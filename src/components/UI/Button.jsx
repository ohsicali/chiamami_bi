import { motion } from "framer-motion";

const variants = {
  primary:
    "bg-[#FF5757] text-white hover:bg-[#e64545] shadow-md hover:shadow-lg",
  secondary:
    "border-2 border-[#FF5757] text-[#FF5757] hover:bg-[#FF5757]/10",
  ghost: "bg-transparent text-[#FF5757] hover:bg-[#FF5757]/5",
};

const sizes = {
  sm: "px-3 py-1.5 text-sm rounded-lg",
  md: "px-5 py-2.5 text-base rounded-xl",
  lg: "px-7 py-3.5 text-lg rounded-xl",
};

export default function Button({
  variant = "primary",
  size = "md",
  children,
  className = "",
  ...rest
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      whileHover={{ scale: 1.02 }}
      className={`inline-flex items-center justify-center font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#FF5757]/50 disabled:opacity-50 disabled:pointer-events-none ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    >
      {children}
    </motion.button>
  );
}
