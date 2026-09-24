import { describe, expect, it } from 'vitest'
import capacitorConfig from '../capacitor.config.json'
import packageJson from '../package.json'
import androidManifest from '../android/app/src/main/AndroidManifest.xml?raw'
import androidGitignore from '../android/.gitignore?raw'
import indexHtml from '../index.html?raw'
import appSource from './App.tsx?raw'
import pickerSource from './photoChecker/PhotoCheckerPanel.tsx?raw'
import { installedQuizVisualAssets } from './domain/personalColor/quizVisuals'
import { styleExampleAssets } from './domain/personalColor/styleExampleAssets'

// V1.2 Slice 8: release-candidate guards for the Android (Capacitor) wrapper and the shipped asset set.
// The web app and the Android app are one codebase and one dist.

describe('the shipped asset set', () => {
  // Vite copies public/ into dist wholesale, so public/ must hold exactly what the app references.
  const publicFiles = Object.keys(import.meta.glob('../public/**/*')).map((path) => path.replace('../public', '')).sort()
  const referenced = [
    '/favicon.svg',
    '/color-draping.png',
    '/img/presentation/women.webp',
    '/img/presentation/men.webp',
    ...Object.values(installedQuizVisualAssets),
    ...Object.values(styleExampleAssets).flatMap((set) => Object.values(set)),
  ]

  it('public/ contains only referenced production assets: no intermediates, photos or fixtures', () => {
    expect(publicFiles).toEqual([...new Set(referenced)].sort())
    expect(publicFiles.filter((path) => /both\.png$/.test(path))).toEqual([])
  })

  it('the literal public paths used by the shell and App are real files', () => {
    expect(indexHtml).toContain('href="/favicon.svg"')
    for (const path of ['/color-draping.png', '/img/presentation/women.webp', '/img/presentation/men.webp']) expect(appSource).toMatch(new RegExp(`['"]${path}['"]`))
  })
})

describe('Capacitor wrapper', () => {
  it('packages the same Vite dist under the product name', () => {
    expect(capacitorConfig).toEqual({ appId: 'io.github.patipankong.personalcolorpocket', appName: 'Personal Color Pocket', webDir: 'dist' })
  })

  it('adds only the three official Capacitor packages, and no plugin', () => {
    const all = { ...packageJson.dependencies, ...packageJson.devDependencies }
    expect(Object.keys(all).filter((name) => name.startsWith('@capacitor/')).sort()).toEqual(['@capacitor/android', '@capacitor/cli', '@capacitor/core'])
    expect(Object.keys(packageJson.devDependencies)).toContain('@capacitor/cli')
  })

  it('app code never imports Capacitor: no plugin or native bridge ever receives a photo', () => {
    const sources = import.meta.glob(['./**/*.{ts,tsx}', '!./**/*.test.{ts,tsx}'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>
    expect(Object.keys(sources).length).toBeGreaterThan(20)
    expect(Object.entries(sources).filter(([, source]) => /@capacitor\//.test(source)).map(([path]) => path)).toEqual([])
  })

  it('declares no permission beyond INTERNET: no camera, media, storage, location, contacts or microphone', () => {
    const permissions = [...androidManifest.matchAll(/<uses-permission[^>]*android:name="([^"]+)"/g)].map((match) => match[1])
    expect(permissions).toEqual(['android.permission.INTERNET'])
    expect(androidManifest).not.toMatch(/CAMERA|READ_MEDIA|EXTERNAL_STORAGE|MANAGE_|LOCATION|CONTACTS|RECORD_AUDIO/)
  })

  it('the photo input opens the system picker, never camera capture (which would ask for CAMERA)', () => {
    expect(pickerSource).toContain('<input type="file" accept="image/*"')
    expect(pickerSource).not.toMatch(/<input[^>]*\bcapture\b/)
  })

  it('synced web assets and build output stay out of git', () => {
    for (const rule of ['build/', 'local.properties', 'app/src/main/assets/public', 'capacitor-cordova-android-plugins']) expect(androidGitignore).toContain(rule)
  })
})

describe('DEV diagnostics', () => {
  it('the panel is gated at compile time, so the production build drops it', () => {
    expect(appSource).toContain('{import.meta.env.DEV && showDiagnostics && <DiagnosticPanel')
    expect(appSource.match(/<DiagnosticPanel /g)).toHaveLength(1)
  })
})
