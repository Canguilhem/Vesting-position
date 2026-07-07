import { Outlet } from "react-router-dom";

import Header from "./Header";

export function SiteLayout() {
  return (
    <div className="relative min-h-screen overflow-x-clip bg-bg1 text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-grid opacity-40"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-accent/15 blur-[120px]"
      />

      <Header />

      <Outlet />

      <footer className="relative z-10 border-t border-border-low">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>Vesting Positions Protocol · MIT License</p>
          <p>
            Built during{" "}
            <a
              className="text-accent hover:underline"
              href="https://turbin3.org"
              target="_blank"
            >
              Turbine
            </a>{" "}
            Builder Cohort Q2 2026
          </p>
        </div>
      </footer>
    </div>
  );
}
