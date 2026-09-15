import type { Metadata, Viewport } from "next";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import { MobileHeaderLinks, MobileNav, Sidebar } from "@/components/Nav";
import { GlobalSearch } from "@/components/Search";
import { AddTaskButton } from "@/components/TaskDialog";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TourHost } from "@/components/Tour";
import { Lock } from "@/components/Lock";
import { APPEARANCE_INIT_SCRIPT } from "@/lib/appearance";

export const metadata: Metadata = {
  title: "IB Learner — Student Productivity Hub",
  description:
    "One place for tasks, notes, grades and university applications — and a clear answer to what to work on next.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfbfc" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0e" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Applies the saved theme, accent and block size before first paint,
            so the defaults never flash before the student's choices load. */}
        <script dangerouslySetInnerHTML={{ __html: APPEARANCE_INIT_SCRIPT }} />
      </head>
      <body>
        <StoreProvider>
          <Lock>
            <Sidebar />

            <div className="md:pl-[232px]">
              <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-bg/85 px-4 py-2.5 backdrop-blur-md md:px-8">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-accent text-[13px] font-bold text-white md:hidden">
                  IB
                </span>
                <div className="flex-1 md:flex-none">
                  <GlobalSearch />
                </div>
                <div className="ml-auto flex items-center gap-1.5">
                  <ThemeToggle />
                  <MobileHeaderLinks />
                  <AddTaskButton compact />
                </div>
              </header>

              <main className="mx-auto w-full max-w-5xl px-4 pb-24 pt-6 md:px-8 md:pb-16 md:pt-8">
                {children}
              </main>
            </div>

            <MobileNav />
            <TourHost />
          </Lock>
        </StoreProvider>
      </body>
    </html>
  );
}
