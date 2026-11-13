import type { MouseEvent } from "react";

export function openPickerFromLabel(event: MouseEvent<HTMLLabelElement>) {
  const input = event.currentTarget.querySelector<HTMLInputElement>(
    'input[type="date"], input[type="month"]',
  );
  if (!input || event.target === input) return;

  event.preventDefault();
  if (typeof input.showPicker === "function") {
    input.showPicker();
  } else {
    input.focus();
  }
}
