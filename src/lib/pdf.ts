import jsPDF from "jspdf";
import { ProjectRow, ProjectImage } from "@/lib/dam";
import { fetchAsBlob } from "@/lib/download";

/* ─────────────────────────────────────────────────────────────
   GIBCA reference-list PDF — A4 portrait (210 × 297 mm)
   Layout mirrors the web PdfGen template:
   hero banner + angled sector block + product gradient bar,
   "REFERENCE LIST" tab, accent-ruled content rows, logo footer,
   then 2-up gallery pages with captions + tag chips.
   ───────────────────────────────────────────────────────────── */

type RGB = [number, number, number];

interface BrandTheme {
  name: string;
  accent: RGB;
  sectorFrom: RGB; // left dark block gradient
  sectorTo: RGB;
  productFrom: RGB; // bottom bar gradient (left → right)
  productTo: RGB;
  productLabel: string;
  productSubLabel: string;
}

const HUFCOR: BrandTheme = {
  name: "HUFCOR",
  accent: [215, 32, 39],
  sectorFrom: [36, 36, 36],
  sectorTo: [61, 61, 61],
  productFrom: [142, 18, 23],
  productTo: [215, 32, 39],
  productLabel: "OPERABLE WALLS AND GLASSWALLS",
  productSubLabel:
    "600 SERIES | 7000 SERIES | WEATHER RESISTANT GLASSWALLS | ACOUSTIC GLASSWALLS | FRAMELESS GLASSWALL",
};

const THEMES: { match: RegExp; theme: BrandTheme }[] = [
  { match: /hufcor/i, theme: HUFCOR },
  {
    match: /hpl/i,
    theme: {
      name: "HPL",
      accent: [26, 122, 26],
      sectorFrom: [26, 46, 26],
      sectorTo: [45, 77, 45],
      productFrom: [20, 82, 20],
      productTo: [46, 125, 50],
      productLabel: "COMPACT LAMINATE SOLUTIONS",
      productSubLabel:
        "WASHROOM CUBICLES | LOCKER SYSTEMS | WALL CLADDING | INTEGRATED PANEL SYSTEM",
    },
  },
  {
    match: /auralis/i,
    theme: {
      name: "AURALIS",
      accent: [64, 64, 65],
      sectorFrom: [26, 26, 26],
      sectorTo: [64, 64, 65],
      productFrom: [64, 64, 65],
      productTo: [90, 91, 92],
      productLabel: "ACOUSTIC SOLUTIONS",
      productSubLabel: "ACOUSTIC PANELS | BAFFLES | WALL SYSTEMS",
    },
  },
  {
    match: /office/i,
    theme: {
      name: "OFFICE PARTITIONS",
      accent: [64, 64, 65],
      sectorFrom: [26, 46, 26],
      sectorTo: [64, 64, 65],
      productFrom: [64, 64, 65],
      productTo: [90, 91, 92],
      productLabel: "OFFICE PARTITION SYSTEMS",
      productSubLabel: "SINGLE GLAZED | DOUBLE GLAZED",
    },
  },
];

function themeFor(brand?: string | null): BrandTheme {
  const b = brand ?? "";
  return THEMES.find((t) => t.match.test(b))?.theme ?? HUFCOR;
}

const INK: RGB = [31, 31, 31];
const MUTED: RGB = [130, 130, 130];

/* ── geometry (mm) ─────────────────────────────────────────── */
const PAGE_W = 210;
const PAGE_H = 297;
const BANNER_H = 116; // 440px
const BAR_H = 29; // 110px
const SECTOR_W = 63; // 240px
const MARGIN = 14;

async function urlToDataURL(url: string): Promise<{ data: string; fmt: "PNG" | "JPEG" } | null> {
  try {
    const blob = await fetchAsBlob(url);
    const data: string = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.onerror = rej;
      r.readAsDataURL(blob);
    });
    if (data.startsWith("data:image/png")) return { data, fmt: "PNG" };
    if (data.startsWith("data:image/jpeg") || data.startsWith("data:image/jpg"))
      return { data, fmt: "JPEG" };
    const png = await new Promise<string | null>((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const c = document.createElement("canvas");
          c.width = img.naturalWidth;
          c.height = img.naturalHeight;
          const ctx = c.getContext("2d");
          if (!ctx) return resolve(null);
          ctx.drawImage(img, 0, 0);
          resolve(c.toDataURL("image/png"));
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = data;
    });
    return png ? { data: png, fmt: "PNG" } : null;
  } catch {
    return null;
  }
}

