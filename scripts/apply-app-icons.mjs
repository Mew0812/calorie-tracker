import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
export function inspectIcon(bytes,size) {
  const signature=Buffer.from([137,80,78,71,13,10,26,10])
  if(bytes.length<45||bytes.length>25*1024*1024||!bytes.subarray(0,8).equals(signature)||bytes.readUInt32BE(8)!==13||bytes.toString('ascii',12,16)!=='IHDR'||bytes.readUInt32BE(16)!==size||bytes.readUInt32BE(20)!==size)throw new Error(`${size}×${size}pxのPNG画像を選んでください。`)
  return bytes
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const args=process.argv.slice(2),check=args.includes('--check'),paths=args.filter(arg=>arg!=='--check')
    if(paths.length!==3)throw new Error('使用例: node scripts/apply-app-icons.mjs [--check] "192pxのPNG" "512pxのPNG" "180pxのPNG"')
    const files=paths.map((path,index)=>inspectIcon(readFileSync(path),[192,512,180][index]))
    const manifest=JSON.parse(readFileSync(new URL('../public/manifest.webmanifest',import.meta.url),'utf8'))
    if(manifest.display!=='standalone'||manifest.icons?.some(icon=>icon.purpose?.includes('maskable')))throw new Error('PWA設定を確認してください。standaloneと通常のアイコン設定が必要です。')
    if(!check)['icon-192.png','icon-512.png','apple-touch-icon.png'].forEach((name,index)=>writeFileSync(new URL('../public/'+name,import.meta.url),files[index]))
    console.log(check?'PNGの検証に成功しました。ファイルは変更していません。':'正式アイコンを更新しました。npm run build後に、既存の公開方法で反映してください。')
  }catch(error){console.error(error.message);process.exitCode=1}
}
