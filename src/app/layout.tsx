import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IsItStable.com — Should You Update?",
  description: "Community-driven stability verdicts for open source packages. Because 'latest' doesn't mean 'greatest'.",
  metadataBase: new URL("https://isitstable.com"),
  openGraph: {
    title: "IsItStable.com — Should You Update?",
    description: "Community-driven stability verdicts for open source packages.",
    url: "https://isitstable.com",
    siteName: "IsItStable.com",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "IsItStable.com — Should You Update?",
    description: "Community-driven stability verdicts for open source packages.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col antialiased">
        <nav className="border-b border-[var(--color-border)] px-6 py-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <a href="/" className="text-xl font-bold tracking-tight hover:opacity-80 transition-opacity">
              🔍 IsItStable<span className="text-[var(--color-muted)]">.com</span>
            </a>
            <div className="flex items-center gap-4 text-sm text-[var(--color-muted)]">
              <a href="https://github.com/exisz/isitstable" target="_blank" rel="noopener" className="hover:text-white transition-colors">GitHub</a>
              <a href="https://github.com/sponsors/exisz" target="_blank" rel="noopener" className="hover:text-white transition-colors">Sponsor 💛</a>
            </div>
          </div>
        </nav>
        <main className="flex-1">
          {children}
        </main>
        <footer className="border-t border-[var(--color-border)] px-6 py-8 text-center text-sm text-[var(--color-muted)]">
          <p>Made with mass anxiety and <code className="text-[var(--color-foreground)]">npm install</code></p>
          <p className="mt-2">
            <a href="https://github.com/exisz/isitstable" target="_blank" rel="noopener" className="hover:text-white transition-colors">GitHub</a>
            {" · "}
            <a href="https://github.com/sponsors/exisz" target="_blank" rel="noopener" className="hover:text-white transition-colors">Sponsor</a>
            {" · "}
            <a href="/api/v1/openclaw/verdict" className="hover:text-white transition-colors">API</a>
          </p>
        </footer>
      </body>
    </html>
  );
}
