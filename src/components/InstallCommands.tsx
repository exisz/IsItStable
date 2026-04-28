"use client";
import { useState } from "react";

export function InstallCommands({ packageName, version }: { packageName: string; version: string }) {
  const npmCmd = `npm install ${packageName}@${version}`;
  const clawCmd = `openclaw update --channel stable`;
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  function copy(text: string, idx: number) {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 bg-[var(--color-background)] rounded-lg px-4 py-2 border border-[var(--color-border)]">
        <code className="text-sm font-mono truncate">{npmCmd}</code>
        <button onClick={() => copy(npmCmd, 0)} className="text-xs px-2 py-1 rounded border border-[var(--color-border)] hover:border-[var(--color-muted)] transition-colors cursor-pointer shrink-0">
          {copiedIdx === 0 ? "Copied! ✅" : "Copy 📋"}
        </button>
      </div>
      <div className="flex items-center justify-between gap-2 bg-[var(--color-background)] rounded-lg px-4 py-2 border border-[var(--color-border)]">
        <code className="text-sm font-mono truncate">{clawCmd}</code>
        <button onClick={() => copy(clawCmd, 1)} className="text-xs px-2 py-1 rounded border border-[var(--color-border)] hover:border-[var(--color-muted)] transition-colors cursor-pointer shrink-0">
          {copiedIdx === 1 ? "Copied! ✅" : "Copy 📋"}
        </button>
      </div>
    </div>
  );
}
