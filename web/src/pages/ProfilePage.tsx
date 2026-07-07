import { ProfilePanel } from "../components/ProfilePanel";
import { PageHeader } from "../components/Common/Common";

export function ProfilePage() {
  return (
    <main className="relative z-10 mx-auto max-w-6xl space-y-8 px-6 pb-24 pt-10">
      <PageHeader
        eyebrow="Profile"
        title="Your activity"
        description="Campaigns you launched, distribution tokens you minted, and vesting position NFTs you hold."
      />
      <ProfilePanel />
    </main>
  );
}
