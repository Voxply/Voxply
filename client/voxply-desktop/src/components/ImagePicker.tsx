import { useState } from "react";

/**
 * Drop-zone + button file picker that base64-encodes the chosen image
 * and hands it back as a data URL. Shared between the avatar and hub-icon
 * editors so they look and behave the same. Hard 256 KB cap.
 */
export function ImagePicker({
  onPick,
  onClear,
  hasValue,
  buttonLabel,
}: {
  onPick: (dataUrl: string) => void;
  onClear: () => void;
  hasValue: boolean;
  buttonLabel: string;
}) {
  const [dragOver, setDragOver] = useState(false);

  function handleFile(file: File) {
    if (file.size > 256 * 1024) {
      alert("Image too large (max 256 KB)");
      return;
    }
    if (!file.type.startsWith("image/")) {
      alert("Pick an image file");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") onPick(result);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div
      className={`image-picker ${dragOver ? "drag-over" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        if (!dragOver) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) handleFile(f);
      }}
    >
      <label className="btn-secondary image-picker-button">
        {buttonLabel}
        <input
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
      </label>
      <span className="muted image-picker-hint">or drop an image here</span>
      {hasValue && (
        <button onClick={onClear} className="btn-secondary">
          Clear
        </button>
      )}
    </div>
  );
}
