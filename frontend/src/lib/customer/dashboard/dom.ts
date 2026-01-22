/**
 * DOM helper utilities for dashboard modules
 */

/**
 * Get element by ID, throwing if not found (required element)
 */
export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Required element #${id} not found`);
  return el as T;
}

/**
 * Get element by ID, returning null if not found (optional element)
 */
export function maybeById<T extends HTMLElement = HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

/**
 * Set element hidden state
 */
export function setHidden(el: HTMLElement | null, hidden: boolean): void {
  if (!el) return;
  if (hidden) {
    el.classList.add("hidden");
  } else {
    el.classList.remove("hidden");
  }
}

/**
 * Set element text content
 */
export function setText(el: HTMLElement | null, text: string): void {
  if (!el) return;
  el.textContent = text;
}

/**
 * Set element innerHTML
 */
export function setHTML(el: HTMLElement | null, html: string): void {
  if (!el) return;
  el.innerHTML = html;
}

/**
 * Set button disabled state
 */
export function setDisabled(el: HTMLButtonElement | null, disabled: boolean): void {
  if (!el) return;
  el.disabled = disabled;
}

/**
 * Add class to element
 */
export function addClass(el: HTMLElement | null, ...classes: string[]): void {
  if (!el) return;
  el.classList.add(...classes);
}

/**
 * Remove class from element
 */
export function removeClass(el: HTMLElement | null, ...classes: string[]): void {
  if (!el) return;
  el.classList.remove(...classes);
}

/**
 * Toggle class on element
 */
export function toggleClass(el: HTMLElement | null, className: string): void {
  if (!el) return;
  el.classList.toggle(className);
}
