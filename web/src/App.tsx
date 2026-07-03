import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { SiteLayout } from "./layouts/SiteLayout";
import { MarketingPage } from "./pages/MarketingPage";

const AppPage = lazy(() =>
  import("./pages/AppPage").then((m) => ({ default: m.AppPage })),
);
const ProfilePage = lazy(() =>
  import("./pages/ProfilePage").then((m) => ({ default: m.ProfilePage })),
);

function RouteFallback() {
  return (
    <main className="relative z-10 mx-auto max-w-6xl px-6 pb-24 pt-10">
      <p className="text-sm text-muted">Loading…</p>
    </main>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<SiteLayout />}>
          <Route index element={<MarketingPage />} />
          <Route
            path="app"
            element={
              <Suspense fallback={<RouteFallback />}>
                <AppPage />
              </Suspense>
            }
          />
          <Route
            path="app/profile"
            element={
              <Suspense fallback={<RouteFallback />}>
                <ProfilePage />
              </Suspense>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
