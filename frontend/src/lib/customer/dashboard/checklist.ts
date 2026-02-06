/**
 * Activation checklist localStorage persistence and UI updates
 */
import { maybeById } from "./dom";

const CHECKLIST_STORAGE_KEY = "ll_activation_checklist";

interface ChecklistState {
  step2: boolean;
  step3: boolean;
}

const checkIconSvg =
  '<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0"></path></svg>';

/**
 * Get checklist state from localStorage
 */
export function getChecklistState(): ChecklistState {
  try {
    const stored = localStorage.getItem(CHECKLIST_STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    // Ignore parse errors
  }
  return { step2: false, step3: false };
}

/**
 * Save checklist state to localStorage
 */
export function saveChecklistState(state: ChecklistState): void {
  try {
    localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Update checklist UI for a given suffix (1 or 2)
 */
function updateChecklistUI(suffix: string, state: ChecklistState): void {
  const step2Row = maybeById(`step2-row-${suffix}`);
  const step2Toggle = maybeById(`step2-toggle-${suffix}`);
  const step2Text = maybeById(`step2-text-${suffix}`);
  const step3Row = maybeById(`step3-row-${suffix}`);
  const step3Toggle = maybeById(`step3-toggle-${suffix}`);
  const step3Text = maybeById(`step3-text-${suffix}`);

  if (step2Row && step2Toggle && step2Text) {
    step2Row.setAttribute("aria-pressed", String(state.step2));
    if (state.step2) {
      step2Toggle.innerHTML = checkIconSvg;
      step2Toggle.className = "flex items-center justify-center w-6 h-6 rounded-full bg-success text-success-content text-xs font-bold shrink-0";
      step2Text.className = "text-sm text-base-content/70 line-through";
    } else {
      step2Toggle.innerHTML = "2";
      step2Toggle.className = "flex items-center justify-center w-6 h-6 rounded-full bg-base-300 text-xs font-bold shrink-0";
      step2Text.className = "text-sm text-base-content/70";
    }
  }

  if (step3Row && step3Toggle && step3Text) {
    step3Row.setAttribute("aria-pressed", String(state.step3));
    if (state.step3) {
      step3Toggle.innerHTML = checkIconSvg;
      step3Toggle.className = "flex items-center justify-center w-6 h-6 rounded-full bg-success text-success-content text-xs font-bold shrink-0";
      step3Text.className = "text-sm text-base-content/70 line-through";
    } else {
      step3Toggle.innerHTML = "3";
      step3Toggle.className = "flex items-center justify-center w-6 h-6 rounded-full bg-base-300 text-xs font-bold shrink-0";
      step3Text.className = "text-sm text-base-content/70";
    }
  }
}

/**
 * Sync UI for both checklist instances
 */
function syncAllChecklists(state: ChecklistState): void {
  updateChecklistUI("1", state);
  updateChecklistUI("2", state);
}

/**
 * Initialize checklist event listeners
 */
export function initChecklist(): void {
  const state = getChecklistState();
  
  ["1", "2"].forEach((suffix) => {
    updateChecklistUI(suffix, state);
    
    maybeById(`step2-row-${suffix}`)?.addEventListener("click", () => {
      const currentState = getChecklistState();
      currentState.step2 = !currentState.step2;
      saveChecklistState(currentState);
      syncAllChecklists(currentState);
    });
    
    maybeById(`step3-row-${suffix}`)?.addEventListener("click", () => {
      const currentState = getChecklistState();
      currentState.step3 = !currentState.step3;
      saveChecklistState(currentState);
      syncAllChecklists(currentState);
    });
    
    maybeById(`checklist-reset-${suffix}`)?.addEventListener("click", () => {
      const newState = { step2: false, step3: false };
      saveChecklistState(newState);
      syncAllChecklists(newState);
    });
  });
}
