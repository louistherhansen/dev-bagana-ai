import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/hooks/useAuth";

export const metadata: Metadata = {
  title: "BAGANA AI — Content Strategy Platform",
  description:
    "AI-powered platform for KOL, influencer, and content creator agencies to manage content strategy at scale.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#134e4a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased safe-area-padding">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
