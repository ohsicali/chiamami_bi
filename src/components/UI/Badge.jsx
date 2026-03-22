export default function Badge({
  children,
  color = "#E85D3A",
  className = "",
}) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}
      style={{
        backgroundColor: `${color}20`,
        color: color,
      }}
    >
      {children}
    </span>
  );
}
