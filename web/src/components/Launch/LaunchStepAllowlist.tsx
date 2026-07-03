import { useRef } from "react";
import {
  buildAllowListFromCsv,
  formatAllowlistLimits,
  MAX_ALLOWLIST_CSV_BYTES,
  type AllowListSnapshot,
} from "../../lib/allow-list";
import { isSupabaseConfigured } from "../../lib/supabase";
import { formatTokens } from "../../lib/vesting";

export function LaunchStepAllowlist({
  snapshot,
  error,
  parsing,
  onSnapshotChange,
  onErrorChange,
  onParsingChange,
}: {
  snapshot: AllowListSnapshot | null;
  error: string | null;
  parsing: boolean;
  onSnapshotChange: (snapshot: AllowListSnapshot | null) => void;
  onErrorChange: (error: string | null) => void;
  onParsingChange: (parsing: boolean) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function loadAllowlistCsv(csv: string, byteLength?: number) {
    onParsingChange(true);
    onErrorChange(null);
    try {
      const { snapshot: next } = await buildAllowListFromCsv(csv, { byteLength });
      onSnapshotChange(next);
    } catch (err) {
      onSnapshotChange(null);
      onErrorChange(err instanceof Error ? err.message : String(err));
    } finally {
      onParsingChange(false);
    }
  }

  async function handleCsvFile(file: File) {
    if (file.size > MAX_ALLOWLIST_CSV_BYTES) {
      onSnapshotChange(null);
      onErrorChange(
        `File is too large (${Math.ceil(file.size / 1024)} KB). MVP limit: ${formatAllowlistLimits()}.`,
      );
      return;
    }
    const csv = await file.text();
    await loadAllowlistCsv(csv, file.size);
  }

  async function loadSampleAllowlist() {
    const res = await fetch("/sample-allowlist.csv");
    if (!res.ok) {
      onErrorChange("Failed to load sample allowlist.");
      return;
    }
    await loadAllowlistCsv(await res.text());
  }

  const totalAllocation = snapshot?.entries.reduce(
    (sum, entry) => sum + entry.allocation,
    0n,
  );

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Recipient allowlist</h3>
        <p className="max-w-2xl text-sm text-muted">
          Upload a semicolon-separated CSV with{" "}
          <code className="font-mono">wallet;amount</code> columns (amount in
          base token units). MVP limit: {formatAllowlistLimits()}. The merkle
          root is derived from this file and stored per campaign
          {isSupabaseConfigured()
            ? " in Supabase"
            : " when Supabase is configured"}
          .
        </p>
      </div>

      <div className="rounded-xl border border-border-low bg-card/30 p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleCsvFile(file);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            disabled={parsing}
            onClick={() => fileInputRef.current?.click()}
            className="rounded-lg border border-border-low px-3 py-2 text-sm transition hover:border-accent/30 disabled:opacity-50 cursor-pointer"
          >
            {parsing ? "Parsing…" : "Upload CSV"}
          </button>
          <button
            type="button"
            disabled={parsing}
            onClick={() => void loadSampleAllowlist()}
            className="rounded-lg border border-border-low px-3 py-2 text-sm text-muted transition hover:border-accent/30 disabled:opacity-50 cursor-pointer"
          >
            Load sample allowlist
          </button>
        </div>

        {error && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        )}

        {snapshot && (
          <dl className="grid gap-2 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted">Recipients</dt>
              <dd className="font-medium">{snapshot.entries.length}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Total allocation</dt>
              <dd className="font-medium font-mono text-xs">
                {totalAllocation != null
                  ? formatTokens(totalAllocation)
                  : "—"}
              </dd>
            </div>
            <div className="sm:col-span-3">
              <dt className="text-xs text-muted">Merkle root</dt>
              <dd className="font-mono text-xs break-all">
                {snapshot.merkleRoot}
              </dd>
            </div>
          </dl>
        )}
      </div>
    </div>
  );
}
