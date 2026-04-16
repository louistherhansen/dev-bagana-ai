/**
 * Dynamic Navigation Menu Configuration
 * 
 * This file contains the navigation menu structure that can be easily
 * modified or loaded from an API/database in the future.
 */

export type NavItem = {
  href: string;
  label: string;
  icon?: string;
  badge?: string | number;
  visible?: boolean;
  order?: number;
  /** If set, only these roles can see this item. */
  roles?: string[];
  submenu?: NavItem[]; // Submenu items
};

export type NavGroup = {
  title?: string;
  items: NavItem[];
};

/**
 * Main navigation items configuration
 * Can be extended to load from API or database
 */
export const NAV_CONFIG: NavItem[] = [
  { href: "/", label: "Home", order: 1, visible: true },
  { href: "/chat", label: "Chat", order: 2, visible: true },
  { 
    href: "/dashboard", 
    label: "Features", 
    order: 3, 
    visible: true,
    submenu: [
      { href: "/plans", label: "Plans", order: 1, visible: true },
      { href: "/reports", label: "Reports", order: 2, visible: true, roles: ["admin", "moderator"] },
      { href: "/optimization", label: "Optimization", order: 3, visible: true, roles: ["admin", "moderator"] },
      { href: "/sentiment", label: "Sentiment", order: 4, visible: true },
      { href: "/trends", label: "Trends", order: 5, visible: true },
      { href: "/review", label: "Review", order: 6, visible: true, roles: ["admin", "moderator"] },
    ]
  },
  { href: "/calendar", label: "Calendar", order: 9, visible: true, roles: ["admin", "moderator"] },
  { href: "/settings", label: "Settings", order: 12, visible: true, roles: ["admin", "moderator"] },
];

function isAllowedForRole(item: NavItem, role?: string | null): boolean {
  if (!item.roles || item.roles.length === 0) return true;
  if (!role) return false;
  return item.roles.includes(role);
}

function filterNavItemsByRole(items: NavItem[], role?: string | null): NavItem[] {
  const out: NavItem[] = [];
  for (const item of items) {
    if (item.visible === false) continue;
    if (!isAllowedForRole(item, role)) continue;

    if (item.submenu && item.submenu.length > 0) {
      const filteredSub = filterNavItemsByRole(item.submenu, role).sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
      if (filteredSub.length === 0) continue;
      out.push({ ...item, submenu: filteredSub });
    } else {
      out.push(item);
    }
  }
  return out;
}

/**
 * Get visible navigation items sorted by order
 */
export function getNavItems(role?: string | null): NavItem[] {
  return filterNavItemsByRole(NAV_CONFIG, role).sort((a, b) => {
    const orderA = a.order ?? 999;
    const orderB = b.order ?? 999;
    return orderA - orderB;
  });
}

/**
 * Get navigation item by href
 */
export function getNavItem(href: string): NavItem | undefined {
  return NAV_CONFIG.find((item) => item.href === href);
}

/**
 * Update navigation item visibility
 */
export function setNavItemVisible(href: string, visible: boolean): void {
  const item = NAV_CONFIG.find((item) => item.href === href);
  if (item) {
    item.visible = visible;
  }
}

/**
 * Add or update navigation item
 */
export function upsertNavItem(item: NavItem): void {
  const index = NAV_CONFIG.findIndex((i) => i.href === item.href);
  if (index >= 0) {
    NAV_CONFIG[index] = { ...NAV_CONFIG[index], ...item };
  } else {
    NAV_CONFIG.push(item);
  }
}
