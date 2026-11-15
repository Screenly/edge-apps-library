/* eslint-disable max-lines -- a single CSS string */
/** Shadow DOM styles for <edge-app-devtools> */
export const devToolsStyles = `
  :host {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 9999;
    display: none;
    --bg: rgb(17 17 21 / 0.94);
    --surface: rgb(255 255 255 / 0.05);
    --surface-hover: rgb(255 255 255 / 0.09);
    --border: rgb(255 255 255 / 0.1);
    --border-strong: rgb(255 255 255 / 0.2);
    --text: #f4f4f5;
    --label: #d4d4d8;
    --muted: #a1a1aa;
    --accent: #a78bfa;
    --accent-strong: #7c3aed;
    --success: #4ade80;
    --warning: #fbbf24;
    --danger: #f87171;
    --radius: 8px;
    --mono: ui-monospace, 'SF Mono', 'Cascadia Mono', Menlo, Consolas, monospace;
  }

  :host([hidden]),
  [hidden] {
    display: none !important;
  }

  * {
    box-sizing: border-box;
  }

  .info-panel {
    position: fixed;
    top: 12px;
    right: 12px;
    width: 340px;
    max-width: calc(100vw - 24px);
    max-height: calc(100vh - 24px);
    display: flex;
    flex-direction: column;
    background: var(--bg);
    -webkit-backdrop-filter: blur(20px) saturate(140%);
    backdrop-filter: blur(20px) saturate(140%);
    border: 1px solid var(--border);
    border-radius: 14px;
    color: var(--text);
    font: 13px/1.45 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
    pointer-events: auto;
    user-select: none;
    overflow: hidden;
  }

  .info-panel__header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 10px 10px 14px;
  }

  .info-panel__title {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    font-weight: 600;
    letter-spacing: -0.01em;
  }

  .badge {
    padding: 1px 7px;
    border-radius: 999px;
    background: rgb(251 191 36 / 0.14);
    color: var(--warning);
    font-size: 11px;
    font-weight: 500;
    white-space: nowrap;
  }

  .info-panel__body {
    overflow-y: auto;
    overscroll-behavior: contain;
    border-top: 1px solid var(--border);
    padding: 12px 14px 0;
    scrollbar-width: thin;
    scrollbar-color: var(--border-strong) transparent;
  }

  .stats {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
    margin: 0;
  }

  .stats div,
  .signals {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }

  .stats div {
    padding: 6px 10px;
  }

  .stats dt,
  .section-title,
  legend {
    color: var(--muted);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .stats dd {
    margin: 0;
    font-family: var(--mono);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }

  .info-panel__hint {
    margin: 12px 0;
    color: var(--muted);
    font-size: 12px;
  }

  kbd {
    padding: 0 5px;
    border: 1px solid var(--border-strong);
    border-bottom-width: 2px;
    border-radius: 4px;
    font-family: var(--mono);
    font-size: 11px;
    color: var(--text);
  }

  .dev-server > * {
    margin-top: 14px;
  }

  .signals {
    padding: 2px 10px;
  }

  .signal {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 6px 0;
  }

  .signal + .signal {
    border-top: 1px solid var(--border);
  }

  .pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family: var(--mono);
    font-size: 12px;
    color: var(--label);
    font-variant-numeric: tabular-nums;
  }

  .pill::before {
    content: '';
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--muted);
  }

  .pill[data-tone='success']::before { background: var(--success); }
  .pill[data-tone='warning']::before { background: var(--warning); }
  .pill[data-tone='neutral']::before { background: transparent; border: 1px solid var(--muted); }

  fieldset {
    margin: 14px 0 0;
    padding: 0;
    border: 0;
    min-width: 0;
  }

  legend {
    padding: 0;
    margin-bottom: 6px;
  }

  .segmented {
    display: flex;
    gap: 2px;
    padding: 2px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }

  .segmented label {
    flex: 1;
    position: relative;
  }

  .segmented input {
    position: absolute;
    opacity: 0;
    inset: 0;
    margin: 0;
    cursor: pointer;
  }

  .segmented span {
    display: block;
    padding: 4px 6px;
    border-radius: 6px;
    text-align: center;
    color: var(--muted);
    font-weight: 500;
    white-space: nowrap;
  }

  .segmented label:hover span { color: var(--text); background: var(--surface-hover); }
  .segmented input:checked + span { background: rgb(255 255 255 / 0.14); color: var(--text); }
  .segmented input:focus-visible + span { outline: 2px solid var(--accent); outline-offset: 1px; }

  .help,
  .field__help {
    margin: 4px 0 0;
    color: var(--muted);
    font-size: 12px;
    line-height: 1.4;
  }

  details {
    margin-top: 14px;
    border-top: 1px solid var(--border);
    padding-top: 10px;
  }

  summary {
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    list-style: none;
    border-radius: 4px;
  }

  summary::-webkit-details-marker { display: none; }

  summary::before {
    content: '';
    width: 6px;
    height: 6px;
    margin: 0 3px;
    border-right: 1.5px solid var(--muted);
    border-bottom: 1.5px solid var(--muted);
    transform: rotate(-45deg);
    transition: transform 0.15s;
  }

  details[open] > summary::before { transform: rotate(45deg); }
  summary:hover { color: var(--text); }
  summary:hover::before { border-color: var(--text); }

  .field {
    margin-top: 12px;
  }

  .field label {
    color: var(--label);
    font-weight: 500;
  }

  .field--stacked label {
    display: block;
    margin-bottom: 4px;
  }

  .field--switch {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    column-gap: 12px;
  }

  .field--switch .field__help { grid-column: 1 / -1; }

  .tag {
    margin-left: 6px;
    padding: 0 6px;
    border-radius: 999px;
    background: var(--surface-hover);
    color: var(--muted);
    font-size: 11px;
    font-weight: 500;
  }

  button,
  input,
  select {
    font: inherit;
    color: var(--text);
  }

  input[type='text'],
  input[type='password'],
  input[type='number'],
  select {
    width: 100%;
    height: 30px;
    padding: 0 10px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 6px;
    user-select: text;
    transition: border-color 0.15s, background-color 0.15s;
  }

  input::placeholder { color: #71717a; }

  select {
    appearance: none;
    padding-right: 28px;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='none' stroke='%23a1a1aa' stroke-width='1.5'%3E%3Cpath d='M1 1l4 4 4-4'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 10px center;
  }

  select option { background: #18181b; color: var(--text); }

  input:hover,
  select:hover { border-color: var(--border-strong); }

  input[type='checkbox'] {
    appearance: none;
    position: relative;
    width: 32px;
    height: 18px;
    margin: 0;
    border-radius: 999px;
    background: rgb(255 255 255 / 0.16);
    cursor: pointer;
    transition: background-color 0.15s;
  }

  input[type='checkbox']::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #fff;
    transition: transform 0.15s;
  }

  input[type='checkbox']:hover { background: rgb(255 255 255 / 0.26); }
  input[type='checkbox']:checked { background: var(--accent-strong); }
  input[type='checkbox']:checked:hover { background: #8b5cf6; }
  input[type='checkbox']:checked::after { transform: translateX(14px); }

  input:invalid { border-color: var(--danger); }

  button,
  input,
  select,
  summary {
    outline: none;
  }

  button:focus-visible,
  input:focus-visible,
  select:focus-visible,
  summary:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  button {
    height: 30px;
    padding: 0 12px;
    border: 1px solid var(--border-strong);
    border-radius: 6px;
    background: transparent;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.15s, border-color 0.15s;
  }

  button:hover:not(:disabled) { background: var(--surface-hover); }
  button:disabled { cursor: default; opacity: 0.55; }

  button.primary {
    flex: 1;
    border-color: transparent;
    background: var(--accent-strong);
    color: #fff;
  }

  button.primary:hover:not(:disabled) { background: #6d28d9; }

  .collapse {
    width: 28px;
    height: 28px;
    padding: 0;
    display: grid;
    place-items: center;
    border-color: transparent;
    color: var(--muted);
  }

  .collapse:hover:not(:disabled) { color: var(--text); }
  .collapse svg { transition: transform 0.15s; }
  .collapse[aria-expanded='false'] svg { transform: rotate(180deg); }

  .actions {
    position: sticky;
    bottom: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 14px -14px 0;
    padding: 10px 14px;
    background: #141418;
    border-top: 1px solid var(--border);
  }

  .status {
    flex-basis: 100%;
    font-size: 12px;
    color: var(--label);
  }

  .status:empty { display: none; }
  .status--error { color: var(--danger); }

  @media (prefers-reduced-motion: reduce) {
    * { transition: none !important; }
  }
`
