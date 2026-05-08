import { TopNav } from "./TopNav";
import { Footer } from "./Footer";
import { getCurrentAdmin } from "@/lib/supabase/server";

export async function PageShell({ children }: { children: React.ReactNode }) {
  const admin = await getCurrentAdmin();
  return (
    <div className="mx-auto w-full max-w-[1100px] px-5 sm:px-8 py-6 flex flex-col gap-8">
      <TopNav admin={admin} />
      {children}
      <Footer />
    </div>
  );
}
