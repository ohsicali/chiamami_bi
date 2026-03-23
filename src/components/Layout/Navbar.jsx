import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { LogoFull } from "../UI/Logo";
import { useAuth } from "../../lib/hooks/useAuth";
import DarkModeToggle from "./DarkModeToggle";
import LanguageSwitcher from "./LanguageSwitcher";

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

const UserIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

export default function Navbar({ view = "map", onToggleView }) {
  const { user, profile } = useAuth();

  const avatar = profile?.avatar_url;
  const initials = (profile?.full_name || user?.email?.split("@")[0] || "")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 glass">
      <div className="flex items-center justify-between px-4 py-3 max-w-screen-lg mx-auto">
        {/* Logo — click to go home */}
        <Link to="/">
          <LogoFull height={28} />
        </Link>

        {/* Right side buttons */}
        <div className="flex items-center gap-2">
          {/* Language switcher */}
          <LanguageSwitcher />

          {/* Dark mode toggle */}
          <DarkModeToggle />

          {/* View toggle */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            whileHover={{ scale: 1.05 }}
            onClick={onToggleView}
            className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/60 backdrop-blur-sm text-gray-700 hover:text-[#FF5757] transition-colors shadow-sm"
            aria-label={view === "map" ? "Switch to list view" : "Switch to map view"}
          >
            {view === "map" ? <ListIcon /> : <MapIcon />}
          </motion.button>

          {/* User avatar / login */}
          <Link to={user ? "/profile" : "/login"}>
            <motion.div
              whileTap={{ scale: 0.9 }}
              whileHover={{ scale: 1.05 }}
              className="flex items-center justify-center w-9 h-9 rounded-xl shadow-sm overflow-hidden transition-colors"
              style={{
                backgroundColor: user ? "#FF5757" : "rgba(255,255,255,0.6)",
                backdropFilter: user ? "none" : "blur(8px)",
                WebkitBackdropFilter: user ? "none" : "blur(8px)",
              }}
            >
              {user && avatar ? (
                <img
                  src={avatar}
                  alt="Profilo"
                  className="w-full h-full object-cover"
                />
              ) : user ? (
                <span className="text-xs font-bold text-white">
                  {initials || "?"}
                </span>
              ) : (
                <span className="text-gray-700">
                  <UserIcon />
                </span>
              )}
            </motion.div>
          </Link>
        </div>
      </div>
    </nav>
  );
}
