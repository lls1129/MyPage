import type { MDXComponents } from "mdx/types";

// Map MDX-rendered HTML elements onto the my-world palette.
// Body text leans editorial/serif here so blog posts read like prose;
// the homepage and section UIs stay in Quicksand.
const components: MDXComponents = {
  h1: ({ children }) => (
    <h1 className="font-script text-pink-600 text-[40px] md:text-[48px] leading-tight mt-8 mb-4">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="font-script text-pink-600 text-[28px] md:text-[32px] leading-tight mt-10 mb-3">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="font-semibold text-pink-800 text-lg mt-8 mb-2 tracking-tight">
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="font-serif text-ink/90 text-[17px] leading-[1.75] mb-5">
      {children}
    </p>
  ),
  a: ({ children, href }) => (
    <a
      href={href}
      className="text-pink-600 underline decoration-pink-200 underline-offset-2 hover:decoration-pink-400"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="font-serif italic text-pink-800 border-l-2 border-pink-200 pl-5 my-6 text-[18px] leading-relaxed">
      {children}
    </blockquote>
  ),
  ul: ({ children }) => (
    <ul className="font-serif text-ink/90 list-disc pl-6 mb-5 leading-[1.75] marker:text-pink-400">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="font-serif text-ink/90 list-decimal pl-6 mb-5 leading-[1.75] marker:text-pink-400">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="mb-1">{children}</li>,
  hr: () => (
    <hr className="border-0 my-10 text-center text-pink-200 before:content-['✿'] before:text-2xl" />
  ),
  code: ({ children }) => (
    <code className="font-mono text-[0.92em] bg-pink-50 border border-pink-100 rounded px-1.5 py-0.5 text-pink-800">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="font-mono text-sm bg-skynavy-700 text-cream rounded-md p-4 overflow-x-auto my-6">
      {children}
    </pre>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-pink-800">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
};

export function useMDXComponents(): MDXComponents {
  return components;
}
