import type { Metadata } from "next";
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
