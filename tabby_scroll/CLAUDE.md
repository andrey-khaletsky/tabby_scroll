# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Tabby terminal plugin (`tabby-scroll`) that prevents accidental scroll-up during Claude Code sessions. When terminal output is streaming (e.g., Claude Code generating code), an inadvertent mouse wheel or trackpad gesture can scroll the viewport away from the latest output. This plugin detects and suppresses unintended scroll-up events while allowing intentional scrolling.

## Architecture

This is a **Tabby plugin** — an Angular NgModule loaded by the Tabby Electron-based terminal app. Key architectural points:

- **Runtime**: Electron + Angular + xterm.js (Tabby's terminal renderer)
- **Entry point**: `src/index.ts` exports a default `@NgModule` class
- **Core hook**: A `TerminalDecorator` subclass that attaches to each terminal tab and intercepts scroll events via `terminal.frontend.mouseEvent$`
- **Build system**: Webpack producing a UMD bundle at `dist/index.js`
- **Plugin discovery**: npm `keywords` array must include `"tabby-plugin"`

### Key Tabby APIs

| Import source | What it provides |
|---|---|
| `tabby-core` | `ConfigProvider`, `HotkeyProvider`, base services |
| `tabby-terminal` | `TerminalDecorator`, `BaseTerminalTabComponent`, `Frontend` |

**TerminalDecorator** lifecycle:
- `attach(terminal)` — subscribe to terminal events (scroll, content updates, alternate screen)
- `detach(terminal)` — cleanup (use `subscribeUntilDetached` for auto-cleanup)

**Frontend observables relevant to scroll control:**
- `mouseEvent$` — all mouse events including wheel; intercept here to suppress scroll
- `contentUpdated$` — fires when new output arrives (detect streaming)
- `alternateScreenActive$` — true when apps like vim/less own the screen (disable plugin in this mode)
- `scrollToBottom()`, `scrollLines(n)`, `scrollPages(n)` — programmatic scroll control

### Webpack externals

The webpack config **must** externalize: `@angular/*`, `rxjs`, `tabby-*`, `@ng-bootstrap/*`, `ngx-toastr`, `fs`. These are provided by the Tabby host app at runtime.

## Build & Development Commands

```bash
npm install          # install dependencies
npm run build        # webpack production build → dist/index.js
npm run watch        # continuous rebuild during development
```

### Local testing with Tabby

```bash
# Link plugin for local development:
cd dist && npm link
# Then from Tabby's install directory:
npm link tabby-scroll

# Or launch Tabby with the plugin path directly:
TABBY_PLUGINS=/path/to/tabby_scroll tabby --debug
```

### Publishing

Publish to npm. Tabby's built-in Plugin Manager discovers packages with the `"tabby-plugin"` keyword.

## Design Decisions

- Scroll suppression should only activate when output is actively streaming (content updates arriving rapidly). Intentional scroll-up when the terminal is idle must not be blocked.
- When xterm.js alternate screen is active (vim, less, etc.), the plugin should stay out of the way entirely.
- Provide a configurable hotkey or toggle so users can temporarily disable scroll lock.
- Expose settings via `ConfigProvider` for tuning sensitivity (e.g., debounce threshold for "actively streaming" detection).