/** Horizontal gradient rectangle drawn as thin slices. */
function gradientRect(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  from: RGB,
  to: RGB,
  slices = 80,
) {
  for (let i = 0; i < slices; i++) {
    const t = i / (slices - 1);
    doc.setFillColor(
      Math.round(from[0] * (1 - t) + to[0] * t),
      Math.round(from[1] * (1 - t) + to[1] * t),
      Math.round(from[2] * (1 - t) + to[2] * t),
    );
    doc.rect(x + (w * i) / slices, y, w / slices + 0.4, h, "F");
  }
}

/** Angled block: full rect up to `cut`, then a right-leaning wedge. */
function angledBlock(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  from: RGB,
  to: RGB,
  slantRatio = 0.2,
) {
  const slant = w * slantRatio;
  gradientRect(doc, x, y, w - slant, h, from, to);
  // wedge: triangle (top-right of straight part) → sloping edge
  doc.setFillColor(...to);
  doc.triangle(x + w - slant, y, x + w, y, x + w - slant, y + h, "F");
}

async function coverImage(url: string): Promise<{ data: string; fmt: "PNG" | "JPEG"; w: number; h: number } | null> {
  const loaded = await urlToDataURL(url);
  if (!loaded) return null;
  const dims = await new Promise<{ w: number; h: number } | null>((resolve) => {
    const im = new Image();
    im.onload = () => resolve({ w: im.naturalWidth, h: im.naturalHeight });
    im.onerror = () => resolve(null);
    im.src = loaded.data;
  });
  if (!dims) return null;
  return { ...loaded, ...dims };
}

/**
 * Crop an image to the box aspect ratio on a canvas (center-cover) so we never
 * need PDF clipping paths — Acrobat chokes on jsPDF's clip/discardPath output
 * (Chrome's viewer silently tolerates it), which blanks out all later text.
 */
async function croppedCover(
  url: string,
  boxW: number,
  boxH: number,
): Promise<{ data: string; fmt: "PNG" | "JPEG" } | null> {
  const img = await coverImage(url);
  if (!img) return null;
  const targetRatio = boxW / boxH;
  const srcRatio = img.w / img.h;
  let sw = img.w, sh = img.h;
  if (srcRatio > targetRatio) sw = img.h * targetRatio;
  else sh = img.w / targetRatio;
  const sx = (img.w - sw) / 2;
  const sy = (img.h - sh) / 2;
  const outW = Math.min(1600, Math.round(sw));
  const outH = Math.round((outW * sh) / sw);
  return new Promise((resolve) => {
    const im = new Image();
    im.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = outW;
        c.height = outH;
        const ctx = c.getContext("2d");
        if (!ctx) return resolve(null);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, outW, outH);
        ctx.drawImage(im, sx, sy, sw, sh, 0, 0, outW, outH);
        resolve({ data: c.toDataURL("image/jpeg", 0.9), fmt: "JPEG" });
      } catch {
        resolve(null);
      }
    };
    im.onerror = () => resolve(null);
    im.src = img.data;
  });
}

