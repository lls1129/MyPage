import type { Metadata } from "next";
import { PageShell } from "../components/PageShell";
import { requestOtp, verifyOtp } from "./actions";

export const metadata: Metadata = {
  title: "login · my world",
  description: "admin sign-in",
};

export default async function LoginPage(props: PageProps<"/login">) {
  const params = await props.searchParams;
  const stage = typeof params?.stage === "string" ? params.stage : "request";
  const email = typeof params?.email === "string" ? params.email : "";
  const error = typeof params?.error === "string" ? params.error : undefined;
  const next = typeof params?.next === "string" ? params.next : "/admin";

  return (
    <PageShell>
      <section className="max-w-[440px] mx-auto w-full mt-8">
        <header className="text-center">
          <p className="label text-lavender-600">admin only ✦</p>
          <h1 className="font-script text-pink-600 text-[44px] md:text-[52px] leading-none mt-2">
            let me in ✿
          </h1>
          <p className="text-sm text-ink/80 mt-3">
            {stage === "verify"
              ? "we sent a one-time code to your email."
              : "we'll email you a one-time code. no passwords, ever."}
          </p>
        </header>

        {stage === "verify" ? (
          <form
            action={verifyOtp}
            className="mt-8 rounded-lg bg-white border border-pink-100 shadow-soft p-6 flex flex-col gap-4"
          >
            <input type="hidden" name="email" value={email} />
            <input type="hidden" name="next" value={next} />

            <div className="text-xs text-lavender-600 font-semibold">
              code sent to <span className="text-pink-800">{email}</span>
            </div>

            <label htmlFor="token" className="label text-pink-600">
              code from email
            </label>
            <input
              id="token"
              name="token"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9 ]{6,12}"
              placeholder="••••••••"
              required
              autoFocus
              className="bg-pink-50 border border-pink-100 rounded-sm px-3 py-2 text-lg font-mono tracking-[0.4em] text-center text-ink placeholder:text-pink-200 focus:outline-none focus:border-pink-200"
            />

            {error ? (
              <p className="text-xs text-pink-600 font-semibold">{error}</p>
            ) : null}

            <button
              type="submit"
              className="lift rounded-pill bg-pink-200 text-white border border-pink-200 shadow-soft hover:border-pink-400 px-4 py-2 text-sm font-semibold"
            >
              verify code →
            </button>

            <p className="text-xs text-lavender-600 text-center">
              didn&apos;t get one?{" "}
              <a
                href={`/login${next !== "/admin" ? `?next=${encodeURIComponent(next)}` : ""}`}
                className="text-pink-600 underline decoration-pink-200 underline-offset-2 hover:decoration-pink-400 font-semibold"
              >
                resend
              </a>
            </p>
          </form>
        ) : (
          <form
            action={requestOtp}
            className="mt-8 rounded-lg bg-white border border-pink-100 shadow-soft p-6 flex flex-col gap-4"
          >
            <input type="hidden" name="next" value={next} />
            <label htmlFor="email" className="label text-pink-600">
              email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              defaultValue={email}
              className="bg-pink-50 border border-pink-100 rounded-sm px-3 py-2 text-sm text-ink placeholder:text-pink-400 focus:outline-none focus:border-pink-200"
            />

            {error ? (
              <p className="text-xs text-pink-600 font-semibold">{error}</p>
            ) : null}

            <button
              type="submit"
              className="lift rounded-pill bg-pink-200 text-white border border-pink-200 shadow-soft hover:border-pink-400 px-4 py-2 text-sm font-semibold"
            >
              send the code →
            </button>
          </form>
        )}
      </section>
    </PageShell>
  );
}
