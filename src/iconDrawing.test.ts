import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { imagePlacement,limitIconText } from './iconDrawing'
import { inspectIcon } from '../scripts/apply-app-icons.mjs'
it('日本語・数字・記号・結合文字・絵文字を途中で分割せず5書記素までにする',()=>{
  expect(limitIconText('仕事A★👩‍💻過')).toBe('仕事A★👩‍💻')
  expect(limitIconText('123456')).toBe('12345')
  expect(limitIconText('か\u3099abcdZ')).toBe('か\u3099abcd')
  expect(limitIconText('🇯🇵👍🏽👨‍👩‍👧‍👦❤️A余')).toBe('🇯🇵👍🏽👨‍👩‍👧‍👦❤️A')
  expect(limitIconText('')).toBe('')
})
it('縦長・横長・正方形の画像を拡大・移動しても切り抜き枠を覆う',()=>{
  for(const [w,h] of [[300,120],[120,300],[500,500]])for(const zoom of [1,2,4])for(const x of [-100,0,100])for(const y of [-100,0,100]) {
    const r=imagePlacement(w,h,1024,zoom,x,y)
    expect(r.width).toBeGreaterThanOrEqual(1024);expect(r.height).toBeGreaterThanOrEqual(1024)
    expect(r.left).toBeLessThanOrEqual(0);expect(r.top).toBeLessThanOrEqual(0)
    expect(r.left+r.width).toBeGreaterThanOrEqual(1024);expect(r.top+r.height).toBeGreaterThanOrEqual(1024)
  }
  expect(()=>imagePlacement(0,10,1024,1,0,0)).toThrow()
})
it('正式アイコンのPNG形式とサイズを確認する',()=>{
  for(const [name,size] of [['icon-192.png',192],['icon-512.png',512],['apple-touch-icon.png',180]] as const) {
    const bytes=readFileSync(new URL('../public/'+name,import.meta.url))
    expect(inspectIcon(bytes,size)).toBe(bytes)
    expect(()=>inspectIcon(bytes,1024)).toThrow()
  }
  expect(()=>inspectIcon(Buffer.from('not PNG'),192)).toThrow()
})
