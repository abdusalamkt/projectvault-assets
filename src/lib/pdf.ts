import jsPDF from "jspdf";
import { ProjectRow, ProjectImage } from "@/lib/dam";
import { fetchAsBlob } from "@/lib/download";

const GREEN_DARK: [number, number, number] = [20, 82, 20];
const GREEN: [number, number, number] = [46, 125, 50];
const BG_SOFT: [number, number, number] = [249, 251, 247];
const TAG_BG: [number, number, number] = [242, 245, 240];
const TEXT: [number, number, number] = [30, 42, 28];
const MUTED: [number, number, number] = [90, 110, 86];

async function urlToDataURL(url: string): Promise<{ data: string; fmt: "PNG" | "JPEG" } | null> {
  try {
    const blob = await fetchAsBlob(url);
    const data: string = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.onerror = rej;
      r.readAsDataURL(blob);
    });
    // jsPDF only supports PNG/JPEG. Re-encode webp/avif/etc. via canvas to PNG.
    const isPng = data.startsWith("data:image/png");
    const isJpg = data.startsWith("data:image/jpeg") || data.startsWith("data:image/jpg");
    if (isPng) return { data, fmt: "PNG" };
    if (isJpg) return { data, fmt: "JPEG" };
    const png = await new Promise<string | null>((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const c = document.createElement("canvas");
          c.width = img.naturalWidth; c.height = img.naturalHeight;
          const ctx = c.getContext("2d");
          if (!ctx) return resolve(null);
          ctx.drawImage(img, 0, 0);
          resolve(c.toDataURL("image/png"));
        } catch { resolve(null); }
      };
      img.onerror = () => resolve(null);
      img.src = data;
    });
    return png ? { data: png, fmt: "PNG" } : null;
  } catch {
    return null;
  }
}

function drawHeader(doc: jsPDF, project: ProjectRow, pageW: number) {
  // Gradient simulation: 60 thin slices left->right between two greens.
  const headerH = 56;
  const slices = 60;
  for (let i = 0; i < slices; i++) {
    const t = i / (slices - 1);
    const r = Math.round(GREEN[0] * (1 - t) + GREEN_DARK[0] * t);
    const g = Math.round(GREEN[1] * (1 - t) + GREEN_DARK[1] * t);
    const b = Math.round(GREEN[2] * (1 - t) + GREEN_DARK[2] * t);
    doc.setFillColor(r, g, b);
    doc.rect((pageW * i) / slices, 0, pageW / slices + 0.5, headerH, "F");
  }
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  const title = (project.project_name || "").toUpperCase();
  const wrapped = doc.splitTextToSize(title, pageW - 28);
  doc.text(wrapped.slice(0, 2), 14, 22);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const subtitle = [project.sector, project.country].filter(Boolean).join(" · ") || "Project";
  doc.text(subtitle, 14, headerH - 18);
  // pill
  const pill = `№ ${project.project_no}`;
  doc.setFontSize(10);
  const pillW = doc.getTextWidth(pill) + 10;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(255, 255, 255);
  doc.roundedRect(pageW - 14 - pillW, headerH - 24, pillW, 9, 4.5, 4.5, "S");
  doc.text(pill, pageW - 14 - pillW + 5, headerH - 18);
  return headerH;
}

function drawTags(doc: jsPDF, tags: string[], x: number, y: number, maxW: number) {
  if (!tags.length) return y;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  let cx = x, cy = y;
  const padX = 5, padY = 2.4, gap = 4, h = 7;
  for (const t of tags) {
    const w = doc.getTextWidth(t) + padX * 2;
    if (cx + w > x + maxW) { cx = x; cy += h + gap; }
    doc.setFillColor(...TAG_BG);
    doc.setDrawColor(...TAG_BG);
    doc.roundedRect(cx, cy, w, h, 3.5, 3.5, "F");
    doc.setTextColor(...GREEN_DARK);
    doc.text(t, cx + padX, cy + h - padY);
    cx += w + gap;
  }
  return cy + h + 4;
}

function drawDetailRow(doc: jsPDF, label: string, value: string, x: number, y: number, w: number) {
  doc.setDrawColor(...GREEN);
  doc.setLineWidth(1.2);
  doc.line(x, y - 4, x, y + 3);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...GREEN_DARK);
  doc.text(`${label}:`, x + 4, y + 1);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...TEXT);
  const labelW = 32;
  const wrapped = doc.splitTextToSize(value || "—", w - labelW - 6);
  doc.text(wrapped, x + 4 + labelW, y + 1);
  return y + Math.max(7, wrapped.length * 5 + 2);
}

