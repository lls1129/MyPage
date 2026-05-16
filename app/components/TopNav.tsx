"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { signOut } from "../admin/actions";

const NAV = [
  { href: "/", label: "home" },
  { href: "/photos", label: "photos" },
  { href: "/astronomy", label: "astronomy" },
  { href: "/explore", label: "explore" },
  { href: "/divination", label: "divination" },
  { href: "/bio", label: "bio" },
  { href: "/blog", label: "blog" },
  { href: "/meals", label: "meals" },
  { href: "/pets", label: "pets" },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function TopNav({
  admin,
}: {
  admin: { email: string } | null;
}) {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);

  // Close the drawer whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      <nav className="flex items-center justify-between gap-3">
        {/* Brand pill — visible on mobile so the bar isn't empty next to the
            hamburger; hidden on md+ where the full pill list takes over. */}
        <Link
          href="/"
          className="md:hidden lift inline-flex items-center rounded-pill px-4 py-2 text-sm font-semibold bg-white text-pink-800 border border-pink-100"
        >
          ✿ my world
        </Link>

        {/* Desktop pill list. flex-1 + overflow-x-auto so on widths where the
            row would otherwise wrap (iPad portrait, narrow laptops) the tabs
            scroll horizontally instead. Items must not shrink so they keep
            their natural width. Scrollbar hidden — drag/trackpad to scroll. */}
        <ul className="hidden md:flex items-center gap-2 flex-1 min-w-0 overflow-x-auto no-scrollbar">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href} className="shrink-0">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={
                    "lift inline-flex items-center rounded-pill px-4 py-2 text-sm font-semibold border whitespace-nowrap " +
                    (active
                      ? "bg-pink-200 text-white border-pink-200 shadow-soft"
                      : "bg-white text-pink-800 border-pink-100 hover:border-pink-200")
                  }
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center gap-2 shrink-0">
          {/* Admin / login pill — visible on both. The admin link is hidden on
              mobile because it lives inside the drawer, but sign-out and login
              stay handy. */}
          {admin ? (
            <>
              <Link
                href="/admin"
                className={
                  "hidden md:inline-flex lift items-center rounded-pill px-4 py-2 text-sm font-semibold border " +
                  (pathname.startsWith("/admin")
                    ? "bg-pink-200 text-white border-pink-200 shadow-soft"
                    : "bg-white text-pink-800 border-pink-100 hover:border-pink-200")
                }
                title={admin.email}
              >
                ✿ admin
              </Link>
              <form action={signOut} className="hidden md:block">
                <button
                  type="submit"
                  className="lift inline-flex items-center rounded-pill px-4 py-2 text-sm font-semibold bg-white text-pink-800 border border-pink-100 hover:border-pink-200"
                >
                  sign out
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/login"
              className="hidden md:inline-flex lift items-center rounded-pill px-4 py-2 text-sm font-semibold bg-white text-pink-800 border border-pink-100 hover:border-pink-200"
            >
              login
            </Link>
          )}

          {/* Mobile hamburger — md hidden */}
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="open menu"
            aria-expanded={open}
            className="md:hidden lift inline-flex items-center justify-center w-10 h-10 rounded-full bg-white text-pink-800 border border-pink-100 hover:border-pink-200 text-lg"
          >
            ☰
          </button>
        </div>
      </nav>

      {open ? <MobileDrawer pathname={pathname} admin={admin} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function MobileDrawer({
  pathname,
  admin,
  onClose,
}: {
  pathname: string;
  admin: { email: string } | null;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[120] bg-skynavy-900/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <aside
        className="absolute right-0 top-0 bottom-0 w-72 max-w-[85vw] bg-pink-50 border-l border-pink-100 shadow-soft flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-2 p-4 border-b border-pink-100">
          <p className="font-script text-pink-600 text-2xl leading-none">my world ✿</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="close menu"
            className="w-9 h-9 rounded-full bg-white text-pink-800 border border-pink-100 hover:border-pink-200 flex items-center justify-center"
          >
            ✕
          </button>
        </header>

        <ul className="flex flex-col gap-2 p-4 flex-1 overflow-auto">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={
                    "block rounded-md px-4 py-3 text-base font-semibold transition-colors " +
                    (active
                      ? "bg-pink-200 text-white shadow-soft"
                      : "bg-white text-pink-800 border border-pink-100 hover:border-pink-200")
                  }
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <footer className="p-4 border-t border-pink-100 flex flex-col gap-2">
          {admin ? (
            <>
              <Link
                href="/admin"
                className={
                  "block rounded-md px-4 py-3 text-base font-semibold transition-colors " +
                  (pathname.startsWith("/admin")
                    ? "bg-pink-200 text-white shadow-soft"
                    : "bg-white text-pink-800 border border-pink-100 hover:border-pink-200")
                }
                title={admin.email}
              >
                ✿ admin
              </Link>
              <form action={signOut}>
                <button
                  type="submit"
                  className="w-full rounded-md px-4 py-3 text-base font-semibold bg-white text-pink-800 border border-pink-100 hover:border-pink-200"
                >
                  sign out
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/login"
              className="block rounded-md px-4 py-3 text-base font-semibold bg-white text-pink-800 border border-pink-100 hover:border-pink-200"
            >
              login
            </Link>
          )}
        </footer>
      </aside>
    </div>,
    document.body
  );
}
