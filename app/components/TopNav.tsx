"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "../admin/actions";

const NAV = [
  { href: "/", label: "home" },
  { href: "/photos", label: "photos" },
  { href: "/astronomy", label: "astronomy" },
  { href: "/explore", label: "explore" },
  { href: "/bio", label: "bio" },
  { href: "/blog", label: "blog" },
  { href: "/meals", label: "meals" },
];

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
  return (
    <nav className="flex items-center justify-between gap-3 flex-wrap">
      <ul className="flex items-center gap-2 flex-wrap">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={
                  "lift inline-flex items-center rounded-pill px-4 py-2 text-sm font-semibold border " +
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

      {admin ? (
        <div className="flex items-center gap-2">
          <Link
            href="/admin"
            className={
              "lift inline-flex items-center rounded-pill px-4 py-2 text-sm font-semibold border " +
              (pathname.startsWith("/admin")
                ? "bg-pink-200 text-white border-pink-200 shadow-soft"
                : "bg-white text-pink-800 border-pink-100 hover:border-pink-200")
            }
            title={admin.email}
          >
            ✿ admin
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="lift inline-flex items-center rounded-pill px-4 py-2 text-sm font-semibold bg-white text-pink-800 border border-pink-100 hover:border-pink-200"
            >
              sign out
            </button>
          </form>
        </div>
      ) : (
        <Link
          href="/login"
          className="lift inline-flex items-center rounded-pill px-4 py-2 text-sm font-semibold bg-white text-pink-800 border border-pink-100 hover:border-pink-200"
        >
          login
        </Link>
      )}
    </nav>
  );
}
