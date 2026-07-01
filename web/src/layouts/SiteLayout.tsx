import { Outlet, Link, NavLink, useLocation } from "react-router-dom";
import { WalletButton } from "../components/WalletButton";

function marketingNavClass(isActive: boolean): string {
  return isActive
    ? "text-foreground"
    : "text-muted transition hover:text-foreground";
}

export function SiteLayout() {
  const { pathname } = useLocation();
  const isApp = pathname.startsWith("/app");

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

      <header className="sticky top-0 z-20 border-b border-border-low/80 bg-bg1/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/20 text-sm font-bold text-accent">
              VP
            </span>
            <span className="font-semibold tracking-tight">
              Vesting Positions
            </span>
          </Link>

          <nav className="hidden items-center gap-6 text-sm md:flex">
            {isApp ? (
              <>
                <Link to="/" className={marketingNavClass(false)}>
                  Overview
                </Link>
                <Link
                  to="/#calculator"
                  className={marketingNavClass(false)}
                >
                  Simulator
                </Link>
                <NavLink
                  to="/app"
                  end
                  className={({ isActive }) => marketingNavClass(isActive)}
                >
                  App
                </NavLink>
                <NavLink
                  to="/app/profile"
                  className={({ isActive }) => marketingNavClass(isActive)}
                >
                  Profile
                </NavLink>
              </>
            ) : (
              <>
                <a href="#features" className={marketingNavClass(false)}>
                  Features
                </a>
                <a href="#how-it-works" className={marketingNavClass(false)}>
                  How it works
                </a>
                <a href="#calculator" className={marketingNavClass(false)}>
                  Simulator
                </a>
                <NavLink
                  to="/app"
                  className={({ isActive }) => marketingNavClass(isActive)}
                >
                  App
                </NavLink>
                <NavLink
                  to="/app/profile"
                  className={({ isActive }) => marketingNavClass(isActive)}
                >
                  Profile
                </NavLink>
              </>
            )}
          </nav>

          <WalletButton />
        </div>
      </header>

      <Outlet />

      <footer className="relative z-10 border-t border-border-low">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>Vesting Positions Protocol · MIT License</p>
          <p>Built during Turbine Builder Cohort Q2 2026</p>
        </div>
      </footer>
    </div>
  );
}
