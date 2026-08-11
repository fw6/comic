import { useEffect } from '@lynx-js/react'
import { root } from '@lynx-js/react'

import { App } from '../../cimoc/App.js'

// Sparkling 原生容器会向入口组件注入 onMounted，用于通知 splash 已可关闭。
function Root(props: { onMounted?: () => void }) {
  useEffect(() => {
    props.onMounted?.()
  }, [props])

  return <App />
}

root.render(<Root />)

if (import.meta.webpackHot) {
  import.meta.webpackHot.accept()
}
