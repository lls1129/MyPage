import Link from "next/link";

export function BlogTile() {
  return (
    <Link
      href="/blog"
      className="lift rounded-lg bg-white border border-pink-100 shadow-soft p-5 flex flex-col gap-2 hover:border-pink-200"
    >
      <div className="label text-pink-600">latest post</div>
      <div className="font-serif text-pink-800 text-lg leading-snug">
        On staying soft in a sharp year
      </div>
      <div className="text-xs text-lavender-600 font-medium mt-auto">
        may 4 · 6 min read
      </div>
    </Link>
  );
}
