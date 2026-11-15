# Edge Apps Web Components

Reusable web components for building consistent Edge Apps.

## Component Structure

Each component is organized in its own directory with a single TypeScript file containing all logic, templates, and styles:

```text
components/
  brand-logo/
    brand-logo.ts      # Complete component (TypeScript + HTML template + CSS)
  app-header/
    app-header.ts      # Complete component (TypeScript + HTML template + CSS)
  auto-scaler/
    auto-scaler.ts     # Complete component (TypeScript + CSS)
  dev-tools/
    dev-tools.ts         # Component; styles in dev-tools.styles.ts
    dev-server-panel.ts  # Ready signal, network simulator, settings form
    settings-form.ts     # Form helpers and the dev server API client
```

Each component file contains:

- **TypeScript class** extending `HTMLElement`
- **HTML template** as a template literal
- **CSS styles** as a template literal within `<style>` tags
- **Shadow DOM** created in the constructor for encapsulation

This single-file approach simplifies maintenance and follows web component best practices.

## Available Components

### `<brand-logo>`

Displays the branding logo from Screenly settings with fallback to screen name.

**Usage:**

```html
<brand-logo></brand-logo>
```

**Attributes:**

- `show-name` (optional): Show screen name alongside logo (default: false)
- `fallback-to-name` (optional): Show screen name if logo unavailable (default: true)
- `max-width` (optional): Maximum width for logo (default: "120px")
- `max-height` (optional): Maximum height for logo (default: "32px")

**Examples:**

```html
<!-- Basic usage -->
<brand-logo></brand-logo>

<!-- Show name alongside logo -->
<brand-logo show-name></brand-logo>

<!-- Custom size -->
<brand-logo max-width="200px" max-height="48px"></brand-logo>

<!-- No fallback to name -->
<brand-logo fallback-to-name="false"></brand-logo>
```

### `<app-header>`

A flexible header component with branding and time display.

**Usage:**

```html
<app-header></app-header>
```

**Attributes:**

- `show-logo` (optional): Show brand logo (default: true)
- `show-time` (optional): Show time display (default: true)
- `show-date` (optional): Show date display (default: false)
- `time-format` (optional): Time format - "12h" or "24h" (default: auto-detect)

**Examples:**

```html
<!-- Basic usage -->
<app-header></app-header>

<!-- With date -->
<app-header show-date></app-header>

<!-- 24-hour format -->
<app-header time-format="24h"></app-header>

<!-- Logo only -->
<app-header show-time="false" show-date="false"></app-header>
```

### `<edge-app-devtools>`

A development overlay with the viewport size, reference resolution, `<auto-scaler>` scale and orientation. Press `D` to show or hide it (ignored while typing in a field). In production builds it stays hidden.

```html
<edge-app-devtools
  reference-width="1920"
  reference-height="1080"
></edge-app-devtools>
```

Attributes:

- `reference-width`, `reference-height` (optional): the resolution `<auto-scaler>` scales from (default: 1920 × 1080)
- `dev-server` (optional): turns on the dev server features below. The dev server sets it; don't add it yourself.

#### Dev server features

`npm run dev` adds `<edge-app-devtools>` to every page it serves, so apps need no markup. If the page already has one, the dev server reuses it. The element it adds starts collapsed to its title bar; the open or closed state lasts for the browser tab. Builds never include it.

With the dev server, the panel also shows:

- Ready signal: whether the app called `signalReady()` and how many milliseconds after page load. Apps with `ready_signal: true` in `screenly.yml` should reach this.
- Network: `Offline` makes cross-origin `fetch` calls reject with a `TypeError` and sets `navigator.onLine` to false, for testing cache fallbacks. `Hang` keeps them pending until their `AbortSignal` fires, for testing timeouts and abort handling. Requests to the dev server and the app's own files still work. The mode lasts for the browser tab and changing it reloads the page. `XMLHttpRequest` isn't covered.
- Settings: a form built from the `settings` in `screenly.yml`. `select` settings get a dropdown, `boolean` a switch, `secret` a masked field and everything else a text field, ordered by `display_order`. Settings marked `advanced` sit in a collapsed group. Screen metadata (screen name, location, coordinates and tags) has its own group.

"Save and reload" writes the values to `mock-data.yml`, keeping its comments and other keys, and the dev server reloads the page. Apps read settings at start-up, so a reload applies them the way a device would. The change survives dev server restarts; edit or delete `mock-data.yml` to undo it.

#### Dev server API

The panel uses two endpoints that exist only while `npm run dev` runs.

`GET /__screenly/config` returns:

```json
{
  "ready_signal": true,
  "settings": [
    {
      "key": "state",
      "title": "State",
      "type": "string",
      "input": "select",
      "default_value": "all",
      "optional": true,
      "is_global": false,
      "help_text": "Show the level for one state or territory.",
      "options": [{ "label": "Ohio", "value": "Ohio" }],
      "advanced": false,
      "display_order": 1
    }
  ],
  "values": { "state": "Ohio" },
  "metadata": {
    "location": "Los Angeles, USA",
    "coordinates": [34.05, -118.24],
    "tags": ["All Screens"]
  }
}
```

`type` is the manifest type (`string` or `secret`) and `input` the editor type from `help_text.properties.type`. `values` holds what the app gets as `screenly.settings`: manifest defaults with `mock-data.yml` on top, always as strings. A blank value in `mock-data.yml` reaches the app as `''`, not `null`.

`POST /__screenly/config` takes `{ "settings": { ... }, "metadata": { ... } }`, merges it into `mock-data.yml` and returns the same shape as `GET`. Only settings declared in `screenly.yml` are accepted, as strings. Metadata accepts `screen_name`, `hostname`, `location`, `coordinates` (`[latitude, longitude]`) and `tags`. Anything else gets a 400. The request must be JSON from the dev server's own origin, otherwise it gets a 403.

The dev server's `screenly.js` records the ready signal on `window.__screenlyDevServer` (`readyAt`, `readyCalls`, `network`) and dispatches a `screenly:ready` event on `window` the first time the app calls it.

## Component Guidelines

When creating new components:

1. **Use Web Components API** - Native custom elements for framework-agnostic usage
2. **TypeScript** - Full type safety
3. **Attributes for Configuration** - Use attributes for simple config, properties for complex
4. **Slots for Content** - Use slots for flexible content insertion
5. **CSS Custom Properties** - Allow styling via CSS variables
6. **Accessibility** - Include proper ARIA attributes and semantic HTML
7. **Documentation** - Include JSDoc comments and usage examples

## Example Component Structure

```typescript
export class MyComponent extends HTMLElement {
  static get observedAttributes() {
    return ['attr1', 'attr2']
  }

  connectedCallback() {
    this.render()
  }

  attributeChangedCallback() {
    this.render()
  }

  private render() {
    // Component rendering logic
  }
}

if (typeof window !== 'undefined' && !customElements.get('my-component')) {
  customElements.define('my-component', MyComponent)
}
```
