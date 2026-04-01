import { Injectable } from '@angular/core'
import { ConfigProvider } from 'tabby-core'

@Injectable()
export class ScrollGuardConfigProvider extends ConfigProvider {
  defaults = {
    scrollGuard: {
      enabled: true,
      cooldownMs: 2000,
      snapToBottom: true,
      snapOnOutput: true,
      debug: false,
    },
  }

  platformDefaults = {}
}
