"use client";

interface Props {
  label: string;
  description: string;
  enabled: boolean;
  onChange: (next: boolean) => void;
}

export function SettingToggle({ label, description, enabled, onChange }: Props) {
  return (
    <div className="flex items-start justify-between gap-6 rounded-md border border-border bg-bg-subtle/40 px-4 py-3">
      <div className="min-w-0">
        <div className="text-sm font-medium text-fg">{label}</div>
        <p className="mt-1 text-xs text-fg-muted">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={label}
        onClick={() => onChange(!enabled)}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
          enabled ? "bg-accent" : "bg-bg-emphasis"
        }`}
      >
        <span
          aria-hidden
          className={`inline-block h-4 w-4 rounded-full bg-bg shadow transition-transform ${
            enabled ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}
