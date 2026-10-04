import type { Metadata } from "next";
import { Amiri, IBM_Plex_Sans_Arabic } from "next/font/google";
import "./globals.css";

const sans = IBM_Plex_Sans_Arabic({
  variable: "--font-sans-ar",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
});

// Source texts (Quran and hadith) are shown in a Naskh face.
const naskh = Amiri({
  variable: "--font-naskh",
  subsets: ["arabic"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "ميزان | Mizan",
  description:
    "ميزان يفحص الآيات والأحاديث والأقوال المنسوبة في محتواك قبل النشر، ويريك النص كما ورد في مصدره.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ar" dir="rtl" className={`${sans.variable} ${naskh.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
