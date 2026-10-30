// A hidden file input with one shared open action and repeatable same-file selection.

import type { ReactNode } from "react";
import { useRef } from "react";

export function useFilePicker({
  accept,
  capture,
  label,
  onFile,
}: {
  accept: string;
  capture?: "environment";
  label?: string;
  onFile: (file: File) => void;
}): { open: () => void; input: ReactNode } {
  const inputRef = useRef<HTMLInputElement>(null);
  return {
    open: () => inputRef.current?.click(),
    input: (
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        capture={capture}
        className="hidden"
        aria-label={label}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file !== undefined) onFile(file);
        }}
      />
    ),
  };
}
