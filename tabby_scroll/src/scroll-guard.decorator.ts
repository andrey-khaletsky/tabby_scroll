import { Injectable } from '@angular/core'
import { TerminalDecorator, BaseTerminalTabComponent } from 'tabby-terminal'
import { ConfigService } from 'tabby-core'
import { Subscription } from 'rxjs'

const LOG_PREFIX = '[ScrollGuard]'

/**
 * Intercepts wheel events on terminal tabs and suppresses upward scrolling
 * while terminal output is actively streaming.
 *
 * Streaming detection uses multiple signals:
 * - contentUpdated$ from xterm frontend (render-level)
 * - session output$ data events (byte-level, fires even when renders are batched)
 *
 * A "streaming session" starts when rapid output is detected and ends after
 * a configurable cooldown with no new output.
 */
@Injectable()
export class ScrollGuardDecorator extends TerminalDecorator {
  private terminalStates = new Map<BaseTerminalTabComponent, TerminalState>()

  constructor(private config: ConfigService) {
    super()
  }

  private cfg() {
    return this.config.store.scrollGuard || {}
  }

  private log(...args: any[]) {
    if (this.cfg().debug) {
      console.log(LOG_PREFIX, ...args)
    }
  }

  attach(terminal: BaseTerminalTabComponent): void {
    const state = new TerminalState()
    this.terminalStates.set(terminal, state)

    this.log('attach() called, terminal title:', terminal.title)

    // Track content updates (render-level signal)
    const subscribeFrontend = () => {
      if (!terminal.frontend) {
        return
      }

      // Clean up previous frontend subscriptions in case frontend was recreated
      state.frontendSubs.forEach(s => s?.unsubscribe())
      state.frontendSubs = []

      state.frontendSubs.push(
        terminal.frontend.contentUpdated$.subscribe(() => {
          state.onOutput('contentUpdated')
          this.log('contentUpdated, streaming:', state.isStreaming())
          this.snapIfDrifted(terminal, state)
        })
      )

      state.frontendSubs.push(
        terminal.frontend.alternateScreenActive$.subscribe((active: boolean) => {
          state.alternateScreenActive = active
          this.log('alternateScreenActive:', active)
        })
      )

      this.attachWheelHandler(terminal, state)
    }

    // Track session-level data (byte-level signal — fires even when xterm batches renders)
    if ((terminal as any).session) {
      const session = (terminal as any).session
      if (session.output$) {
        state.lifecycleSubs.push(
          session.output$.subscribe(() => {
            state.onOutput('sessionOutput')
          })
        )
        this.log('subscribed to session.output$')
      }
    }

    // Subscribe now if frontend is ready, and re-subscribe whenever it changes
    if (terminal.frontend) {
      subscribeFrontend()
    }
    state.lifecycleSubs.push(
      terminal.frontendReady$.subscribe(() => {
        this.log('frontendReady$ fired, re-attaching')
        subscribeFrontend()
      })
    )
  }

  private attachWheelHandler(terminal: BaseTerminalTabComponent, state: TerminalState): void {
    // Remove old handler if element changed
    if (state.wheelElement && state.wheelHandler) {
      state.wheelElement.removeEventListener('wheel', state.wheelHandler, { capture: true } as any)
      state.wheelElement = null
      state.wheelHandler = null
    }

    const tryAttach = () => {
      const el = this.findTerminalElement(terminal)

      if (el) {
        const handler = (event: WheelEvent) => this.onWheel(event, terminal, state)
        el.addEventListener('wheel', handler, { capture: true, passive: false })
        state.wheelElement = el
        state.wheelHandler = handler
        this.log('wheel handler attached to', el.tagName, el.className)
      } else {
        this.log('element not found, retrying in 200ms')
        state.retryTimer = setTimeout(tryAttach, 200) as any
      }
    }

    tryAttach()
  }

  private findTerminalElement(terminal: BaseTerminalTabComponent): HTMLElement | null {
    // Try multiple paths to find the xterm DOM element
    const frontend = terminal.frontend as any
    if (!frontend) return null

    // xterm.js v5+ paths
    const candidates = [
      frontend.xtermCore?.element,
      frontend.xterm?.element,
      frontend.xtermCore?.screenElement,
      frontend.xterm?.screenElement,
      // Tabby wraps xterm — try the container
      frontend.element?.nativeElement,
    ]

    for (const el of candidates) {
      if (el instanceof HTMLElement) {
        return el
      }
    }

    // Fallback: the tab's own content element
    if (terminal.content?.nativeElement instanceof HTMLElement) {
      return terminal.content.nativeElement
    }

    return null
  }

