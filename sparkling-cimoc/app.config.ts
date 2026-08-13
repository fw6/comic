// @ts-nocheck
import { defineConfig } from '@lynx-js/rspeedy'
import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin'
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'
import type { AppConfig } from 'sparkling-app-cli'

const lynxConfig = defineConfig({
  source: {
    entry: {
      main: './src/pages/main/index.tsx',
      search: './src/pages/search/index.tsx',
      result: './src/pages/result/index.tsx',
      detail: './src/pages/detail/index.tsx',
      reader: './src/pages/reader/index.tsx',
      settings: './src/pages/settings/index.tsx',
      about: './src/pages/about/index.tsx',
      backup: './src/pages/backup/index.tsx',
      chapters: './src/pages/chapters/index.tsx',
      readerConfig: './src/pages/readerConfig/index.tsx',
      sourceDetail: './src/pages/sourceDetail/index.tsx',
      category: './src/pages/category/index.tsx',
      tagEditor: './src/pages/tagEditor/index.tsx',
      eventSettings: './src/pages/eventSettings/index.tsx',
      task: './src/pages/task/index.tsx',
    },
  },
  output: {
    assetPrefix: 'asset:///',
    filename: {
      bundle: '[name].lynx.bundle'
    },
  },
  plugins: [
    pluginQRCode({
      schema(url: string): string {
        // We use `?fullscreen=true` to open the page in LynxExplorer in full screen mode
        return `${url}?fullscreen=true`
      },
    }),
    pluginReactLynx(),
  ],
})

const config: AppConfig = {
  lynxConfig,
  dev: {
    server: {
      port: 5969,
    },
  },
  devtool: true,
  appName: 'sparkling-cimoc',
  platform: {
    android: {
      packageName: 'com.example.sparkling.go',
    },
    ios: {
      bundleIdentifier: 'com.example.sparkling.go',
    },
  },
  paths: {
    androidAssets: 'android/app/src/main/assets',
    iosAssets: 'ios/LynxResources',
  },
  appIcon: './resource/app_icon.png',
  router: {
    main: {
      path: './lynxPages/main',
    },
    search: {
      path: './lynxPages/search',
    },
    result: {
      path: './lynxPages/result',
    },
    detail: {
      path: './lynxPages/detail',
    },
    reader: {
      path: './lynxPages/reader',
    },
    settings: {
      path: './lynxPages/settings',
    },
    about: {
      path: './lynxPages/about',
    },
    backup: {
      path: './lynxPages/backup',
    },
    chapters: {
      path: './lynxPages/chapters',
    },
    readerConfig: {
      path: './lynxPages/readerConfig',
    },
    sourceDetail: {
      path: './lynxPages/sourceDetail',
    },
    category: {
      path: './lynxPages/category',
    },
    tagEditor: {
      path: './lynxPages/tagEditor',
    },
    eventSettings: {
      path: './lynxPages/eventSettings',
    },
    task: {
      path: './lynxPages/task',
    },
  },
  plugin: [
    [
      'splash-screen',
      {
        backgroundColor: '#232323',
        image: './resource/app_icon.png',
        dark: {
          image: './resource/app_icon.png',
          backgroundColor: '#000000',
        },
        imageWidth: 200,
      },
    ],
  ],
};

export default config
