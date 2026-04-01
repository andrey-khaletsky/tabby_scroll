# tabby-scroll-guard

A [Tabby](https://tabby.sh) plugin that prevents accidental scroll-up while terminal output is actively streaming (e.g., during Claude Code sessions).

When rapid output is flowing, an inadvertent mouse wheel or trackpad gesture can scroll the viewport away from the latest output. This plugin detects streaming and suppresses unintended scroll-up events, then automatically snaps back to the bottom.

## Features

- Blocks upward scroll only during active output streaming
- Allows normal scrolling when the terminal is idle
- Auto-snaps viewport to bottom if it drifts during streaming
- Disables itself when alternate screen is active (vim, less, etc.)
- Configurable cooldown threshold and toggle hotkey

## Install

### From npm

Search for `tabby-scroll-guard` in Tabby's Plugin Manager (Settings > Plugins).

### Manual

```bash
git clone https://github.com/andrey-khaletsky/tabby_scroll.git
cd tabby_scroll
npm install
npm run build
npm run deploy
# Restart Tabby
```

## Configuration

Available in Tabby's config (`~/.config/tabby/config.yaml`):

| Setting | Default | Description |
|---|---|---|
| `scrollGuard.enabled` | `true` | Enable/disable the plugin |
| `scrollGuard.cooldownMs` | `2000` | Ms after last output before scroll-up is allowed again |
| `scrollGuard.snapToBottom` | `true` | Snap to bottom when a blocked scroll-up is detected |
| `scrollGuard.snapOnOutput` | `true` | Snap to bottom if viewport drifts during streaming |
| `scrollGuard.debug` | `false` | Log scroll events to DevTools console |

A toggle hotkey (`scroll-guard-toggle`) can be bound in Settings > Hotkeys.

## License

MIT
