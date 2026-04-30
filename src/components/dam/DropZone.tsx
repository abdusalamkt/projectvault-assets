import { useRef, useState, DragEvent } from "react";
import { Upload } from "lucide-react";

interface Props {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  hint?: string;
}

export default function DropZone({ onFiles, disabled, hint }: Props) {
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    if (disabled) return;
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length) onFiles(files);
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      className={`group cursor-pointer border-2 border-dashed rounded-md p-8 text-center transition-smooth animate-fade-in ${
        over ? "border-gold bg-gold/5 scale-[1.01]" : "border-border hover:border-gold/70 hover:bg-secondary/50"
      } ${disabled ? "opacity-50 pointer-events-none" : ""}`}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) onFiles(files);
          e.target.value = "";
        }}
      />
      <div className={`mx-auto mb-3 w-12 h-12 rounded-full bg-secondary flex items-center justify-center transition-smooth ${over ? "bg-gold text-gold-foreground scale-110" : "text-muted-foreground group-hover:text-gold"}`}>
        <Upload size={20} />
      </div>
      <p className="font-medium text-sm">Drop files here, or click to browse</p>
      <p className="text-xs text-muted-foreground mt-1">{hint ?? "Images, PDFs, videos, GLB/3D, anything — up to 50 MB each"}</p>
    </div>
  );
}