/* ── banner ────────────────────────────────────────────────── */
async function drawBanner(doc: jsPDF, project: ProjectRow, theme: BrandTheme, bannerUrl?: string) {
  const barY = BANNER_H - BAR_H;
  // hero image sits ABOVE the colour bar and stops exactly at its top edge
  doc.setFillColor(24, 24, 24);
  doc.rect(0, 0, PAGE_W, barY, "F");
  if (bannerUrl) {
    const img = await croppedCover(bannerUrl, PAGE_W, barY);
    if (img) {
      try {
        doc.addImage(img.data, img.fmt, 0, 0, PAGE_W, barY, undefined, "FAST");
      } catch { /* ignore */ }
    }
  }
  // thin hairline separating the image from the colour bar
  doc.setFillColor(255, 255, 255);
  doc.rect(0, barY - 0.6, PAGE_W, 0.6, "F");

  // product gradient bar (full width, dark → accent left→right)
  gradientRect(doc, 0, barY, PAGE_W, BAR_H, theme.productFrom, theme.productTo);

  // product label + sub label (right of the sector block)
  const tx = SECTOR_W + 4;
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  const labelLines = doc.splitTextToSize(theme.productLabel, PAGE_W - tx - 8).slice(0, 2);
  doc.text(labelLines, tx, barY + 10);
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.2);
  const ruleY = barY + BAR_H - 9;
  doc.line(tx, ruleY, PAGE_W - 8, ruleY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.6);
  doc.text(doc.splitTextToSize(theme.productSubLabel, PAGE_W - tx - 8)[0], tx, ruleY + 3.6);

  // angled sector block
  angledBlock(doc, 0, barY, SECTOR_W, BAR_H, theme.sectorFrom, theme.sectorTo);
  const words = (project.sector || project.project_name || "").toUpperCase().split(" ");
  const mid = Math.ceil(words.length / 2);
  const l1 = words.slice(0, mid).join(" ");
  const l2 = words.slice(mid).join(" ");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  const sLines = [l1, l2].filter(Boolean);
  let sy = barY + (sLines.length > 1 ? 9 : 12);
  for (const ln of sLines) {
    doc.text(doc.splitTextToSize(ln, SECTOR_W - 18)[0], 6, sy);
    sy += 5;
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.text("SECTOR", 6, barY + BAR_H - 5.5);

  // search / project-no ribbon above the bar
  const ribbon = `№ ${project.project_no}`;
  doc.setFontSize(6.5);
  const rw = doc.getTextWidth(ribbon) + 22;
  doc.setFillColor(37, 37, 37);
  doc.rect(0, barY - 7.1, rw - 5, 6.5, "F");
  doc.triangle(rw - 5, barY - 7.1, rw, barY - 7.1, rw - 5, barY - 0.6, "F");
  doc.setTextColor(255, 255, 255);
  doc.text(ribbon, 6, barY - 2.6);

  // REFERENCE LIST tab (right aligned, angled left edge)
  const tabW = 42, tabH = 7, tabX = PAGE_W - tabW, tabY = BANNER_H;
  doc.setFillColor(...theme.productTo);
  doc.rect(tabX + 4, tabY, tabW - 4, tabH, "F");
  doc.triangle(tabX + 4, tabY, tabX + 4, tabY + tabH, tabX, tabY + tabH, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("REFERENCE LIST", tabX + tabW / 2 + 2, tabY + 4.8, { align: "center" });

  return tabY + tabH;
}

/* ── sleek data cells: hairline tiles in a 2-column grid ───── */
function drawDataCell(
  doc: jsPDF,
  theme: BrandTheme,
  label: string,
  value: string,
  x: number,
  y: number,
  w: number,
): number {
  const padX = 5;
  const textW = w - padX * 2;
  const lines = doc.splitTextToSize(value || "—", textW).slice(0, 4);
  const h = Math.max(17, 11 + lines.length * 4.6);

  // tile
  doc.setFillColor(250, 250, 251);
  doc.rect(x, y, w, h, "F");
  doc.setDrawColor(228, 229, 232);
  doc.setLineWidth(0.2);
  doc.rect(x, y, w, h, "S");
  // accent tick on the left edge
  doc.setFillColor(...theme.accent);
  doc.rect(x, y, 0.9, h, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);
  doc.setTextColor(...MUTED);
  doc.text(label.toUpperCase().split("").join(" "), x + padX, y + 5.6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...INK);
  let ly = y + 11;
  for (const ln of lines) {
    doc.text(ln, x + padX, ly);
    ly += 4.6;
  }
  return h;
}

function drawSectionTitle(doc: jsPDF, theme: BrandTheme, title: string, y: number): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...INK);
  doc.text(title.toUpperCase().split("").join(" "), MARGIN, y);
  const tw = doc.getTextWidth(title.toUpperCase().split("").join(" "));
  doc.setDrawColor(...theme.accent);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, y + 2, MARGIN + tw, y + 2);
  doc.setDrawColor(232, 232, 234);
  doc.setLineWidth(0.2);
  doc.line(MARGIN + tw + 3, y + 2, PAGE_W - MARGIN, y + 2);
  return y + 8;
}

function drawPageFooter(doc: jsPDF, theme: BrandTheme) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...INK);
  doc.text("GIBCA", MARGIN, PAGE_H - 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...theme.accent);
  doc.text(theme.name, PAGE_W - MARGIN, PAGE_H - 12, { align: "right" });
}

function tagChip(doc: jsPDF, label: string, color: RGB, x: number, y: number): number {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  const w = doc.getTextWidth(label.toUpperCase()) + 4;
  doc.setFillColor(color[0], color[1], color[2]);
  doc.setDrawColor(color[0], color[1], color[2]);
  doc.setLineWidth(0.2);
  doc.roundedRect(x, y, w, 4.2, 0.8, 0.8, "S");
  doc.setTextColor(color[0], color[1], color[2]);
  doc.text(label.toUpperCase(), x + 2, y + 3);
  return w;
}

