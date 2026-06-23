import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'node:child_process'
import { worktreeSwitcher } from './tools/vite-plugins/worktree-switcher'

// Resolve current branch + short commit hash once at config load.
// Used only in dev to render "<branch>@<hash>" in the build badge
// instead of fetching public/version.json (which only makes sense
// for the statically-served GitHub Pages deploy).
const gitBranch = (() => {
  try {
    // eslint-disable-next-line sonarjs/no-os-command-from-path
    return execSync('git rev-parse --abbrev-ref HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return ''
  }
})()

const gitCommit = (() => {
  try {
    // eslint-disable-next-line sonarjs/no-os-command-from-path
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return ''
  }
})()

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  base: '/elszamolos/',
  define: {
    __BUILD_DATE__: JSON.stringify(process.env.VITE_BUILD_DATE || new Date().toISOString()),
    __APP_VERSION__: JSON.stringify(process.env.VITE_APP_VERSION || '0.0.0'),
    // Populated only when running `vite` (dev server). In `vite build`
    // these resolve to empty strings, so production output never
    // references the working tree.
    __GIT_BRANCH__: JSON.stringify(command === 'serve' ? gitBranch : ''),
    __GIT_COMMIT__: JSON.stringify(command === 'serve' ? gitCommit : '')
  },
  plugins: [
    react(),
    // `worktreeSwitcher` is `apply: 'serve'` — inert during
    // `vite build`. In dev it spawns one Vite server per
    // sibling worktree, proxies `/elszamolos/worktrees/<name>/`
    // to each, and injects a JSON data island into index.html
    // so <WorktreeSwitcher /> can render the dropdown without a
    // server roundtrip. See the plugin file for details.
    worktreeSwitcher(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['teeth/*.svg', 'bite.svg'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}']
      },
      devOptions: {
        enabled: false
      },
      manifest: {
        name: 'DentalRaktar Accounting',
        short_name: 'DentalRaktar',
        description: 'DentalRaktar',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'vite.svg',
            sizes: '192x192',
            type: 'image/svg+xml'
          },
          {
            src: 'vite.svg',
            sizes: '512x512',
            type: 'image/svg+xml'
          }
        ]
      }
    })
  ],
  build: {
    // Ensure source maps are disabled for production builds
    sourcemap: false
  },
  server: {
    host: true
  }
}))
