/**
 * Dynamic Logo Configuration
 * 
 * This file contains the logo configuration that can be easily
 * modified or loaded from an API/database in the future.
 */

export type LogoPosition = "left" | "center" | "right";

export type LogoConfig = {
  path: string;
  alt: string;
  text?: string;
  href?: string;
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  className?: string;
  position?: LogoPosition;
};

/**
 * Default logo configuration
 * Can be extended to load from API or database
 */
export const LOGO_CONFIG: LogoConfig = {
  path: "/bagana-ai-logo.png",
  alt: "BAGANA AI Logo",
  text: "BAGANA AI",
  href: "/",
  size: "md",
  showText: true,
  className: "",
  position: "left", // Default: pojok kiri
};

/**
 * Get current logo configuration
 */
export function getLogoConfig(): LogoConfig {
  return { ...LOGO_CONFIG };
}

/**
 * Update logo configuration
 */
export function updateLogoConfig(config: Partial<LogoConfig>): void {
  Object.assign(LOGO_CONFIG, config);
}

/**
 * Set logo path
 */
export function setLogoPath(path: string): void {
  LOGO_CONFIG.path = path;
}

/**
 * Set logo text
 */
export function setLogoText(text: string): void {
  LOGO_CONFIG.text = text;
}

/**
 * Set logo href
 */
export function setLogoHref(href: string): void {
  LOGO_CONFIG.href = href;
}

/**
 * Set logo size
 */
export function setLogoSize(size: "sm" | "md" | "lg" | "xl"): void {
  LOGO_CONFIG.size = size;
}

/**
 * Set show text
 */
export function setShowText(showText: boolean): void {
  LOGO_CONFIG.showText = showText;
}

/**
 * Set logo position
 */
export function setLogoPosition(position: LogoPosition): void {
  LOGO_CONFIG.position = position;
}
