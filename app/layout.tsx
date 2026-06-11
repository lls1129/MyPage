import type { Metadata, Viewport } from "next";
import { Quicksand, Caveat, Noto_Serif_TC } from "next/font/google";
import "./globals.css";

const quicksand = Quicksand({
  variable: "--font-quicksand",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  weight: ["500", "700"],
});

// Traditional Chinese serif for the divination stick / formal labels.
// CJK fonts are large so we skip preload — they'll load on demand.
const notoSerifTC = Noto_Serif_TC({
  variable: "--font-noto-serif-tc",
  weight: ["500", "700"],
  preload: false,
  display: "swap",
});

export const metadata: Metadata = {
  title: "my world ✿",
  description: "a personal corner of the internet",
};

// Without this, iOS Safari renders the page into a 980px layout
// viewport and scales it down to fit, which makes
// visualViewport.scale ≈ 0.4. Pointer-event clientX/Y and
// getBoundingClientRect() end up in different coordinate spaces and
// the overlay drawing offset grows linearly with distance from the
// origin. Locking width=device-width / scale=1 puts them back in
// sync.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${quicksand.variable} ${caveat.variable} ${notoSerifTC.variable}`}
    >
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
