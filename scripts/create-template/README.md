# {{APP_TITLE}}

{{APP_DESCRIPTION}}

## Getting Started

Install dependencies:

```bash
{{PM_INSTALL}}
```

## Development

```bash
{{PM_RUN}} dev
```

Styling uses [Tailwind CSS](https://tailwindcss.com/) utility classes, enabled via the `tailwindcss/theme.css` and `tailwindcss/utilities.css` imports in `src/style.css`. Inside `<auto-scaler>`, use `h-full`/`w-full` rather than `h-screen`/`w-screen` — see the [`@screenly/edge-apps` README](https://github.com/Screenly/edge-apps-library#styling-with-tailwind-css) for details.

## Build

```bash
{{PM_RUN}} build
```

## Deployment

```bash
screenly edge-app create --name {{APP_NAME}} --in-place
{{PM_RUN}} deploy
screenly edge-app instance create
```

## Configuration

| Setting   | Description                     | Required | Default            |
| --------- | ------------------------------- | -------- | ------------------ |
| `message` | The message displayed on screen | No       | `Hello, Screenly!` |

## Screenshots

```bash
{{PM_RUN}} screenshots
```
