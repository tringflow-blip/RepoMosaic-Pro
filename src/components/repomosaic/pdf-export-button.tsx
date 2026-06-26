'use client';

import { useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { AdvancedSkillMap, PersonSkillRecord } from '@/lib/analysis/skill-taxonomy';
import type { jsPDF } from 'jspdf';
import type { UserOptions } from 'jspdf-autotable';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export type PdfExportButtonProps = {
  skillMap: AdvancedSkillMap;
};

/* ------------------------------------------------------------------ */
/*  Theme — RGB tuples (teal / emerald, no blue / indigo)              */
/* ------------------------------------------------------------------ */

const COLOR = {
  headerBar: [20, 184, 166] as [number, number, number],
  sectionHeader: [15, 118, 110] as [number, number, number],
  tableHeaderBg: [240, 253, 250] as [number, number, number],
  tableHeaderText: [15, 118, 110] as [number, number, number],
  altRow: [245, 245, 245] as [number, number, number],
  footer: [150, 150, 150] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  bodyText: [40, 40, 40] as [number, number, number],
  muted: [110, 110, 110] as [number, number, number],
};

const MARGIN_X = 40;
const MARGIN_TOP = 30;
const MARGIN_BOTTOM = 30;

/* ------------------------------------------------------------------ */
/*  Small helpers                                                      */
/* ------------------------------------------------------------------ */

type SkillEntry = { name: string; score: number; commits: number };
type OrgAgg = { name: string; score: number; people: number; commits: number };

function topByScore<T extends { score: number }>(arr: T[] | undefined, n: number): T[] {
  if (!arr || arr.length === 0) return [];
  return [...arr].sort((a, b) => b.score - a.score).slice(0, n);
}

function firstSkillName<T extends { name: string; score: number }>(
  arr: T[] | undefined,
): string {
  const top = topByScore(arr, 1);
  return top.length > 0 ? top[0].name : '—';
}

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

/**
 * jsPDF's built-in helvetica font only supports WinAnsi (latin1-ish).
 * Replace any character outside that range with '?' so the PDF never
 * breaks on CJK / emoji org / person names.
 */
function safeName(input: string): string {
  if (!input) return '';
  return input.replace(/[^\x00-\xFF]/g, '?');
}

function lastTableY(doc: jsPDF): number {
  const t = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable;
  return t?.finalY ?? MARGIN_TOP;
}

/* ------------------------------------------------------------------ */
/*  Page builders                                                      */
/* ------------------------------------------------------------------ */

function drawCover(
  doc: jsPDF,
  map: AdvancedSkillMap,
  pageWidth: number,
  pageHeight: number,
) {
  const contentWidth = pageWidth - MARGIN_X * 2;

  // Colored header bar (teal)
  doc.setFillColor(...COLOR.headerBar);
  doc.rect(0, 0, pageWidth, 60, 'F');

  // Title (white, on the bar)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(...COLOR.white);
  doc.text('Skill Attribution Report', MARGIN_X, 36);

  // Subtitle (white, smaller)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text('RepoMosaic Pro · Advanced Skill Map', MARGIN_X, 52);

  // Org name (large, below the bar)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...COLOR.sectionHeader);
  doc.text(safeName(map.org || 'Unknown Org'), MARGIN_X, 108);

  // Meta line: scan date + model + provider
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...COLOR.muted);
  const scanDate = map.generatedAt
    ? fmtDate(map.generatedAt)
    : fmtDate(new Date().toISOString());
  doc.text(`Scan date: ${scanDate}`, MARGIN_X, 126);
  doc.text(
    `Model: ${safeName(map.model || '—')}    Provider: ${safeName(map.provider || '—')}`,
    MARGIN_X,
    142,
  );

  // 2 x 3 summary stats grid
  const stats: { label: string; value: string }[] = [
    { label: 'Total Repos', value: (map.totalRepos ?? 0).toLocaleString() },
    { label: 'Total Commits', value: (map.totalCommits ?? 0).toLocaleString() },
    { label: 'Total Chunks', value: (map.totalChunks ?? 0).toLocaleString() },
    { label: 'Total People', value: (map.totalPeople ?? 0).toLocaleString() },
    { label: 'Model', value: map.model || '—' },
    { label: 'Provider', value: map.provider || '—' },
  ];

  const gridTopY = 180;
  const cellW = contentWidth / 2;
  const cellH = 64;

  stats.forEach((s, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = MARGIN_X + col * cellW;
    const y = gridTopY + row * cellH;

    // Card background (soft teal tint)
    doc.setFillColor(...COLOR.tableHeaderBg);
    doc.setDrawColor(...COLOR.headerBar);
    doc.setLineWidth(0.5);
    doc.roundedRect(x + 4, y, cellW - 12, cellH - 14, 4, 4, 'FD');

    // Label (uppercase, teal)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...COLOR.tableHeaderText);
    doc.text(s.label.toUpperCase(), x + 14, y + 16);

    // Value (bold, dark)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(...COLOR.bodyText);
    doc.text(safeName(s.value), x + 14, y + 36);
  });

  // Footer note on the cover page
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(...COLOR.muted);
  doc.text(
    'Generated by RepoMosaic Pro — multi-dimensional LLM-powered skill attribution.',
    MARGIN_X,
    pageHeight - 50,
  );
}

