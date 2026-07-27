# @screenly/edge-apps

[![npm version](https://img.shields.io/npm/v/%40screenly%2Fedge-apps)](https://www.npmjs.com/package/@screenly/edge-apps)

A TypeScript library for interfacing with the Screenly Edge Apps API.

## Installation

> [!NOTE]
> Requires Node.js >= 20.6.0.

```bash
npm install @screenly/edge-apps
```

Or with Bun:

```bash
bun add @screenly/edge-apps
```

## Creating a New Edge App

Scaffold a new Edge App without installing anything first:

```bash
npx @screenly/edge-apps create my-edge-app
```

Or with Bun:

```bash
bunx @screenly/edge-apps create my-edge-app
```

The package manager used to invoke the command is detected automatically, so
the generated `package.json` scripts are wired up to match (`npm run ...` vs.
`bun run ...`). This generates a minimal Edge App with a `screenly.yml`
manifest, `index.html`, and a `src/main.ts` entry point wired up to this
library.

Pass options after the directory name, for example:

```bash
npx @screenly/edge-apps create my-edge-app --description "My Edge App" --author "Jane Doe"
```

| Option                 | Description                                                         |
| ---------------------- | ------------------------------------------------------------------- |
| `--description <text>` | Description used in `package.json`, `screenly.yml`, and `README.md` |
| `--author <text>`      | Author name added to `package.json`                                 |
| `--pm <npm\|bun>`      | Force a package manager instead of auto-detecting it                |
| `--force`              | Write into an existing, non-empty directory                         |
| `--skip-install`       | Skip installing dependencies after scaffolding                      |

> [!NOTE]
> Running `edge-apps-scripts create` with no directory argument instead
> replaces `{{APP_NAME}}`-style placeholders in the current project — this is
> used by Edge App template repositories after cloning, and is unrelated to
> scaffolding a brand new app.

No test files are included — `test`/`test:unit` work out of the box on an
empty suite; add your own under `src/` when you have something to test.

### Local Development Setup

When developing Edge Apps locally using the library from this repository, you should link the package.

First, in the root of this repository:

```bash
npm install
npm run build
npm link
```

Then in your Edge App directory:

```bash
cd /path/to/your-edge-app
npm link @screenly/edge-apps
```

To unlink the package when you're done with local development, run the following in your Edge App directory:

```bash
npm install
```

## Quick Start

```typescript
import { setupTheme, signalReady, getMetadata } from '@screenly/edge-apps'

setupTheme()
const metadata = getMetadata()
signalReady()
```

## Core Functions

### Theme & Branding

- `setupTheme()` - Apply theme colors to CSS custom properties
- `setupBrandingLogo()` - Fetch and process branding logo
- `setupBranding()` - Setup complete branding (colors and logo)

### Settings

- `getSettings()` - Get all settings
- `getSetting<T>(key)` - Get specific setting with type safety
- `getSettingWithDefault<T>(key, default)` - Get setting with fallback
- `signalReady()` - Signal app is ready for display

### Metadata

- `getMetadata()` - Get all screen metadata
- `getScreenName()`
- `getHostname()`
- `getLocation()`
- `getScreenlyVersion()`
- `getTags()`
- `hasTag(tag)`
- `getFormattedCoordinates()`
- `getHardware()` - Get hardware type as `Hardware` enum (`Anywhere`, `RaspberryPi`, or `ScreenlyPlayerMax`)

### Location & Localization

- `getTimeZone()` - Get timezone from GPS coordinates
- `getLocale()` - Get locale from location
- `formatCoordinates(coords)` - Format coordinates as string
- `formatLocalizedDate(date, locale)` - Format date for locale
- `formatTime(date, locale, timezone)` - Format time for locale
- `getLocalizedDayNames(locale)` - Get day names for locale
- `getLocalizedMonthNames(locale)` - Get month names for locale
- `detectHourFormat(locale)` - Detect 12h/24h format for locale

### UTM Tracking

- `addUTMParams(url, params?)` - Add UTM parameters to URL
- `addUTMParamsIf(url, enabled, params?)` - Conditionally add UTM parameters

### Error Reporting (Sentry)

- `setupSentry(app, contexts?)` - Initialize Sentry using the `sentry_dsn` setting; sets the `edge_app` tag, hostname, and any additional contexts. No-ops if `sentry_dsn` is not configured.
- `scrubSensitiveData(event)` - Sentry `beforeSend` hook that redacts values of settings keys matching `token`, `secret`, `password`, or `credential` with `[REDACTED]`. Drops the event if it cannot be safely serialized.
- `reportError(error, context?)` - Capture an exception via Sentry with optional extra context.

## Web Components

This library includes reusable web components for building consistent Edge Apps. See the [components documentation](https://github.com/Screenly/edge-apps-library/blob/main/docs/components.md) for usage details.

## Styling with Tailwind CSS

Edge Apps scaffolded with `create` come with [Tailwind CSS](https://tailwindcss.com/) enabled out of the box via `@tailwindcss/vite` — no extra install or config file needed. Just add the import to your app's stylesheet:

```css
@layer theme, base, utilities;

@import 'tailwindcss/theme.css' layer(theme);
@import '@screenly/edge-apps/styles' layer(base);
@import 'tailwindcss/utilities.css' layer(utilities);
```

> [!IMPORTANT]
> Declare the layer order up front with `@layer theme, base, utilities;`, and import `@screenly/edge-apps/styles` (and any other unlayered base CSS) into the `base` layer. Per the CSS Cascade Layers spec, unlayered CSS always beats layered CSS regardless of selector specificity — so without this, `@screenly/edge-apps/styles`'s base rules (e.g. its `user-select: none` reset) would silently override Tailwind utility classes.

Then use utility classes directly in your markup instead of writing custom CSS:

```html
<main class="flex h-full w-full items-center justify-center">
  <h1 class="text-6xl portrait:text-4xl">Hello, Screenly!</h1>
</main>
```

> [!IMPORTANT]
> Inside `<auto-scaler>`, use `h-full`/`w-full` instead of `h-screen`/`w-screen`. `<auto-scaler>` renders its content into a fixed-size box (the `reference-width`/`reference-height` you pass it) and scales that box to fit the real viewport with a CSS transform. Viewport-relative utilities (`h-screen`, `w-screen`, or arbitrary `vh`/`vw` values) measure the real viewport, not the scaled box, so they won't line up with the rest of your layout. The `portrait:`/`landscape:` variants are unaffected since they're based on device orientation, which `<auto-scaler>` uses the same way.

> [!WARNING]
> Avoid `@import 'tailwindcss';` (the full package) in an Edge App. It includes Preflight, which resets `border`, `margin`, and `padding` to `0` on every element via a universal selector — including custom-element hosts. Components like `<app-header>` style themselves through `:host` in their own shadow DOM (border, padding, etc.), and Preflight's reset silently overrides that styling from outside, since the host tag itself is a normal element in your page's light DOM. Import `tailwindcss/theme.css` and `tailwindcss/utilities.css` directly instead, as shown above, to get Tailwind's utility classes without Preflight.

## Edge Apps Scripts CLI

This package provides the `edge-apps-scripts` CLI tool for running shared development commands across all Edge Apps. It includes centralized ESLint configuration to avoid duplication.

### Available Commands

#### Development Server

Start the Vite development server with mock data from `screenly.yml` and `mock-data.yml`:

```bash
npm run dev
```

#### Building

```bash
npm run build
```

#### Linting

To lint your Edge App:

```bash
npm run lint
```

To lint and automatically fix issues:

```bash
npm run lint -- --fix
```

#### Type Checking

Run TypeScript type checking:

```bash
npm run type-check
```

### Command-Line Utilities for Edge Apps

- This library provides utilities to help with common Edge App tasks.
- The CLI uses the shared ESLint configuration from `@screenly/edge-apps`, so you don't need to maintain your own `eslint.config.ts`
- The build commands assume your Edge App has `index.html` as the entry point
- Build output will be generated in the `dist/` directory

It is recommended to add the following scripts to your Edge App's `package.json`:

```json
{
  "scripts": {
    "dev": "edge-apps-scripts dev",
    "build": "edge-apps-scripts build",
    "build:dev": "edge-apps-scripts build:dev",
    "lint": "edge-apps-scripts lint",
    "type-check": "edge-apps-scripts type-check",
    "deploy": "npm run build && screenly edge-app deploy --path=dist/"
  }
}
```

> [!NOTE]
> Feel free to customize the scripts as needed for your Edge App. You could also define your own configs like `eslint.config.ts`, `tsconfig.json`, or `vite.config.ts` if you need more control.

## Testing

```typescript
import { setupScreenlyMock, resetScreenlyMock } from '@screenly/edge-apps/test'

beforeEach(() => {
  setupScreenlyMock({ screen_name: 'Test Screen' }, { theme: 'dark' })
})

afterEach(() => {
  resetScreenlyMock()
})
```

## Types

```typescript
import type {
  Hardware,
  ScreenlyMetadata,
  ScreenlySettings,
  ScreenlyObject,
  ThemeColors,
  BrandingConfig,
  UTMParams,
} from '@screenly/edge-apps'
```

## Development

```bash
npm install      # Install dependencies
npm test         # Run tests
npm run build    # Build library
```
