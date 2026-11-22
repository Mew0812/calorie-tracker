import { createHash } from 'node:crypto'
export const pwaFiles=['manifest.webmanifest','icon-192.png','icon-512.png','apple-touch-icon.png']
export function pwaVersion(html,worker,files) {
  const hash=createHash('sha256').update(html).update(worker)
  for(const file of pwaFiles)hash.update(file).update(files.get(file))
  return hash.digest('hex').slice(0,20)
}
