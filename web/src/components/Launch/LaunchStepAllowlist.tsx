import { useRef } from "react";
import {
  buildAllowListFromCsv,
  formatAllowlistLimits,
  MAX_ALLOWLIST_CSV_BYTES,
  type AllowListSnapshot,
} from "../../lib/allow-list";
import { isSupabaseConfigured } from "../../lib/supabase";
import { formatTokens } from "../../lib/vesting";
import { truncate } from "../../lib/utils";
import { Button } from "@/components/ui/button";
import {
  AppCallout,
  CopyButton,
  EntityCard,
  EntityCardContent,
  EntityCardMeta,
  SectionHeader,
} from "../Common/Common";

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
    onParsingChange(true);
    onErrorChange(null);
    try {
      const res = await fetch("/sample-allowlist.csv");
      if (!res.ok) {
        onSnapshotChange(null);
        onErrorChange("Failed to load sample allowlist.");
        return;
      }
      await loadAllowlistCsv(await res.text());
    } catch (err) {
      onSnapshotChange(null);
      onErrorChange(err instanceof Error ? err.message : String(err));
    } finally {
      onParsingChange(false);
    }
  }

  const totalAllocation = snapshot?.entries.reduce(
    (sum, entry) => sum + entry.allocation,
    0n,
  );

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Recipient allowlist"
        description={
          <>
            Upload a semicolon-separated CSV with{" "}
            <code className="font-mono">wallet;amount</code> columns (amount in
            base token units). MVP limit: {formatAllowlistLimits()}. The merkle
            root is derived from this file and stored per campaign
            {isSupabaseConfigured()
              ? " in Supabase"
              : " when Supabase is configured"}
            .
          </>
        }
      />

      <EntityCard size="sm">
        <EntityCardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleCsvFile(file);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="outline"
              disabled={parsing}
              onClick={() => fileInputRef.current?.click()}
            >
              {parsing ? "Parsing…" : "Upload CSV"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={parsing}
              onClick={() => void loadSampleAllowlist()}
            >
              Load sample allowlist
            </Button>
          </div>

          {error && <AppCallout tone="error">{error}</AppCallout>}

          {snapshot && (
            <EntityCardMeta
              rows={[
                {
                  label: "Recipients",
                  value: snapshot.entries.length,
                },
                {
                  label: "Total allocation",
                  value: (
                    <span className="font-mono">
                      {totalAllocation != null
                        ? formatTokens(totalAllocation)
                        : "—"}
                    </span>
                  ),
                },
                {
                  label: "Merkle root",
                  value: (
                    <span className="inline-flex items-center gap-1 font-mono">
                      <span title={snapshot.merkleRoot}>
                        {truncate(snapshot.merkleRoot, 12, 12)}
                      </span>
                      <CopyButton
                        value={snapshot.merkleRoot}
                        label="Copy merkle root"
                      />
                    </span>
                  ),
                  fullWidth: true,
                },
              ]}
            />
          )}
        </EntityCardContent>
      </EntityCard>
    </div>
  );
}
