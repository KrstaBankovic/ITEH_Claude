"use client";

import type { InputHTMLAttributes } from "react";
import { useId } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  type?: "text" | "email" | "password" | "number" | "date";
  label?: string;
  error?: string;
  hint?: string;
};

export default function Input({
  type = "text",
  label,
  error,
  hint,
  className = "",
  id,
  ...rest
}: Props) {
  const generated = useId();
  const inputId = id ?? generated;

  return (
    <div className="flex flex-col gap-1">
      {label ? (
        <label htmlFor={inputId} className="text-sm font-medium">
          {label}
        </label>
      ) : null}
      <input
        {...rest}
        id={inputId}
        type={type}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : undefined}
        className={`rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/20 ${
          error ? "border-red-500" : "border-black/15"
        } ${className}`}
      />
      {error ? (
        <span id={`${inputId}-error`} className="text-xs text-red-600">
          {error}
        </span>
      ) : hint ? (
        <span className="text-xs opacity-60">{hint}</span>
      ) : null}
    </div>
  );
}
