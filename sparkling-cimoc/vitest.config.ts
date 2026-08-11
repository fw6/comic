// Copyright (c) 2025 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineConfig, mergeConfig } from 'vitest/config'
import { createVitestConfig } from '@lynx-js/react/testing-library/vitest-config'

const defaultConfig = await createVitestConfig()
const config = defineConfig({
  resolve: {
    alias: {
      // jotai 等依赖直接 import 'react'，测试环境需指向 Lynx 的 React 实现
      react: '@lynx-js/react',
      'react/jsx-runtime': '@lynx-js/react/jsx-runtime',
    },
  },
  test: {
    server: {
      deps: {
        // jotai 直接 import 'react'，需内联让 Vite 的 alias 生效（指向 Lynx React）
        inline: ['jotai'],
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'lcov', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'vitest.config.ts',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData/**',
        '**/tests/**'
      ]
    }
  },
})

export default mergeConfig(defaultConfig, config)
