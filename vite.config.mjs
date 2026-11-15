import { defineConfig } from 'vite'
import tailwind from '@tailwindcss/vite'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

export default defineConfig({
  base: './',
  plugins: [tailwind(), {
    name: 'version-service-worker',
    apply: 'build',
    async writeBundle(output) {
      const root=resolve(output.dir??'dist')
      const [html,worker]=await Promise.all([
        readFile(resolve(root,'index.html'),'utf8'),
        readFile(resolve(root,'sw.js'),'utf8')
      ])
      const assets=[...html.matchAll(/(?:src|href)="(\.\/assets\/[^"]+)"/g)].map(match=>match[1])
      if(!assets.length) throw new Error('PWA shell assets are missing')
      const version=createHash('sha256').update(html).update(worker).digest('hex').slice(0,20)
      await writeFile(resolve(root,'sw.js'),worker
        .replace("'__BUILD_VERSION__'",JSON.stringify(version))
        .replace("['__BUILD_ASSETS__']",JSON.stringify(assets)))
    }
  }]
})