  /**
   * If streaming is active and the viewport has drifted away from the bottom
   * (e.g. xterm reflow after Enter), snap back to bottom.
   */
  private snapIfDrifted(terminal: BaseTerminalTabComponent, state: TerminalState): void {
    const cfg = this.cfg()
    if (!cfg.enabled || !cfg.snapOnOutput) return
    if (state.alternateScreenActive) return
    if (!state.isStreaming(cfg.cooldownMs ?? 2000)) return

    // If the user intentionally scrolled up (via wheel) recently, respect that
    if (state.userScrolledUp) return

    if (!this.isAtBottom(terminal)) {
      this.log('viewport drifted from bottom during streaming — snapping back')
      terminal.frontend?.scrollToBottom()
    }
  }

  /**
   * Check whether the terminal viewport is scrolled to the bottom.
   */
  private isAtBottom(terminal: BaseTerminalTabComponent): boolean {
    const frontend = terminal.frontend as any
    if (!frontend) return true

    // xterm.js buffer: viewportY is the current scroll offset, baseY is the max
    const xterm = frontend.xterm || frontend.xtermCore
    if (xterm?.buffer?.active) {
      const buf = xterm.buffer.active
      return buf.viewportY >= buf.baseY
    }

    return true
  }

  private onWheel(event: WheelEvent, terminal: BaseTerminalTabComponent, state: TerminalState): void {
    const cfg = this.cfg()

    if (!cfg.enabled) return
    if (state.alternateScreenActive) return

    // Only suppress upward scroll (deltaY < 0 = scroll up)
    if (event.deltaY >= 0) {
      // User scrolled down — if they've reached the bottom, clear the flag
      if (state.userScrolledUp && this.isAtBottom(terminal)) {
        state.userScrolledUp = false
        this.log('user scrolled back to bottom, clearing userScrolledUp')
      }
      return
    }

    if (!state.isStreaming(cfg.cooldownMs ?? 2000)) {
      this.log('scroll-up ALLOWED (not streaming, idle for',
        Date.now() - state.lastOutputTime, 'ms)')
      state.userScrolledUp = true
      return
    }

    // Streaming is active — suppress the scroll
    event.preventDefault()
    event.stopPropagation()
    this.log('scroll-up BLOCKED (streaming, last output',
      Date.now() - state.lastOutputTime, 'ms ago)')

    if (cfg.snapToBottom) {
      terminal.frontend?.scrollToBottom()
    }
  }

  detach(terminal: BaseTerminalTabComponent): void {
    const state = this.terminalStates.get(terminal)
    if (!state) return

    this.log('detach() called')

    if (state.wheelElement && state.wheelHandler) {
      state.wheelElement.removeEventListener('wheel', state.wheelHandler, { capture: true } as any)
    }
    if (state.retryTimer) {
      clearTimeout(state.retryTimer)
    }
    state.frontendSubs.forEach(s => s?.unsubscribe())
    state.lifecycleSubs.forEach(s => s?.unsubscribe())
    this.terminalStates.delete(terminal)
  }
}

class TerminalState {
  /** Timestamp of the most recent output from any signal */
  lastOutputTime = 0
  /** Number of output events in the current burst */
  outputBurstCount = 0
  /** Timestamp when the current burst started */
  burstStartTime = 0

  alternateScreenActive = false
  /** True when the user intentionally scrolled up (via wheel) while idle */
  userScrolledUp = false
  wheelElement: HTMLElement | null = null
  wheelHandler: ((e: WheelEvent) => void) | null = null
  retryTimer: number | null = null

  frontendSubs: (Subscription | undefined)[] = []
  lifecycleSubs: (Subscription | undefined)[] = []

  /** Called whenever output is detected from any signal source */
  onOutput(source: string): void {
    const now = Date.now()

    // Reset burst counter if there was a long gap (> 3s)
    if (now - this.lastOutputTime > 3000) {
      this.outputBurstCount = 0
      this.burstStartTime = now
      // New streaming burst — clear intentional scroll-up flag
      this.userScrolledUp = false
    }

    this.lastOutputTime = now
    this.outputBurstCount++
  }

  /** Returns true if we believe the terminal is actively streaming output */
  isStreaming(cooldownMs = 2000): boolean {
    const elapsed = Date.now() - this.lastOutputTime

    // Within cooldown window of last output
    if (elapsed < cooldownMs) {
      return true
    }

    return false
  }
}
