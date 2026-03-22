import { motion } from "framer-motion";

const variants = {
  primary:
    "bg-[#E85D3A] text-white hover:bg-[#d14e2d] shadow-md hover:shadow-lg",
  secondary:
    "border-2 border-[#E85D3A] text-[#E85D3A] hover:bg-[#E85D3A]/10",
  ghost: "bg-transparent text-[#E85D3A] hover:bg-[#E85D3A]/5",
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
      className={`inline-flex items-center justify-center font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#E85D3A]/50 disabled:opacity-50 disabled:pointer-events-none ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    >
      {children}
    </motion.button>
  );
}
