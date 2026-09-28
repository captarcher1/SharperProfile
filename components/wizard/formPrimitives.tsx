// Step 3 (B1) — shared building blocks for the 9 per-section-type review/
// edit forms (components/wizard/sectionForms/). Each per-type form is a
// thin composition of these; the list/tag/link plumbing lives here once
// instead of being re-written 9 times.
//
// Every field here takes an optional `help` prop — mouseover help text
// (added 2026-09-08, per request: every actionable field, across every
// step, should explain itself on hover of either its label or its input).
// The mechanism is pure CSS (see globals.css's `.hasTip`/`data-tip` rules):
// each field's outer <label>/<div> already wraps both its label text and
// its actual input/textarea, so putting `data-tip` on that one wrapping
// element makes hovering (or focusing) EITHER child reveal the same
// bubble — no separate tooltip per sub-element, no JS. `help` is optional
// and additive: a field with no `help` renders exactly as before.
import type { ReactNode } from "react";
import type { LinkData } from "@/lib/trackBSectionSchemas";

/** Renders the small "hover for more" affordance next to a label — only when there's actually help text to show. */
function TipIcon({ help }: { help?: string }) {
  if (!help) return null;
  return (
    <span className="tipIcon" aria-hidden="true">
      ?
    </span>
  );
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  required,
  help,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  help?: string;
}) {
  return (
    <label className="formField hasTip" data-tip={help || undefined}>
      <span className="formFieldLabel">
        {label}
        {required && <span className="required"> *</span>}
        <TipIcon help={help} />
      </span>
      <input type="text" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
  help,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  help?: string;
}) {
  return (
    <label className="formField hasTip" data-tip={help || undefined}>
      <span className="formFieldLabel">
        {label}
        <TipIcon help={help} />
      </span>
      <textarea value={value} placeholder={placeholder} rows={rows} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

/** An optional {label, href} pair — a checkbox toggles it between undefined and a real value, since most CTAs/social links are genuinely optional on Track B's schema. */
export function OptionalLinkField({
  title,
  value,
  onChange,
  help,
}: {
  title: string;
  value: LinkData | undefined;
  onChange: (value: LinkData | undefined) => void;
  help?: string;
}) {
  const enabled = value !== undefined;
  return (
    <div className="formField hasTip" data-tip={help || undefined}>
      <label className="checkboxRow">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onChange(e.target.checked ? { label: "", href: "" } : undefined)}
        />
        <span>
          {title}
          <TipIcon help={help} />
        </span>
      </label>
      {enabled && (
        <div className="linkFieldRow">
          <input
            type="text"
            placeholder='Link text (e.g. "View resume")'
            value={value?.label ?? ""}
            onChange={(e) => onChange({ label: e.target.value, href: value?.href ?? "" })}
          />
          <input
            type="text"
            placeholder="URL"
            value={value?.href ?? ""}
            onChange={(e) => onChange({ label: value?.label ?? "", href: e.target.value })}
          />
        </div>
      )}
    </div>
  );
}

/** A free-typed list of short strings (skills, chips) — type and press Enter or comma to add, click a chip's × to remove. */
export function TagListInput({
  label,
  value,
  onChange,
  placeholder,
  help,
}: {
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  help?: string;
}) {
  function addFromInput(input: HTMLInputElement) {
    const raw = input.value.trim();
    if (raw.length === 0) return;
    if (!value.includes(raw)) onChange([...value, raw]);
    input.value = "";
  }

  return (
    <div className="formField hasTip" data-tip={help || undefined}>
      <span className="formFieldLabel">
        {label}
        <TipIcon help={help} />
      </span>
      <div className="tagList">
        {value.map((tag, i) => (
          <span key={`${tag}-${i}`} className="tagChip">
            {tag}
            <button type="button" aria-label={`Remove ${tag}`} onClick={() => onChange(value.filter((_, j) => j !== i))}>
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          className="tagInput"
          placeholder={placeholder ?? "Type and press Enter"}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addFromInput(e.currentTarget);
            }
          }}
          onBlur={(e) => addFromInput(e.currentTarget)}
        />
      </div>
    </div>
  );
}

/** A single textarea for prose paragraphs, joined/split on blank lines — simpler than a per-paragraph list for a bio-style field. */
export function ParagraphsField({
  label,
  value,
  onChange,
  help,
}: {
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
  help?: string;
}) {
  return (
    <label className="formField hasTip" data-tip={help || undefined}>
      <span className="formFieldLabel">
        {label}
        <TipIcon help={help} />
      </span>
      <textarea
        rows={6}
        value={value.join("\n\n")}
        placeholder="Separate paragraphs with a blank line."
        onChange={(e) =>
          onChange(
            e.target.value
              .split(/\n{2,}/)
              .map((p) => p.trim())
              .filter((p) => p.length > 0)
          )
        }
      />
    </label>
  );
}

/** Generic add/remove/reorder list of object items — the plumbing behind metrics, cardGrid, processSteps, topicGrid, chipGroups, logoCredentials.items, and timeline. */
export function ItemListEditor<T>({
  items,
  onChange,
  emptyItem,
  renderItem,
  addLabel = "Add item",
  itemLabel,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  emptyItem: () => T;
  renderItem: (item: T, update: (patch: Partial<T>) => void) => ReactNode;
  addLabel?: string;
  itemLabel?: (item: T, index: number) => string;
}) {
  function updateAt(index: number, patch: Partial<T>) {
    const next = items.slice();
    next[index] = { ...next[index], ...patch };
    onChange(next);
  }
  function removeAt(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }
  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = items.slice();
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div className="itemList">
      {items.map((item, i) => (
        <div key={i} className="itemCard">
          <div className="itemCardHeader">
            <span className="itemCardTitle">{itemLabel ? itemLabel(item, i) : `Item ${i + 1}`}</span>
            <div className="itemCardActions">
              <button type="button" className="iconButton" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                ↑
              </button>
              <button
                type="button"
                className="iconButton"
                onClick={() => move(i, 1)}
                disabled={i === items.length - 1}
                aria-label="Move down"
              >
                ↓
              </button>
              <button type="button" className="secondary" onClick={() => removeAt(i)}>
                Remove
              </button>
            </div>
          </div>
          {renderItem(item, (patch) => updateAt(i, patch))}
        </div>
      ))}
      <button type="button" className="secondary" onClick={() => onChange([...items, emptyItem()])}>
        {addLabel}
      </button>
    </div>
  );
}
