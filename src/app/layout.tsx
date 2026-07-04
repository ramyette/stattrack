import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "StatTrack",
  description: "Track YouTube video performance in one place.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {children}
        <footer className="border-t border-[var(--border)] bg-[var(--background)] px-5 py-8 text-sm text-[var(--muted)] sm:px-8 lg:px-12">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} StatTrack</p>
            <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Legal">
              <Link className="transition hover:text-[var(--foreground)]" href="/legal#privacy">Privacy</Link>
              <Link className="transition hover:text-[var(--foreground)]" href="/legal#terms">Terms</Link>
              <Link className="transition hover:text-[var(--foreground)]" href="/legal#payments">Payments</Link>
              <Link className="transition hover:text-[var(--foreground)]" href="/legal#cookies">Cookies &amp; Storage</Link>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