function drawExecutiveSummary(
  doc: jsPDF,
  map: AdvancedSkillMap,
  pageWidth: number,
  pageHeight: number,
  autoTable: (doc: jsPDF, options: UserOptions) => void,
) {
  let y = MARGIN_TOP;

  // Page title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...COLOR.sectionHeader);
  doc.text('Executive Summary', MARGIN_X, y + 10);
  y += 24;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...COLOR.muted);
  doc.text(
    'Top skills by dimension, aggregated across all contributors.',
    MARGIN_X,
    y,
  );
  y += 16;

  const dims: { label: string; data: OrgAgg[] }[] = [
    { label: 'Sectors', data: map.orgSectors ?? [] },
    { label: 'Problem Types', data: map.orgProblemTypes ?? [] },
    { label: 'Technologies', data: map.orgTech ?? [] },
    { label: 'Methodologies', data: map.orgMethodologies ?? [] },
    { label: 'Roles', data: map.orgRoles ?? [] },
  ];

  for (const dim of dims) {
    // If we don't have room for a header + a small table, start a new page
    if (y + 80 > pageHeight - MARGIN_BOTTOM) {
      doc.addPage();
      y = MARGIN_TOP;
    }

    const topCount = Math.min(8, dim.data.length);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...COLOR.sectionHeader);
    doc.text(`Top ${topCount} ${dim.label}`, MARGIN_X, y);
    y += 6;

    const rows: string[][] = dim.data
      .slice()
      .sort((a, b) => (b.commits - a.commits) || (b.score - a.score))
      .slice(0, 8)
      .map((s) => [safeName(s.name), String(s.people ?? 0), String(s.commits ?? 0)]);

    autoTable(doc, {
      startY: y,
      head: [['Skill Name', 'People Count', 'Commits']],
      body: rows.length > 0 ? rows : [['—', '0', '0']],
      margin: {
        left: MARGIN_X,
        right: MARGIN_X,
        top: MARGIN_TOP,
        bottom: MARGIN_BOTTOM,
      },
      theme: 'striped',
      headStyles: {
        fillColor: COLOR.tableHeaderBg,
        textColor: COLOR.tableHeaderText,
        fontStyle: 'bold',
        fontSize: 9,
      },
      bodyStyles: { fontSize: 9, textColor: COLOR.bodyText },
      alternateRowStyles: { fillColor: COLOR.altRow },
      styles: { cellPadding: 4, overflow: 'linebreak' },
      columnStyles: {
        1: { halign: 'right', cellWidth: 80 },
        2: { halign: 'right', cellWidth: 80 },
      },
    });

    y = lastTableY(doc) + 18;
  }
}

function drawPeopleTable(
  doc: jsPDF,
  map: AdvancedSkillMap,
  pageWidth: number,
  pageHeight: number,
  autoTable: (doc: jsPDF, options: UserOptions) => void,
) {
  void pageWidth;
  void pageHeight;

  let y = MARGIN_TOP;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...COLOR.sectionHeader);
  doc.text('Team Skill Attribution', MARGIN_X, y + 10);
  y += 24;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...COLOR.muted);
  const subtitle =
    map.people.length > 0
      ? `${map.people.length} contributors across ${map.totalRepos} repos.`
      : 'No people found in this scan.';
  doc.text(subtitle, MARGIN_X, y);
  y += 14;

  if (map.people.length === 0) {
    // Graceful empty state
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(11);
    doc.setTextColor(...COLOR.muted);
    doc.text('No people found.', MARGIN_X, y + 24);
    return;
  }

  const rows: string[][] = map.people.map((p: PersonSkillRecord) => [
    safeName(p.name || p.login),
    String(p.totalCommits ?? 0),
    String(p.repos?.length ?? 0),
    safeName(firstSkillName(p.sectors)),
    safeName(firstSkillName(p.tech)),
    safeName(firstSkillName(p.roles)),
  ]);

  autoTable(doc, {
    startY: y,
    head: [['Person', 'Commits', 'Repos', 'Top Sector', 'Top Tech', 'Top Role']],
    body: rows,
    margin: {
      left: MARGIN_X,
      right: MARGIN_X,
      top: MARGIN_TOP,
      bottom: MARGIN_BOTTOM,
    },
    theme: 'striped',
    headStyles: {
      fillColor: COLOR.tableHeaderBg,
      textColor: COLOR.tableHeaderText,
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: { fontSize: 9, textColor: COLOR.bodyText },
    alternateRowStyles: { fillColor: COLOR.altRow },
    styles: { cellPadding: 4, overflow: 'linebreak' },
    columnStyles: {
      1: { halign: 'right', cellWidth: 50 },
      2: { halign: 'right', cellWidth: 40 },
    },
  });
}

