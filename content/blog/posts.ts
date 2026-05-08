// Manifest of blog posts. Each MDX body lives at `content/blog/<slug>.mdx`.
// Listing slugs explicitly here keeps generateStaticParams happy and gives
// the list view full metadata without parsing MDX frontmatter.

export type PostMeta = {
  slug: string;
  title: string;
  date: string; // ISO YYYY-MM-DD
  excerpt: string;
  tags: string[];
  readMinutes: number;
};

export const posts: PostMeta[] = [
  {
    slug: "staying-soft",
    title: "On staying soft in a sharp year",
    date: "2026-05-04",
    excerpt:
      "A short note about keeping kindness intact when the world keeps trying to teach you the opposite.",
    tags: ["soft", "thoughts"],
    readMinutes: 6,
  },
];

export function getPost(slug: string): PostMeta | undefined {
  return posts.find((p) => p.slug === slug);
}

export function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
