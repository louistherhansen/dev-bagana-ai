"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getLogoConfig, type LogoConfig } from "@/lib/logo-config";

type LogoProps = {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  href?: string;
  className?: string;
  logoPath?: string;
  alt?: string;
  text?: string;
  dynamic?: boolean;
};

const sizeMap = {
  sm: { container: "w-8 h-8", image: 24, padding: "4px", text: "text-sm" },
  md: { container: "w-10 h-10 sm:w-12 sm:h-12", image: 32, padding: "6px", text: "text-lg" },
  lg: { container: "w-16 h-16 sm:w-20 sm:h-20", image: 64, padding: "10px", text: "text-xl" },
  xl: { container: "w-20 h-20 sm:w-24 sm:h-24", image: 80, padding: "12px", text: "text-2xl" },
};

export function Logo({ 
  size,
  showText,
  href,
  className = "",
  logoPath,
  alt,
  text,
  dynamic = false,
}: LogoProps) {
  const [logoConfig, setLogoConfig] = useState<LogoConfig | null>(null);

  // Load logo config (always load default, refresh if dynamic)
  useEffect(() => {
    const config = getLogoConfig();
    setLogoConfig(config);
  }, [dynamic]);

  // Use props if provided, otherwise use config, otherwise use defaults
  const finalSize = size || logoConfig?.size || "md";
  const finalShowText = showText !== undefined ? showText : (logoConfig?.showText ?? false);
  const finalHref = href !== undefined ? href : (logoConfig?.href || "/");
  const finalLogoPath = logoPath || logoConfig?.path || "/bagana-ai-logo.png";
  const finalAlt = alt || logoConfig?.alt || "BAGANA AI Logo";
  const finalText = text || logoConfig?.text || "BAGANA AI";
  const finalClassName = className || logoConfig?.className || "";
  const sizeConfig = sizeMap[finalSize];
  const logoElement = (
    <div
      className={`relative rounded-full overflow-hidden flex items-center justify-center ${
        sizeConfig.container
      } bg-gradient-to-br from-bagana-primary/10 via-white to-bagana-muted/30 border-2 border-bagana-primary/30 shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105 hover:border-bagana-primary/50 ${finalClassName}`}
      style={{ padding: sizeConfig.padding }}
    >
      <Image
        src={finalLogoPath}
        alt={finalAlt}
        width={sizeConfig.image}
        height={sizeConfig.image}
        className="object-contain"
        style={{ maxWidth: "100%", maxHeight: "100%" }}
        priority
        sizes={`${sizeConfig.image}px`}
      />
      {/* Glow effect on hover */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-bagana-primary/0 via-bagana-primary/5 to-bagana-primary/0 opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
    </div>
  );

  if (finalHref) {
    return (
      <Link
        href={finalHref}
        className={`flex items-center gap-2 shrink-0 hover:opacity-90 transition-opacity duration-200 focus:outline-none focus:ring-2 focus:ring-bagana-primary/20 focus:ring-offset-2 rounded-lg group ${finalClassName}`}
        aria-label={`${finalText} Home`}
      >
        {logoElement}
        {finalShowText && (
          <span className={`hidden sm:inline ${sizeConfig.text} font-semibold text-bagana-dark whitespace-nowrap group-hover:text-bagana-primary transition-colors`}>
            {finalText}
          </span>
        )}
      </Link>
    );
  }

  return logoElement;
}
