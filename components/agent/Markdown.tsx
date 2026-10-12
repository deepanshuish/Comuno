"use client";
import { Fragment, type ReactNode } from "react";

/**
 * Small, safe Markdown renderer for agent replies (no HTML injection):
 * headings, paragraphs, bullet/numbered lists, tables, code blocks, bold, italics, inline code, links.
 */
export default function Markdown({ text }: { text: string }) {
  return <div className="space-y-2.5 text-[13.5px] leading-relaxed text-zinc-800">{blocks(text)}</div>;
}

function blocks(src: string): ReactNode[] {
  const lines = src.replace(/\r/g, "").split("\n");
  const out: ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    if (line.startsWith("```")) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) body.push(lines[i++]);
      i++;
      out.push(
        <pre key={out.length} className="overflow-x-auto rounded-lg bg-zinc-900 p-3 text-xs text-zinc-100">
          {body.join("\n")}
        </pre>,
      );
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)/);
    if (h) {
      const size = h[1].length <= 2 ? "text-[15px]" : "text-[14px]";
      out.push(
        <div key={out.length} className={`${size} pt-1 font-semibold text-zinc-900`}>
          {inline(h[2])}
        </div>,
      );
      i++;
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      const rows: string[][] = [];
      const split = (l: string) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const head = split(line);
      i += 2;
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) rows.push(split(lines[i++]));
      out.push(
        <div key={out.length} className="overflow-x-auto rounded-lg border border-zinc-200">
          <table className="w-full text-left text-[12.5px]">
            <thead className="bg-zinc-50">
              <tr>
                {head.map((c, j) => (
                  <th key={j} className="whitespace-nowrap border-b border-zinc-200 px-2.5 py-1.5 font-medium text-zinc-600">
                    {inline(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, k) => (
                <tr key={k} className="border-b border-zinc-100 last:border-0">
                  {r.map((c, j) => (
                    <td key={j} className="px-2.5 py-1.5 align-top">
                      {inline(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (/^\s*([-*•]|\d+[.)])\s+/.test(line)) {
      const ordered = /^\s*\d+[.)]/.test(line);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*•]|\d+[.)])\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*([-*•]|\d+[.)])\s+/, ""));
      const cls = "ml-5 space-y-1 " + (ordered ? "list-decimal" : "list-disc");
      out.push(
        ordered ? (
          <ol key={out.length} className={cls}>
            {items.map((t, j) => <li key={j}>{inline(t)}</li>)}
          </ol>
        ) : (
          <ul key={out.length} className={cls}>
            {items.map((t, j) => <li key={j}>{inline(t)}</li>)}
          </ul>
        ),
      );
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|```|\s*([-*•]|\d+[.)])\s+|\s*\|)/.test(lines[i])) para.push(lines[i++]);
    if (!para.length) para.push(lines[i++]);
    out.push(
      <p key={out.length}>
        {para.map((p, j) => (
          <Fragment key={j}>
            {j > 0 && <br />}
            {inline(p)}
          </Fragment>
        ))}
      </p>,
    );
  }
  return out;
}

function inline(s: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`|\*([^*\s][^*]*)\*|(https?:\/\/[^\s)|]+))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    const k = out.length;
    if (m[2] && m[3]) out.push(<a key={k} href={m[3]} target="_blank" rel="noreferrer" className="text-brand-700 underline underline-offset-2">{m[2]}</a>);
    else if (m[4]) out.push(<strong key={k} className="font-semibold text-zinc-900">{m[4]}</strong>);
    else if (m[5]) out.push(<code key={k} className="rounded bg-zinc-100 px-1 py-0.5 text-[12px]">{m[5]}</code>);
    else if (m[6]) out.push(<em key={k}>{m[6]}</em>);
    else if (m[7]) out.push(<a key={k} href={m[7]} target="_blank" rel="noreferrer" className="break-all text-brand-700 underline underline-offset-2">{m[7]}</a>);
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}
