/** Shadow DOM styles for <edge-app-devtools> */
export const devToolsStyles = `
      :host {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        pointer-events: none;
        z-index: 9999;
        display: none;
      }

      :host([hidden]) {
        display: none;
      }

      [hidden] {
        display: none !important;
      }

      .info-panel {
        position: fixed;
        top: 10px;
        right: 10px;
        background: rgba(0, 0, 0, 0.88);
        color: #00ff00;
        padding: 12px 16px;
        border-radius: 4px;
        font-family: 'Courier New', monospace;
        font-size: 12px;
        line-height: 1.6;
        pointer-events: auto;
        user-select: none;
        min-width: 200px;
        max-width: min(320px, calc(100vw - 20px));
        max-height: calc(100vh - 20px);
        overflow: auto;
        box-sizing: border-box;
      }

      .info-panel__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }

      .info-panel__title {
        font-weight: bold;
      }

      .info-panel__body {
        margin-top: 8px;
        border-top: 1px solid #00ff00;
        padding-top: 4px;
      }

      .info-panel__hint {
        margin-top: 8px;
        font-size: 10px;
        color: #aaa;
      }

      .badge {
        margin-left: 6px;
        padding: 0 4px;
        border: 1px solid #ffb000;
        border-radius: 2px;
        color: #ffb000;
        font-weight: normal;
      }

      button,
      input,
      select {
        font: inherit;
        color: #e6e6e6;
        background: #111;
        border: 1px solid #666;
        border-radius: 3px;
        user-select: text;
      }

      button {
        cursor: pointer;
        padding: 2px 8px;
        user-select: none;
      }

      button:hover:not(:disabled) {
        background: #2a2a2a;
        border-color: #00ff00;
      }

      button:disabled {
        cursor: default;
        opacity: 0.6;
      }

      button.primary {
        background: #00ff00;
        border-color: #00ff00;
        color: #000;
        font-weight: bold;
      }

      button.primary:hover:not(:disabled) {
        background: #7dff7d;
        border-color: #7dff7d;
      }

      button:focus-visible,
      input:focus-visible,
      select:focus-visible,
      summary:focus-visible {
        outline: 2px solid #00ff00;
        outline-offset: 2px;
      }

      input[type='text'],
      input[type='password'],
      input[type='number'],
      select {
        width: 100%;
        box-sizing: border-box;
        padding: 2px 4px;
      }

      input[type='checkbox'] {
        width: 16px;
        height: 16px;
        margin: 0;
        accent-color: #00ff00;
      }

      input:invalid {
        border-color: #ff6b6b;
      }

      .section {
        margin-top: 8px;
        border-top: 1px solid #335533;
        padding-top: 6px;
      }

      details {
        margin-top: 6px;
      }

      summary {
        cursor: pointer;
        font-weight: bold;
      }

      .field {
        margin-top: 6px;
      }

      .field label {
        color: #e6e6e6;
      }

      .field--switch {
        display: grid;
        grid-template-columns: 1fr auto;
        align-items: center;
        column-gap: 8px;
      }

      .field--switch .field__help {
        grid-column: 1 / -1;
      }

      .field--stacked label {
        display: block;
      }

      .field__help {
        color: #aaa;
        font-size: 11px;
        line-height: 1.4;
      }

      .tag {
        margin-left: 6px;
        color: #aaa;
        font-size: 10px;
      }

      .actions {
        display: flex;
        gap: 8px;
        margin-top: 10px;
      }

      .status {
        margin-top: 6px;
        color: #e6e6e6;
        min-height: 1.6em;
      }

      .status--error {
        color: #ff6b6b;
      }
    `
