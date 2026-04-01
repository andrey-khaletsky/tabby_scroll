import { Injectable } from '@angular/core'
import { HotkeyProvider, HotkeyDescription } from 'tabby-core'

@Injectable()
export class ScrollGuardHotkeyProvider extends HotkeyProvider {
  hotkeys: HotkeyDescription[] = [
    {
      id: 'scroll-guard-toggle',
      name: 'Toggle Scroll Guard',
    },
  ]

  async provide(): Promise<HotkeyDescription[]> {
    return this.hotkeys
  }
}
