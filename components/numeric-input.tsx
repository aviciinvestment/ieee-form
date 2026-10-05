"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";

type Props = {
  id?: string;
  value: number;
  onCommit: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

/**
 * Number input that keeps the raw text being typed.
 *
 * A plain controlled `type="number"` cannot have its first digit removed: emptying the field fires
 * `onChange` with `""`, `Number("") || min` turns that straight back into a number, and React
 * re-renders the old value, so backspace appears to do nothing and a new digit is appended instead
 * of replacing it. This component holds the text locally while the field has focus and pushes a
 * clamped number up on blur, so the content is freely editable on a mobile keypad.
 */
export function NumericInput({ id, value, onCommit, min, max, step, placeholder, disabled, className }: Props) {
  const [text, setText] = useState(() => String(value));
  const focused = useRef(false);

  // Follow external changes (loading a quiz) while the field is idle, but never fight the user.
  useEffect(() => {
    if (focused.current) return;
    setText(String(value));
  }, [value]);

  function clamp(input: number) {
    return Math.min(max, Math.max(min, input));
  }

  function handleChange(raw: string) {
    // Keep only what a numeric keypad can produce, so "e", "+" or "-" never enter the state.
    const next = raw.replace(/[^0-9]/g, "").slice(0, 6);
    setText(next);

    // An empty field is a valid intermediate state while typing; the minimum is restored on blur.
    if (next === "") return;

    const parsed = Number(next);
    if (Number.isFinite(parsed)) onCommit(clamp(parsed));
  }

  function handleBlur() {
    focused.current = false;
    const parsed = Number(text);
    const committed = text === "" || !Number.isFinite(parsed) ? min : clamp(parsed);
    setText(String(committed));
    onCommit(committed);
  }

  return (
    <Input
      id={id}
      type="number"
      inputMode="numeric"
      pattern="[0-9]*"
      autoComplete="off"
      // Chrome/Safari ignore these for typing, but they keep the spinner arrows in range.
      min={min}
      max={max}
      step={step ?? 1}
      value={text}
      onFocus={() => {
        focused.current = true;
      }}
      onChange={(event) => handleChange(event.target.value)}
      onBlur={handleBlur}
      placeholder={placeholder ?? String(min)}
      disabled={disabled}
      className={className}
    />
  );
}