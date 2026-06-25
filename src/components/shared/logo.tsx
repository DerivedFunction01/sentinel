import { BetweenHorizontalStart } from "lucide-react";
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
      <BetweenHorizontalStart
        className={`${iconSizes[size]} ${iconClassName} text-blue-600`}
      />
    </div>
  );
}
