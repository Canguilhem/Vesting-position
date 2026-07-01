import { ProfilePanel } from "../components/ProfilePanel";

export function ProfilePage() {
  return (
    <main className="relative z-10 mx-auto max-w-6xl px-6 pb-24 pt-10">
      <section className="space-y-6 rounded-2xl border border-border-low bg-card p-6">
        <ProfilePanel />
      </section>
    </main>
  );
}
