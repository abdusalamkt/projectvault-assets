import JSZip from "jszip";

export async function fetchAsBlob(url: string): Promise<Blob> {
  const res = await fetch(url, { mode: "cors" });
  if (!res.ok) throw new Error(`Failed: ${url}`);
  return await res.blob();
}

export function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function safeName(s: string) {
  return s.replace(/[\\/:*?"<>|]+/g, "_").slice(0, 80);
}

export function fileNameFromUrl(url: string, fallback = "image.jpg") {
  try {
    const u = new URL(url);
    const last = u.pathname.split("/").pop();
    return last && last.includes(".") ? decodeURIComponent(last) : fallback;
  } catch {
    return fallback;
  }
}

export async function downloadSingleImage(url: string, filename?: string) {
  const blob = await fetchAsBlob(url);
  triggerBlobDownload(blob, filename || fileNameFromUrl(url));
}

export interface ZipFile { folder: string; name: string; url: string }

export async function downloadAsZip(
  files: ZipFile[],
  zipName: string,
  onProgress?: (done: number, total: number) => void,
) {
  const zip = new JSZip();
  let done = 0;
  // Limit concurrency to avoid overwhelming the browser
  const concurrency = 6;
  let idx = 0;
  async function worker() {
    while (idx < files.length) {
      const i = idx++;
      const f = files[i];
      try {
        const blob = await fetchAsBlob(f.url);
        const folder = zip.folder(safeName(f.folder)) ?? zip;
        folder.file(safeName(f.name), blob);
      } catch (e) {
        // skip failed
      }
      done++;
      onProgress?.(done, files.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, files.length) }, () => worker()));
  const blob = await zip.generateAsync({ type: "blob" });
  triggerBlobDownload(blob, zipName);
}
