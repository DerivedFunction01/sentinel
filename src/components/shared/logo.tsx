import React from "react";

interface LogoIconProps {
  className?: string; // Custom class for the container (e.g., bg-slate-900, bg-blue-600)
  iconClassName?: string; // Custom class for the SVG/Shield icon (e.g., text-white, text-blue-600)
  size?: "sm" | "md" | "lg"; // Predefined size configurations matching current usage
}

export function LogoIcon({
  className = "",
  iconClassName = "",
  size = "sm",
}: LogoIconProps) {
  const sizeClasses = {
    sm: "h-8 w-8 rounded-lg",
    md: "h-9 w-9 rounded-lg",
    lg: "h-16 w-16 rounded-2xl",
  };

  const iconSizes = {
    sm: "h-5 w-5",
    md: "h-5 w-5",
    lg: "h-8 w-8",
  };

  return (
    <div
      className={`flex items-center justify-center bg-slate-950 border border-slate-800/80 shadow-md ${sizeClasses[size]} ${className}`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#0da2e7"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`${iconSizes[size]} ${iconClassName}`}
      >
        <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      </svg>
    </div>
  );
}
