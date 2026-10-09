# VERA frontend

React, TypeScript, Vite, Tailwind CSS v4, and shadcn/ui (Radix Nova style,
preset `b2BWi3afQ`). VERA keeps a custom dark navigation bar.

## Getting started

From the repository root:

```sh
make frontend-install
make frontend-env
make dev-frontend
```

Set `VITE_API_MODE=mock` for local MSW-backed development or `live` to use the API proxy. Vite environment values are public browser configuration; never place secrets in `VITE_*` variables.

The initial app shell is deliberately small. Add shadcn components with `bunx shadcn add <component>`.