function drawDescription(doc: jsPDF, text: string, x: number, y: number, w: number) {
  if (!text) return y;
  doc.setFillColor(...BG_SOFT);
  doc.setDrawColor(224, 233, 219);
  const wrapped = doc.splitTextToSize(text, w - 12);
  const h = wrapped.length * 5 + 16;
  doc.roundedRect(x, y, w, h, 6, 6, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...GREEN_DARK);
  doc.text("Description", x + 6, y + 7);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...TEXT);
  doc.text(wrapped, x + 6, y + 13);
  return y + h + 6;
}

function drawGalleryHeading(doc: jsPDF, x: number, y: number, label = "IMAGE GALLERY") {
  doc.setDrawColor(...GREEN);
  doc.setLineWidth(1.6);
  doc.line(x, y - 5, x, y + 3);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...GREEN_DARK);
  doc.text(label, x + 5, y + 1);
  return y + 8;
}

function drawFooter(doc: jsPDF, text: string, pageW: number, pageH: number) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(text, pageW / 2, pageH - 8, { align: "center" });
}

/**
 * Build a styled PDF for one project. Appends pages to an existing doc when provided.
 * Returns the doc.
 */
export async function buildProjectPdf(
  project: ProjectRow,
  images: ProjectImage[],
  existing?: jsPDF,
): Promise<jsPDF> {
  const doc = existing ?? new jsPDF({ unit: "mm", format: "a4" });
  if (existing) doc.addPage();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;

  // ---- Cover / details page ----
  const headerH = drawHeader(doc, project, pageW);
  let y = headerH + 12;

  y = drawTags(doc, project.tags ?? [], margin, y, pageW - margin * 2);

  const fields: [string, string][] = [
    ["Project No", project.project_no],
    ["Sector", project.sector ?? ""],
    ["Country", project.country ?? ""],
    ["Product", project.product ?? ""],
    ["Finish", project.finish ?? ""],
    ["Contractor", project.contractor ?? ""],
  ];
  y += 2;
  for (const [k, v] of fields) y = drawDetailRow(doc, k, v, margin, y, pageW - margin * 2);

  if (project.description) {
    y += 4;
    y = drawDescription(doc, project.description, margin, y, pageW - margin * 2);
  }

  drawFooter(doc, `${project.project_name} · № ${project.project_no}`, pageW, pageH);

  // ---- Image pages: 2 per page (stacked) ----
  if (images.length) {
    const cellW = pageW - margin * 2;
    const cellH = (pageH - margin * 2 - 18 - 8) / 2; // header + gap
    let perPage = 0;
    let cy = margin;
    let firstOnPage = true;

    for (let i = 0; i < images.length; i++) {
      if (perPage === 0) {
        doc.addPage();
        cy = drawGalleryHeading(doc, margin, margin + 4) + 4;
        firstOnPage = true;
      }
      const img = images[i];
      const loaded = await urlToDataURL(img.url);
      // Card background
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 237, 220);
      doc.roundedRect(margin, cy, cellW, cellH, 4, 4, "FD");
      if (loaded) {
        // Fit image inside card with 2mm padding
        const padding = 2;
        try {
          doc.addImage(loaded.data, loaded.fmt, margin + padding, cy + padding, cellW - padding * 2, cellH - padding * 2 - 6, undefined, "FAST");
        } catch {
          doc.setFontSize(9); doc.setTextColor(...MUTED);
          doc.text("Image unavailable", margin + 6, cy + 10);
        }
      } else {
        doc.setFontSize(9); doc.setTextColor(...MUTED);
        doc.text("Image unavailable", margin + 6, cy + 10);
      }
      // Caption
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      doc.text(`Image ${i + 1} of ${images.length}`, margin + 4, cy + cellH - 2);

      perPage++;
      cy += cellH + 6;
      if (perPage === 2) {
        drawFooter(doc, `${project.project_name} · Images`, pageW, pageH);
        perPage = 0;
      }
      firstOnPage = false;
    }
    if (perPage !== 0) drawFooter(doc, `${project.project_name} · Images`, pageW, pageH);
  }

  return doc;
}

export async function buildSingleProjectPdf(project: ProjectRow, images: ProjectImage[]) {
  return buildProjectPdf(project, images);
}

export async function buildCombinedPdf(
  items: { project: ProjectRow; images: ProjectImage[] }[],
  onProgress?: (done: number, total: number) => void,
) {
  let doc: jsPDF | undefined;
  for (let i = 0; i < items.length; i++) {
    doc = await buildProjectPdf(items[i].project, items[i].images, doc);
    onProgress?.(i + 1, items.length);
  }
  return doc!;
}
