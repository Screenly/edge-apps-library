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