/* ── gallery pages: 2-up, caption + chips ──────────────────── */
async function drawGallery(doc: jsPDF, project: ProjectRow, images: ProjectImage[], theme: BrandTheme) {
  const padH = 14, padV = 16, gap = 8, captionH = 9;
  const slotH = (PAGE_H - padV * 2 - gap) / 2;
  const imgH = slotH - captionH;
  const boxW = PAGE_W - padH * 2;

  for (let i = 0; i < images.length; i++) {
    const slot = i % 2;
    if (slot === 0) {
      doc.addPage();
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, PAGE_W, PAGE_H, "F");
    }
    const y = padV + slot * (slotH + gap);
    const img = await croppedCover(images[i].url, boxW, imgH);
    doc.setFillColor(245, 245, 245);
    doc.rect(padH, y, boxW, imgH, "F");
    if (img) {
      try {
        doc.addImage(img.data, img.fmt, padH, y, boxW, imgH, undefined, "FAST");
      } catch { /* ignore */ }
    } else {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      doc.text("Image unavailable", padH + 5, y + 8);
    }

    // caption row
    const cy = y + imgH + 5.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(26, 26, 26);
    doc.text(doc.splitTextToSize(project.project_name, boxW * 0.55)[0], padH, cy);

    const chips: [string, RGB][] = [];
    if (project.sector) chips.push([project.sector, theme.accent]);
    if (project.product) chips.push([project.product, [26, 61, 204]]);
    if (project.country) chips.push([project.country, [26, 122, 26]]);
    for (const t of (images[i].tags ?? []).slice(0, 2)) chips.push([t, [102, 102, 102]]);
    // right-align chips
    doc.setFontSize(6);
    const widths = chips.map((c) => doc.getTextWidth(c[0].toUpperCase()) + 4);
    let cx = PAGE_W - padH - (widths.reduce((a, b) => a + b, 0) + 2 * Math.max(0, chips.length - 1));
    for (let k = 0; k < chips.length; k++) {
      cx += tagChip(doc, chips[k][0], chips[k][1], cx, cy - 3.2) + 2;
    }
  }
}

/* ── public API ────────────────────────────────────────────── */
export async function buildProjectPdf(
  project: ProjectRow,
  images: ProjectImage[],
  existing?: jsPDF,
): Promise<jsPDF> {
  const doc = existing ?? new jsPDF({ unit: "mm", format: "a4" });
  if (existing) doc.addPage();
  const theme = themeFor(project.brand);

  let y = (await drawBanner(doc, project, theme, images[0]?.url)) + 14;

  // project title block
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...INK);
  const titleLines = doc.splitTextToSize(project.project_name, PAGE_W - MARGIN * 2).slice(0, 2);
  doc.text(titleLines, MARGIN, y);
  y += titleLines.length * 8 + 1;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text(
    [theme.name, project.country, project.sector].filter(Boolean).join("   /   ").toUpperCase(),
    MARGIN,
    y,
  );
  y += 9;

  y = drawSectionTitle(doc, theme, "Project Data", y);

  const cells: [string, string][] = [
    ["Project No", `${project.project_no}`],
    ["Country", project.country || "—"],
    ["Sector", project.sector || "—"],
    ["Product", project.product || "—"],
    ["Finish", project.finish || "—"],
    ["Contractor", project.contractor || "—"],
  ];
  if (project.speciality) cells.push(["Speciality", project.speciality]);
  if (project.accessories) cells.push(["Accessories", project.accessories]);

  const gap = 5;
  const colW = (PAGE_W - MARGIN * 2 - gap) / 2;
  let rowMax = 0;
  for (let i = 0; i < cells.length; i++) {
    if (y > PAGE_H - 34) break;
    const col = i % 2;
    const h = drawDataCell(
      doc, theme, cells[i][0], cells[i][1],
      MARGIN + col * (colW + gap), y, colW,
    );
    rowMax = Math.max(rowMax, h);
    if (col === 1 || i === cells.length - 1) {
      y += rowMax + gap;
      rowMax = 0;
    }
  }

  if (project.tags?.length && y < PAGE_H - 40) {
    y = drawSectionTitle(doc, theme, "Tags", y + 3);
    let cx = MARGIN;
    for (const t of project.tags) {
      const w = doc.getTextWidth(t.toUpperCase()) + 4;
      if (cx + w > PAGE_W - MARGIN) { cx = MARGIN; y += 6; }
      cx += tagChip(doc, t, theme.accent, cx, y - 3) + 2;
    }
    y += 10;
  }

  if (project.description && y < PAGE_H - 34) {
    y = drawSectionTitle(doc, theme, "Description", y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    const dl = doc.splitTextToSize(project.description, PAGE_W - MARGIN * 2);
    doc.text(dl.slice(0, 8), MARGIN, y + 1);
  }

  drawPageFooter(doc, theme);

  if (images.length) await drawGallery(doc, project, images, theme);

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
