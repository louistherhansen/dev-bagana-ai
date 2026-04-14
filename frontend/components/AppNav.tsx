"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { getNavItems, type NavItem } from "@/lib/nav-config";
import { useAuth } from "@/lib/hooks/useAuth";

export function AppNav({
  items,
  currentPath,
  dynamic = false,
}: {
  items?: NavItem[];
  currentPath?: string;
  dynamic?: boolean;
}) {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Initialize with items if provided, otherwise use dynamic items if dynamic mode is enabled
  const [navItems, setNavItems] = useState<NavItem[]>(() => {
    if (items) return items;
    if (dynamic) return getNavItems();
    return [];
  });

  // Update nav items when items prop or dynamic mode changes
  useEffect(() => {
    if (items) {
      // If items prop is provided, use it (takes precedence)
      setNavItems(items);
    } else if (dynamic) {
      // Otherwise, use dynamic items if dynamic mode is enabled
      setNavItems(getNavItems());
    } else {
      // Fallback to empty array
      setNavItems([]);
    }
  }, [dynamic, items]);

  // Close dropdown when clicking outside (for mobile/click mode)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      // Check if click is outside all dropdowns
      const dropdowns = document.querySelectorAll('[data-dropdown]');
      let isInsideDropdown = false;
      dropdowns.forEach((dropdown) => {
        if (dropdown.contains(target)) {
          isInsideDropdown = true;
        }
      });
      if (!isInsideDropdown && openDropdown) {
        setOpenDropdown(null);
      }
      // Check if click is outside user menu
      if (userMenuRef.current && !userMenuRef.current.contains(target)) {
        setUserMenuOpen(false);
      }
    };

    if (openDropdown || userMenuOpen) {
      // Only add listener for mobile/click interactions
      // Hover interactions are handled by onMouseLeave
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [openDropdown, userMenuOpen]);

  const isSubmenuActive = (item: NavItem): boolean => {
    if (!item.submenu) return false;
    return item.submenu.some(subItem => currentPath === subItem.href);
  };

  const renderNavItem = (item: NavItem, isMobile = false) => {
    const isActive = currentPath === item.href || isSubmenuActive(item);
    const hasSubmenu = item.submenu && item.submenu.length > 0;

    if (hasSubmenu) {
      return (
        <div 
          key={item.href} 
          className="relative" 
          data-dropdown={item.href}
          ref={isMobile ? null : dropdownRef}
          onMouseEnter={() => !isMobile && setOpenDropdown(item.href)}
          onMouseLeave={() => !isMobile && setOpenDropdown(null)}
        >
          <button
            onClick={() => {
              if (isMobile) {
                setOpenDropdown(openDropdown === item.href ? null : item.href);
              } else {
                setOpenDropdown(openDropdown === item.href ? null : item.href);
              }
            }}
            className={`text-sm font-medium transition-colors touch-target flex items-center gap-1.5 ${
              isActive
                ? "text-bagana-primary border-b-2 border-bagana-primary pb-0.5"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {item.label}
            <svg
              className={`w-4 h-4 transition-transform ${openDropdown === item.href ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            {item.badge && (
              <span className="ml-1 px-1.5 py-0.5 text-xs font-semibold rounded-full bg-bagana-primary/10 text-bagana-primary">
                {item.badge}
              </span>
            )}
          </button>
          {openDropdown === item.href && (
            <div
              className={`${
                isMobile
                  ? "mt-2 ml-4 space-y-1"
                  : "absolute top-full left-0 mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg py-2 z-50"
              }`}
            >
              {item.submenu
                ?.filter(subItem => subItem.visible !== false)
                .map((subItem) => {
                  const isSubActive = currentPath === subItem.href;
                  return (
                    <Link
                      key={subItem.href}
                      href={subItem.href}
                      onClick={() => {
                        setMobileOpen(false);
                        setOpenDropdown(null);
                      }}
                      className={`block px-4 py-2 text-sm transition-colors ${
                        isSubActive
                          ? "text-bagana-primary bg-bagana-primary/5 font-medium"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                    >
                      {subItem.label}
                    </Link>
                  );
                })}
            </div>
          )}
        </div>
      );
    }

    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setMobileOpen(false)}
        className={`text-sm font-medium transition-colors touch-target flex items-center gap-1.5 ${
          isActive
            ? "text-bagana-primary border-b-2 border-bagana-primary pb-0.5"
            : "text-slate-500 hover:text-slate-700"
        }`}
      >
        {item.label}
        {item.badge && (
          <span className="ml-1 px-1.5 py-0.5 text-xs font-semibold rounded-full bg-bagana-primary/10 text-bagana-primary">
            {item.badge}
          </span>
        )}
      </Link>
    );
  };

  const navLinks = (
    <>
      {navItems.map((item) => renderNavItem(item, false))}
    </>
  );

  const mobileNavLinks = (
    <>
      {navItems.map((item) => renderNavItem(item, true))}
    </>
  );

  return (
    <>
      {/* Desktop nav */}
      <nav className="hidden lg:flex flex-wrap gap-4 xl:gap-6 items-center">
        {navLinks}
        {user ? (
          <div className="relative pl-4 border-l border-slate-200" ref={userMenuRef}>
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-800 transition-colors"
            >
              <span className="font-medium">{user.username || user.email}</span>
              <svg
                className={`w-4 h-4 transition-transform ${userMenuOpen ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {userMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-200 rounded-lg shadow-lg py-2 z-50">
                <div className="px-4 py-2 text-sm font-medium text-slate-900 border-b border-slate-200">
                  {user.username || user.email}
                </div>
                <Link
                  href="/change-password"
                  onClick={() => setUserMenuOpen(false)}
                  className="block px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                >
                  Change Password
                </Link>
                <button
                  onClick={() => {
                    setUserMenuOpen(false);
                    logout();
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link
            href="/login"
            className="text-sm font-medium text-bagana-primary hover:text-bagana-secondary transition-colors"
          >
            Login
          </Link>
        )}
      </nav>

      {/* Mobile: hamburger + overlay */}
      <div className="lg:hidden relative">
        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="touch-target flex items-center justify-center rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-800"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>

        {mobileOpen && (
          <>
            <div
              className="fixed inset-0 bg-slate-900/20 z-40 lg:hidden"
              onClick={() => setMobileOpen(false)}
              aria-hidden
            />
            <nav
              className="fixed right-0 top-0 bottom-0 w-64 max-w-[85vw] bg-white border-l border-slate-200 shadow-xl z-50 flex flex-col gap-1 p-4 pt-16 overflow-y-auto"
              aria-label="Mobile navigation"
            >
              {mobileNavLinks}
              <div className="mt-4 pt-4 border-t border-slate-200">
                {user ? (
                  <>
                    <div className="px-4 py-2 text-sm font-medium text-slate-900 border-b border-slate-200 mb-2">
                      {user.username || user.email}
                    </div>
                    <Link
                      href="/change-password"
                      onClick={() => setMobileOpen(false)}
                      className="block px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                    >
                      Change Password
                    </Link>
                    <button
                      onClick={() => {
                        logout();
                        setMobileOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                    >
                      Logout
                    </button>
                  </>
                ) : (
                  <Link
                    href="/login"
                    onClick={() => setMobileOpen(false)}
                    className="block px-4 py-2 text-sm font-medium text-bagana-primary hover:bg-slate-50 transition-colors"
                  >
                    Login
                  </Link>
                )}
              </div>
            </nav>
          </>
        )}
      </div>
    </>
  );
}

// Legacy export for backward compatibility
// Returns the nav items array (for compatibility with existing code)
export const MAIN_NAV_ITEMS = getNavItems();
