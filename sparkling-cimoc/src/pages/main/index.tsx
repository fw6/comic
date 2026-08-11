import { root } from '@lynx-js/react'

import { App } from '../../cimoc/App.js'

root.render(<App />)

if (import.meta.webpackHot) {
  import.meta.webpackHot.accept()
}
