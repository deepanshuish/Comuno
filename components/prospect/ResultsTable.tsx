"use client";
import type { CompanyResult, ProspectResult } from "@/lib/services/prospect";
import { Avatar, Table, Td, Th } from "@/components/app/ui";
import { Checkbox, ExtLink, LinkedInLink } from "./shared";

/** Selectable table of AI-discovered people. */
export function ProspectResultsTable({
  results,
  selected,
  onToggle,
  onToggleAll,
}: {
  results: ProspectResult[];
  selected: Set<number>;
  onToggle: (i: number) => void;
  onToggleAll: (all: boolean) => void;
}) {
  const allOn = results.length > 0 && selected.size === results.length;
  return (
    <Table>
      <thead>
        <tr>
          <Th className="w-8">
            <Checkbox label="Select all" checked={allOn} indeterminate={selected.size > 0} onChange={onToggleAll} />
          </Th>
          <Th>Person</Th>
          <Th>Company</Th>
          <Th className="hidden md:table-cell">Location</Th>
          <Th>Why they match</Th>
          <Th>Source</Th>
        </tr>
      </thead>
      <tbody>
        {results.map((r, i) => {
          const name = `${r.first_name} ${r.last_name}`.trim();
          return (
            <tr key={`${name}-${r.company}-${i}`} className={selected.has(i) ? "bg-brand-50/40" : "hover:bg-zinc-50/60"} onClick={() => onToggle(i)}>
              <Td>
                <Checkbox label={`Select ${name}`} checked={selected.has(i)} onChange={() => onToggle(i)} />
              </Td>
              <Td>
                <div className="flex min-w-[180px] items-center gap-2">
                  <Avatar name={name} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 font-medium text-zinc-900">
                      {name} <LinkedInLink url={r.linkedin_url} />
                    </div>
                    <div className="truncate text-xs text-zinc-500">{r.title || "—"}</div>
                  </div>
                </div>
              </Td>
              <Td>
                <div className="min-w-[120px]">
                  <div className="text-zinc-800">{r.company}</div>
                  {r.domain && <div className="text-xs text-zinc-500">{r.domain}</div>}
                </div>
              </Td>
              <Td className="hidden whitespace-nowrap md:table-cell">{r.location || <span className="text-zinc-400">—</span>}</Td>
              <Td>
                <p className="min-w-[200px] max-w-[340px] text-[12px] leading-snug text-zinc-600">{r.reason || "—"}</p>
              </Td>
              <Td className="whitespace-nowrap text-xs">{r.source_url ? <ExtLink href={r.source_url} /> : <span className="text-zinc-400">—</span>}</Td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}

/** Selectable table of AI-discovered companies. */
export function CompanyResultsTable({
  results,
  selected,
  onToggle,
  onToggleAll,
}: {
  results: CompanyResult[];
  selected: Set<number>;
  onToggle: (i: number) => void;
  onToggleAll: (all: boolean) => void;
}) {
  const allOn = results.length > 0 && selected.size === results.length;
  return (
    <Table>
      <thead>
        <tr>
          <Th className="w-8">
            <Checkbox label="Select all" checked={allOn} indeterminate={selected.size > 0} onChange={onToggleAll} />
          </Th>
          <Th>Company</Th>
          <Th>Industry</Th>
          <Th className="hidden md:table-cell">Size</Th>
          <Th className="hidden md:table-cell">Location</Th>
          <Th>Why it matches</Th>
          <Th>Source</Th>
        </tr>
      </thead>
      <tbody>
        {results.map((r, i) => (
          <tr key={`${r.name}-${i}`} className={selected.has(i) ? "bg-brand-50/40" : "hover:bg-zinc-50/60"} onClick={() => onToggle(i)}>
            <Td>
              <Checkbox label={`Select ${r.name}`} checked={selected.has(i)} onChange={() => onToggle(i)} />
            </Td>
            <Td>
              <div className="min-w-[160px]">
                <div className="font-medium text-zinc-900">{r.name}</div>
                {r.domain && (
                  <div className="text-xs">
                    <ExtLink href={`https://${r.domain}`}>{r.domain}</ExtLink>
                  </div>
                )}
                {r.description && <div className="mt-0.5 line-clamp-2 max-w-[280px] text-xs text-zinc-500">{r.description}</div>}
              </div>
            </Td>
            <Td className="whitespace-nowrap">{r.industry || <span className="text-zinc-400">—</span>}</Td>
            <Td className="hidden whitespace-nowrap md:table-cell">{r.size || <span className="text-zinc-400">—</span>}</Td>
            <Td className="hidden whitespace-nowrap md:table-cell">{r.location || <span className="text-zinc-400">—</span>}</Td>
            <Td>
              <p className="min-w-[200px] max-w-[320px] text-[12px] leading-snug text-zinc-600">{r.reason || "—"}</p>
            </Td>
            <Td className="whitespace-nowrap text-xs">{r.source_url ? <ExtLink href={r.source_url} /> : <span className="text-zinc-400">—</span>}</Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
