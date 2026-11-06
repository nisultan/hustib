import type { Metadata, Viewport } from "next";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import { MobileHeaderLinks, MobileNav, Sidebar } from "@/components/Nav";
import { GlobalSearch } from "@/components/Search";
import { AddTaskButton } from "@/components/TaskDialog";
import { AssistantButton } from "@/components/AssistantButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TourHost } from "@/components/Tour";
import { Lock } from "@/components/Lock";
import { SyncBanner } from "@/components/SyncBanner";
import { PageTransition } from "@/components/PageTransition";
import { Main } from "@/components/Main";
import { APPEARANCE_INIT_SCRIPT } from "@/lib/appearance";
import { Logo } from "@/components/Logo";
import { MotionProvider } from "@/lib/motion";

export const metadata: Metadata = {
  title: "Lock In",
  description:
    "One place for your tasks, your plan for the day, your habits and your goals — and a clear answer to what to work on next.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fcfaf8" },
    { media: "(prefers-color-scheme: dark)", color: "#1e1e1e" },
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
        <MotionProvider>
          <StoreProvider>
            <Lock>
              <Sidebar />

              <div className="md:pl-[var(--nav-w)]">
                {/*
                  On a phone this is the whole toolbar — there is no sidebar.
                  On a desktop, search, adding a task and the sidebar switch
                  all live in the sidebar now, so the header shrinks to two
                  quiet icons in the corner on the page's own colour, with no
                  rule under it: the page starts at the top of the window
                  instead of below a bar.

                  Search stays mounted at every size, only its trigger hides:
                  it owns the Ctrl+K listener and the palette the sidebar opens.
                */}
                <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-bg/90 px-4 py-2.5 backdrop-blur-md md:border-transparent md:bg-bg md:px-6 md:py-2 md:backdrop-blur-none">
                  <Logo className="md:hidden" />
                  <div className="flex-1 md:hidden">
                    <GlobalSearch />
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <AssistantButton />
                    <ThemeToggle />
                    <MobileHeaderLinks />
                    <div className="md:hidden">
                      <AddTaskButton compact />
                    </div>
                  </div>
                </header>

                <SyncBanner />

                <Main>
                  <PageTransition>{children}</PageTransition>
                </Main>
              </div>

              <MobileNav />
              <TourHost />
            </Lock>
          </StoreProvider>
        </MotionProvider>
      </body>
    </html>
  );
}
