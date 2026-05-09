import { THEMES } from "../constants";

export function ThemePicker({
  value,
  onChange,
}: {
  value: "calm" | "classic" | "linear" | "light";
  onChange: (t: "calm" | "classic" | "linear" | "light") => void;
}) {
  return (
    <div className="theme-cards">
      {THEMES.map((t) => (
        <button
          key={t.id}
          className={`theme-card ${value === t.id ? "active" : ""}`}
          onClick={() => onChange(t.id)}
          type="button"
        >
          {t.id === "calm" && <span className="theme-card-default">Default</span>}
          <div className="theme-card-name">{t.name}</div>
          <div className="theme-card-swatches">
            {t.swatches.map((color) => (
              <span
                key={color}
                className="theme-swatch"
                style={{ background: color }}
              />
            ))}
          </div>
          <p className="theme-card-tagline">{t.tagline}</p>
        </button>
      ))}
    </div>
  );
}
