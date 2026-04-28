"use client";
import { useState } from "react";

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="text-xs px-3 py-1.5 rounded-md bg-[var(--color-card)] border border-[var(--color-border)] hover:border-[var(--color-muted)] transition-colors cursor-pointer"
    >
      {copied ? "Copied! ✅" : "Copy 📋"}
    </button>
  );
}
