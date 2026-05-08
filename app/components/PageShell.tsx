import { TopNav } from "./TopNav";
import { Footer } from "./Footer";

export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[1100px] px-5 sm:px-8 py-6 flex flex-col gap-8">
      <TopNav />
      {children}
      <Footer />
    </div>
  );
}
