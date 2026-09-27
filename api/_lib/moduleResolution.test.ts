import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// V2.0 hotfix (docs/V2_AI_COLOR_LAB.md §Slice 0.5D production hotfix): production crashed with
// ERR_MODULE_NOT_FOUND because relative imports in the server-side (api/) module graph had no
// file extension. The repo root package.json declares "type": "module", so Vercel's Node
// runtime loads these files with Node's native ESM resolver, which -- unlike Vite's dev-time
// transform, tsc's Bundler-mode type checking, or Vitest's own module loader -- refuses to
// resolve an extensionless relative specifier at all. None of those three ever exercised the
// real resolver, which is exactly why the bug shipped without any local signal.
//
// This test statically walks the REAL module graph starting from every actual Vercel function
// entry point (api/ai-color/*.ts, api/ai-palette/*.ts) and fails if any reachable server module
// uses a relative import Node's ESM loader could not resolve at runtime -- whether that is a
// missing extension or a path that does not resolve to a file on disk at all. It re-walks the
// graph from source rather than asserting a fixed file list, so any new production-reachable
// server file with the same defect fails this test the moment it is added, not just the files
// broken today.

const ROOT = path.resolve(__dirname, '..', '..')

function relativeImportSpecifiers(file: string): string[] {
  const text = readFileSync(file, 'utf8')
  return [...text.matchAll(/from\s+['"]([^'"]+)['"]/g)]
    .map((match) => match[1])
    .filter((specifier) => specifier.startsWith('.'))
}

function entryPoints(dir: string): string[] {
  return readdirSync(dir)
    .filter((entry) => entry.endsWith('.ts') && !entry.endsWith('.test.ts'))
    .map((entry) => path.join(dir, entry))
}

describe('server-side ESM module graph resolves the way Vercel/Node actually load it', () => {
  it('every relative import reachable from a Vercel function entry point has a file extension and resolves to a real file', () => {
    const entries = [...entryPoints(path.join(ROOT, 'api', 'ai-color')), ...entryPoints(path.join(ROOT, 'api', 'ai-palette'))]
    // Guards against this test silently checking nothing if the entry directories are ever renamed.
    expect(entries.length).toBeGreaterThan(0)

    const offenders: string[] = []
    const visited = new Set<string>()
    const queue = [...entries]

    while (queue.length > 0) {
      const file = queue.shift()!
      if (visited.has(file)) continue
      visited.add(file)

      for (const specifier of relativeImportSpecifiers(file)) {
        if (!/\.(js|json)$/.test(specifier)) {
          offenders.push(`${path.relative(ROOT, file)}: '${specifier}' has no file extension -- Node's ESM loader (used by Vercel in production, unlike Vite dev/tsc/Vitest) cannot resolve this`)
          continue
        }
        const resolved = path.normalize(path.join(path.dirname(file), specifier))
        // A '.js' specifier resolves back to the real '.ts' source on disk (verified separately
        // by `tsc -b --noEmit` under this project's Bundler-mode moduleResolution).
        const onDisk = resolved.endsWith('.json') ? resolved : resolved.replace(/\.js$/, '.ts')
        if (!existsSync(onDisk)) {
          offenders.push(`${path.relative(ROOT, file)}: '${specifier}' resolves to ${path.relative(ROOT, onDisk)}, which does not exist`)
          continue
        }
        if (onDisk.endsWith('.ts')) queue.push(onDisk)
      }
    }

    expect(offenders).toEqual([])
  })
})
