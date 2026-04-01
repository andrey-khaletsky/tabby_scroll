import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { TabbyCoreModule, ConfigProvider, HotkeyProvider, HotkeysService, ConfigService } from 'tabby-core'
import { TerminalDecorator } from 'tabby-terminal'
import { ScrollGuardDecorator } from './scroll-guard.decorator'
import { ScrollGuardConfigProvider } from './scroll-guard.config'
import { ScrollGuardHotkeyProvider } from './scroll-guard.hotkey'

@NgModule({
  imports: [CommonModule, TabbyCoreModule],
  providers: [
    { provide: TerminalDecorator, useClass: ScrollGuardDecorator, multi: true },
    { provide: ConfigProvider, useClass: ScrollGuardConfigProvider, multi: true },
    { provide: HotkeyProvider, useClass: ScrollGuardHotkeyProvider, multi: true },
  ],
})
export default class ScrollGuardModule {
  constructor(
    hotkeys: HotkeysService,
    config: ConfigService,
  ) {
    hotkeys.hotkey$.subscribe(hotkey => {
      if (hotkey === 'scroll-guard-toggle') {
        const store = config.store.scrollGuard
        store.enabled = !store.enabled
        config.save()
      }
    })
  }
}
