import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// V2.0 AI Color Lab (Slice 0, plan §32): static audits that the four hard security
// requirements actually hold in the repository, not just "seem to" by construction. These are
// text/import-graph checks, not a full bundler analysis, but they catch the specific mistakes
// plan §3-4 and §29 warn about.

const ROOT = path.resolve(__dirname, '..', '..')
const KEY_NAMES = ['OPENAI_API_KEY', 'GEMINI_API_KEY', 'GROQ_API_KEY']

function listFiles(dir: string, extensions: string[]): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.kilo' || entry.startsWith('.')) continue
    const full = path.join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) out.push(...listFiles(full, extensions))
    else if (extensions.some((ext) => entry.endsWith(ext))) out.push(full)
  }
  return out
}

const srcFiles = listFiles(path.join(ROOT, 'src'), ['.ts', '.tsx'])
const apiLibFiles = listFiles(path.join(ROOT, 'api', '_lib'), ['.ts'])

describe('AI Color Lab security audit', () => {
  it('no secret env variable is ever referenced with a VITE_ prefix (plan §3: never expose via VITE_*)', () => {
    const offenders: string[] = []
    for (const file of [...srcFiles, ...apiLibFiles, path.join(ROOT, 'vite.config.ts')]) {
      const text = readFileSync(file, 'utf8')
      for (const key of KEY_NAMES) {
        if (text.includes(`VITE_${key}`)) offenders.push(`${file}: VITE_${key}`)
      }
      if (/import\.meta\.env\.VITE_\w*(API_KEY|SECRET|TOKEN)/i.test(text)) offenders.push(`${file}: import.meta.env.VITE_*_KEY pattern`)
    }
    expect(offenders).toEqual([])
  })

  it('no client (src/) file imports from api/_lib, where the real key-reading code lives (plan §29: "feature UI does not import provider SDKs" / credentials)', () => {
    const offenders: string[] = []
    for (const file of srcFiles) {
      const text = readFileSync(file, 'utf8')
      const importPaths = [...text.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((match) => match[1])
      for (const importPath of importPaths) {
        if (importPath.includes('/_lib/') || importPath.includes('api/_lib')) offenders.push(`${file} imports ${importPath}`)
        // Resolves a relative import that reaches into api/_lib from anywhere under src/.
        if (importPath.startsWith('.')) {
          const resolved = path.normalize(path.join(path.dirname(file), importPath))
          if (resolved.includes(`${path.sep}api${path.sep}_lib`)) offenders.push(`${file} imports ${importPath} (resolves into api/_lib)`)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('no src/ file reads process.env directly (all env access is confined to api/_lib/env.ts)', () => {
    const offenders = srcFiles.filter((file) => readFileSync(file, 'utf8').includes('process.env'))
    expect(offenders).toEqual([])
  })

  // V2.0 Slice 0.5C: paletteHandler.ts is a second, equally single, intended entry point --
  // the canonical-palette-selection task's own adapter (providers/geminiPalette.ts) is only ever
  // imported from there, exactly as the four free-form adapters are only ever imported from
  // handler.ts. Two single-entry-point handlers, not a hole in the "only one entry point per
  // adapter" guarantee this test enforces.
  it('provider adapter modules are only imported from their one intended handler entry point', () => {
    const providerFiles = listFiles(path.join(ROOT, 'api', '_lib', 'providers'), ['.ts']).filter((file) => !file.endsWith('.test.ts') && !file.endsWith('shared.ts'))
    const consumers = [...listFiles(path.join(ROOT, 'api'), ['.ts']), ...srcFiles].filter((file) => !file.includes(`${path.sep}providers${path.sep}`) && !file.endsWith('.test.ts'))
    const allowedEntryPoints = [`${path.sep}handler.ts`, `${path.sep}paletteHandler.ts`]
    const offenders: string[] = []
    for (const file of consumers) {
      const text = readFileSync(file, 'utf8')
      for (const providerFile of providerFiles) {
        const name = path.basename(providerFile, '.ts')
        if (new RegExp(`providers/${name}(['"]|\\.ts)`).test(text) && !allowedEntryPoints.some((suffix) => file.endsWith(suffix))) offenders.push(`${file} imports providers/${name}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('.env is gitignored and never committed', () => {
    const gitignore = readFileSync(path.join(ROOT, '.gitignore'), 'utf8')
    expect(gitignore).toMatch(/^\.env$/m)
  })

  it('.env.example documents only key NAMES, never values', () => {
    const example = readFileSync(path.join(ROOT, '.env.example'), 'utf8')
    for (const key of KEY_NAMES) expect(example).toMatch(new RegExp(`^${key}=\\s*$`, 'm'))
  })

  // Slice 0.1 (plan §21): DeepSeek was removed from the active bake-off after failing
  // structured-output validation live. Nothing runtime should still depend on it.
  it('DeepSeek is no longer an active provider: no adapter file, no route file, no key advertised', () => {
    expect(existsSync(path.join(ROOT, 'api', '_lib', 'providers', 'deepseek.ts'))).toBe(false)
    expect(existsSync(path.join(ROOT, 'api', 'ai-color', 'deepseek.ts'))).toBe(false)
    const example = readFileSync(path.join(ROOT, '.env.example'), 'utf8')
    expect(example).not.toContain('DEEPSEEK_API_KEY=')
    const contract = readFileSync(path.join(ROOT, 'src', 'domain', 'aiColorLab', 'contract.ts'), 'utf8')
    expect(contract).not.toMatch(/'deepseek'/)
  })
})
