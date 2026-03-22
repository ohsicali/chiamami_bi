import { motion } from "framer-motion";
import { LogoFull } from "../UI/Logo";

const ListIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);

const MapIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
    <line x1="8" y1="2" x2="8" y2="18" />
    <line x1="16" y1="6" x2="16" y2="22" />
  </svg>
);

export default function Navbar({ view = "map", onToggleView }) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-40 glass">
      <div className="flex items-center justify-between px-4 py-3 max-w-screen-lg mx-auto">
        {/* Logo */}
        <LogoFull height={22} />

        {/* View toggle */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          whileHover={{ scale: 1.05 }}
          onClick={onToggleView}
          className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/60 backdrop-blur-sm text-gray-700 hover:text-[#E85D3A] transition-colors shadow-sm"
          aria-label={view === "map" ? "Switch to list view" : "Switch to map view"}
        >
          {view === "map" ? <ListIcon /> : <MapIcon />}
        </motion.button>
      </div>
    </nav>
  );
}
