import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "../components/PageShell";
import { posts, formatDate } from "@/content/blog/posts";

export const metadata: Metadata = {
  title: "blog · my world",
  description: "soft notes, kept here",
};

export default function BlogIndex() {
  const sorted = [...posts].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <PageShell>
      <header className="mt-2">
        <p className="label text-lavender-600 mb-2">writing ✦</p>
        <h1 className="font-script text-pink-600 text-[40px] md:text-[48px] leading-none">
          the blog
        </h1>
        <p className="text-ink/80 text-sm mt-3 max-w-prose">
          short notes, mostly about staying soft, looking up, and small
          well-fed days.
        </p>
      </header>

      <ul className="flex flex-col gap-4 mt-4">
        {sorted.map((post) => (
          <li key={post.slug}>
            <Link
              href={`/blog/${post.slug}`}
              className="lift block rounded-lg bg-white border border-pink-100 shadow-soft p-6 hover:border-pink-200"
            >
              <div className="flex items-baseline justify-between gap-4 flex-wrap">
                <h2 className="font-serif text-pink-800 text-xl leading-snug">
                  {post.title}
                </h2>
                <span className="text-xs text-lavender-600 font-semibold whitespace-nowrap">
                  {formatDate(post.date)} · {post.readMinutes} min read
                </span>
              </div>
              <p className="font-serif text-ink/85 text-[15px] leading-[1.7] mt-2">
                {post.excerpt}
              </p>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {post.tags.map((t) => (
                  <span
                    key={t}
                    className="text-[11px] text-pink-800 bg-pink-50 border border-pink-100 rounded-pill px-2 py-[2px] font-semibold"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </PageShell>
  );
}