function drawPersonDetail(
  doc: jsPDF,
  person: PersonSkillRecord,
  pageWidth: number,
  pageHeight: number,
  autoTable: (doc: jsPDF, options: UserOptions) => void,
) {
  void pageWidth;
  void pageHeight;

  let y = MARGIN_TOP;

  // Header: person name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...COLOR.sectionHeader);
  doc.text(safeName(person.name || person.login), MARGIN_X, y + 10);
  y += 24;

  // Meta line
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...COLOR.muted);
  const meta = [
    `Commits: ${person.totalCommits ?? 0}`,
    `Repos: ${person.repos?.length ?? 0}`,
    `Chunks: ${person.totalChunks ?? 0}`,
  ].join('     ');
  doc.text(meta, MARGIN_X, y);
  y += 16;

  // Section label
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...COLOR.sectionHeader);
  doc.text('Top 5 Skills per Dimension', MARGIN_X, y);
  y += 6;

  // Build a single table: Dimension | Skill | Score | Commits
  const dims: { label: string; data: SkillEntry[] }[] = [
    { label: 'Sectors', data: person.sectors ?? [] },
    { label: 'Problem Types', data: person.problemTypes ?? [] },
    { label: 'Technologies', data: person.tech ?? [] },
    { label: 'Methodologies', data: person.methodologies ?? [] },
    { label: 'Roles', data: person.roles ?? [] },
  ];

  const body: string[][] = [];
  for (const dim of dims) {
    const top = topByScore(dim.data, 5);
    if (top.length === 0) {
      body.push([dim.label, '—', '0.00', '0']);
      continue;
    }
    top.forEach((s, i) => {
      body.push([
        i === 0 ? dim.label : '',
        safeName(s.name),
        s.score.toFixed(2),
        String(s.commits ?? 0),
      ]);
    });
  }

  autoTable(doc, {
    startY: y,
    head: [['Dimension', 'Skill', 'Score', 'Commits']],
    body,
    margin: {
      left: MARGIN_X,
      right: MARGIN_X,
      top: MARGIN_TOP,
      bottom: MARGIN_BOTTOM,
    },
    theme: 'striped',
    headStyles: {
      fillColor: COLOR.tableHeaderBg,
      textColor: COLOR.tableHeaderText,
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: { fontSize: 9, textColor: COLOR.bodyText },
    alternateRowStyles: { fillColor: COLOR.altRow },
    styles: { cellPadding: 4, overflow: 'linebreak' },
    columnStyles: {
      0: { cellWidth: 110, fontStyle: 'bold' },
      2: { halign: 'right', cellWidth: 60 },
      3: { halign: 'right', cellWidth: 60 },
    },
  });
}

function drawFooter(
  doc: jsPDF,
  pageNum: number,
  totalPages: number,
  org: string,
  pageWidth: number,
  pageHeight: number,
) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...COLOR.footer);
  const footerY = pageHeight - 12;
  doc.text(`RepoMosaic Pro · ${safeName(org)}`, MARGIN_X, footerY);
  doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - MARGIN_X, footerY, {
    align: 'right',
  });
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function PdfExportButton({ skillMap }: PdfExportButtonProps) {
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  async function handleExport() {
    if (busy) return;
    setBusy(true);
    try {
      // Dynamic import keeps jspdf out of the server bundle (it touches
      // `window` on instantiation) and shrinks the initial client bundle.
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');

      const doc = new jsPDF({ unit: 'px', format: 'a4', compress: true });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // 1. Cover page
      drawCover(doc, skillMap, pageWidth, pageHeight);

      // 2. Executive Summary
      doc.addPage();
      drawExecutiveSummary(doc, skillMap, pageWidth, pageHeight, autoTable);

      // 3. People table
      doc.addPage();
      drawPeopleTable(doc, skillMap, pageWidth, pageHeight, autoTable);

      // 4. Per-person detail pages — only when the team is small (≤10).
      if (skillMap.people.length > 0 && skillMap.people.length <= 10) {
        for (const person of skillMap.people) {
          doc.addPage();
          drawPersonDetail(doc, person, pageWidth, pageHeight, autoTable);
        }
      }

      // 5. Footers on every page (needs the final page count first).
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        drawFooter(doc, i, totalPages, skillMap.org, pageWidth, pageHeight);
      }

      const dateStr = new Date().toISOString().slice(0, 10);
      const orgSlug = (skillMap.org || 'org')
        .replace(/[^a-zA-Z0-9-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase();
      const filename = `skill-report-${orgSlug}-${dateStr}.pdf`;
      doc.save(filename);

      toast({
        title: 'PDF exported',
        description: `Saved as ${filename}`,
      });
    } catch (err) {
      console.error('PDF export failed:', err);
      toast({
        title: 'Export failed',
        description:
          err instanceof Error
            ? err.message
            : 'Could not generate the PDF report. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      onClick={handleExport}
      disabled={busy}
      variant="outline"
      size="sm"
      aria-label="Export skill report as PDF"
    >
      {busy ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <FileDown className="size-4" />
      )}
      {busy ? 'Generating…' : 'Export PDF'}
    </Button>
  );
}
