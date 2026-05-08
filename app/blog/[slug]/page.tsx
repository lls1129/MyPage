import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "../../components/PageShell";
import { posts, getPost, formatDate } from "@/content/blog/posts";

export const dynamicParams = false;

export function generateStaticParams() {
  return posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata(
  props: PageProps<"/blog/[slug]">
): Promise<Metadata> {
  const { slug } = await props.params;
  const post = getPost(slug);
  if (!post) return { title: "blog · my world" };
  return {
    title: `${post.title} · my world`,
    description: post.excerpt,
  };
}

export default async function BlogPost(props: PageProps<"/blog/[slug]">) {
  const { slug } = await props.params;
  const post = getPost(slug);
  if (!post) notFound();

  const { default: Body } = await import(`@/content/blog/${slug}.mdx`);

  return (
    <PageShell>
      <article className="max-w-[680px] mx-auto w-full">
        <Link
          href="/blog"
          className="text-xs font-semibold text-pink-600 hover:text-pink-800"
        >
          ← back to all posts
        </Link>

        <header className="mt-4">
          <h1 className="font-script text-pink-600 text-[40px] md:text-[56px] leading-none">
            {post.title}
          </h1>
          <p className="text-xs text-lavender-600 font-semibold mt-3 tracking-wide">
            {formatDate(post.date)} · {post.readMinutes} min read
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
        </header>

        <div className="mt-6">
          <Body />
        </div>

        <div
          aria-hidden
          className="mt-14 text-center font-script text-pink-400 text-3xl"
        >
          ✦ ✿ ✦
        </div>
      </article>
    </PageShell>
  );
}
