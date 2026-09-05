import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Mark } from "./Page";

export type SelectOption<T extends string = string> = {
  value: T;
  label: string;
};

type SelectProps<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: SelectOption<T>[];
  className?: string;
  /** Compacto — ex. filtro inline na barra de ferramentas */
  inline?: boolean;
  disabled?: boolean;
  placeholder?: string;
};

export function Select<T extends string>({
  value,
  onChange,
  options,
  className = "",
  inline = false,
  disabled = false,
  placeholder = "Escolher…",
}: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const id = useId();
  const listId = `${id}-list`;
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const idx = options.findIndex((o) => o.value === value);
    setHighlight(idx >= 0 ? idx : 0);
  }, [open, options, value]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.children[highlight] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [highlight, open]);

  function pick(idx: number) {
    const opt = options[idx];
    if (!opt) return;
    onChange(opt.value);
    setOpen(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      else setHighlight((h) => Math.min(h + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) setOpen(true);
      else setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (open) pick(highlight);
      else setOpen(true);
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Home") {
      e.preventDefault();
      setHighlight(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setHighlight(options.length - 1);
    }
  }

  return (
    <div
      ref={rootRef}
      data-open={open || undefined}
      className={`select-root ${inline ? "select-root-inline" : ""} ${className}`}
    >
      <button
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        className={`select-trigger ${inline ? "select-trigger-inline" : ""}`}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={onKeyDown}
      >
        <span className="select-value">{selected?.label ?? placeholder}</span>
        <span className="select-chevron" aria-hidden />
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-labelledby={id}
          className="select-menu"
        >
          {options.map((opt, i) => {
            const active = opt.value === value;
            const hot = i === highlight;
            return (
              <li key={opt.value} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`select-option ${active ? "select-option-active" : ""} ${hot ? "select-option-hot" : ""}`}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => pick(i)}
                >
                  <Mark tone={active ? "pine" : "soft"} />
                  <span className="min-w-0 flex-1 truncate text-left">{opt.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
