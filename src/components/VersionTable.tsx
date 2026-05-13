"use client";

import type { VersionIssue } from "@/lib/data";
import { ScoreBadge } from "@/components/ScoreBadge";
import Link from "next/link";
import { useMemo, useState } from "react";

type SortKey = "version" | "date" | "score" | "issues" | "comment";
type SortDir = "asc" | "desc";

function compareVersions(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

export function VersionTable({ versions, packageSlug }: { versions: VersionIssue[]; packageSlug: string }) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sorted = useMemo(() => {
    const rows = [...versions];
    rows.sort((a, b) => {
      let result = 0;
      if (sortKey === "version") result = compareVersions(a.version, b.version);
      if (sortKey === "date") result = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sortKey === "score") result = a.stabilityScore.score - b.stabilityScore.score;
      if (sortKey === "issues") result = a.stabilityScore.evidence.length - b.stabilityScore.evidence.length;
      if (sortKey === "comment") result = a.verdictComment.localeCompare(b.verdictComment);
      return sortDir === "asc" ? result : -result;
    });
    return rows;
  }, [versions, sortKey, sortDir]);

  function sortBy(key: SortKey) {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setSortDir(key === "score" ? "desc" : "asc");
    }
  }

  return (
    <div className="border border-[var(--color-border)] rounded-xl overflow-hidden">
      <table className="w-full text-left">
        <thead className="bg-[var(--color-card)] text-xs uppercase tracking-widest text-[var(--color-muted)]">
          <tr>
            <SortableTh label="Version" active={sortKey === "version"} dir={sortDir} onClick={() => sortBy("version")} />
            <SortableTh label="Date" active={sortKey === "date"} dir={sortDir} onClick={() => sortBy("date")} />
            <SortableTh label="Score" active={sortKey === "score"} dir={sortDir} onClick={() => sortBy("score")} />
            <SortableTh label="Issues" active={sortKey === "issues"} dir={sortDir} onClick={() => sortBy("issues")} />
            <SortableTh label="Comment" active={sortKey === "comment"} dir={sortDir} onClick={() => sortBy("comment")} className="hidden sm:table-cell" />
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {sorted.map((v) => (
            <tr key={v.issueNumber} className="hover:bg-[var(--color-card)] transition-colors align-top">
              <td className="px-6 py-4">
                <Link href={`/${packageSlug}/${v.version}`} className="font-mono hover:underline font-bold whitespace-nowrap">
                  v{v.version}
                </Link>
              </td>
              <td className="px-6 py-4 text-[var(--color-muted)] whitespace-nowrap">{new Date(v.createdAt).toLocaleDateString()}</td>
              <td className="px-6 py-4">
                <ScoreBadge score={v.stabilityScore.score} size="sm" />
              </td>
              <td className="px-6 py-4 text-[var(--color-muted)] font-mono">{v.stabilityScore.evidence.length}</td>
              <td className="px-6 py-4 text-[var(--color-muted)] text-sm hidden sm:table-cell max-w-sm whitespace-normal break-words leading-relaxed">
                {v.verdictComment}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SortableTh({ label, active, dir, onClick, className = "" }: { label: string; active: boolean; dir: SortDir; onClick: () => void; className?: string }) {
  return (
    <th className={`px-6 py-3 ${className}`}>
      <button type="button" onClick={onClick} className="inline-flex items-center gap-1 hover:text-[var(--color-foreground)] transition-colors">
        {label}
        <span className="text-[10px] opacity-70">{active ? (dir === "asc" ? "▲" : "▼") : "↕"}</span>
      </button>
    </th>
  );
}
