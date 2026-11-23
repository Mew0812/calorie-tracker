import { expect,test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { readFile as read } from 'node:fs/promises'
import { createServer } from 'node:http'
import { resolve,sep,extname } from 'node:path'

test('text, Unicode, photos, opaque PNGs and persisted food records',async({page})=>{
  await page.goto('/')
  await page.getByRole('navigation').getByRole('button',{name:'食品',exact:true}).click()
  await page.getByRole('button',{name:'食品を新規作成',exact:true}).click()
  await page.getByRole('textbox',{name:'食品名',exact:true}).fill('検証用の卵')
  await page.getByRole('textbox',{name:'単位',exact:true}).fill('1個')
  for(const [label,value] of [['カロリー（kcal）','75'],['タンパク質（g）','6'],['脂質（g）','5'],['炭水化物（g）','1']])await page.getByRole('spinbutton',{name:label,exact:true}).fill(value)
  await page.getByRole('button',{name:'保存する',exact:true}).click()
  await page.getByRole('navigation').getByRole('button',{name:'記録',exact:true}).click()
  await page.getByRole('button',{name:'検証用の卵を1増やす',exact:true}).click()
  const data=()=>page.evaluate(async()=>{
    const connection=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open('MyDiet');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})
    try{return await new Promise((resolve,reject)=>{const tx=connection.transaction(['foods','days','entries','sets','goals','settings','reportHistory'],'readonly');const result:Record<string,unknown>={};for(const name of tx.objectStoreNames){const request=tx.objectStore(name).getAll();request.onsuccess=()=>{result[name]=request.result}}tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error)})}finally{connection.close()}
  })
  const before=await data()
  await page.getByRole('navigation').getByRole('button',{name:'設定',exact:true}).click()
  await page.getByRole('button',{name:'アプリアイコン',exact:true}).click()
  const editor=page.getByRole('region',{name:'アイコン作成'})
  await expect(editor.getByRole('img',{name:'現在のMyDietアイコン'})).toBeVisible()
  await editor.getByRole('button',{name:'文字・数字',exact:true}).click()
  const input=editor.getByLabel('文字・数字（1〜5文字）'),canvas=editor.locator('canvas')
  await input.fill('仕事A★👩‍💻過');await expect(input).toHaveValue('仕事A★👩‍💻')
  await input.fill('か\u3099abcdZ');await expect(input).toHaveValue('か\u3099abcd')
  await editor.getByLabel('背景色',{exact:true}).fill('#103060')
  await editor.getByLabel('文字色',{exact:true}).fill('#ffffff')
  const bounds=()=>canvas.evaluate((canvas:HTMLCanvasElement)=>{
    const ctx=canvas.getContext('2d')!,pixels=ctx.getImageData(0,0,1024,1024).data
    let left=1024,right=0,top=1024,bottom=0,opaque=true
    for(let y=0;y<1024;y++)for(let x=0;x<1024;x++){const offset=(y*1024+x)*4;if(pixels[offset+3]!==255)opaque=false;if(pixels[offset]!==16||pixels[offset+1]!==48||pixels[offset+2]!==96){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y)}}
    return {left,right,top,bottom,opaque,width:right-left}
  })
  for(const text of ['食','食事','食事管','食事管理','食事管理中','12345','A★B!?']) {
    await input.fill(text)
    await expect.poll(async()=>{const b=await bounds();return b.opaque&&b.left>=100&&b.top>=100&&b.right<=924&&b.bottom<=924&&b.width>0}).toBe(true)
    const b=await bounds();expect(Math.abs((b.left+b.right)/2-512)).toBeLessThan(12)
  }
  await input.fill('');await expect(editor.getByRole('button',{name:'PNGを保存',exact:true})).toBeDisabled()
  await editor.getByRole('button',{name:'写真・画像',exact:true}).click()
  const sample=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=300;c.height=120;const ctx=c.getContext('2d')!;ctx.fillStyle='#ff0000';ctx.fillRect(0,0,150,120);ctx.fillStyle='#0000ff';ctx.fillRect(150,0,150,120);return c.toDataURL().split(',')[1]})
  await editor.getByLabel('画像を選択').setInputFiles({name:'wide.png',mimeType:'image/png',buffer:Buffer.from(sample,'base64')})
  await editor.getByLabel('拡大・縮小').fill('2')
  const pixel=()=>canvas.evaluate((c:HTMLCanvasElement)=>Array.from(c.getContext('2d')!.getImageData(512,512,1,1).data))
  await editor.getByLabel('左右の位置').fill('100');await expect.poll(pixel).toEqual([255,0,0,255])
  await editor.getByLabel('左右の位置').fill('-100');await expect.poll(pixel).toEqual([0,0,255,255])
  for(const size of [1024,512,192,180]) {
    await editor.getByLabel('出力サイズ').selectOption(String(size))
    const saving=page.waitForEvent('download');await editor.getByRole('button',{name:'PNGを保存',exact:true}).click()
    const download=await saving,png=await read((await download.path())!)
    expect(download.suggestedFilename()).toBe(`mydiet-icon-${size}.png`)
    expect(png.subarray(0,8)).toEqual(Buffer.from([137,80,78,71,13,10,26,10]))
    expect([png.readUInt32BE(16),png.readUInt32BE(20)]).toEqual([size,size])
  }
  expect(await data()).toEqual(before)
  await page.reload();expect(await data()).toEqual(before)
})

test('relative Pages path, standalone identity and offline icon editor',async({page,context},testInfo)=>{
  const root=resolve('dist'),prefix='/calorie-tracker/'
  const types:Record<string,string>={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webmanifest':'application/manifest+json'}
  const server=createServer((request,response)=>{
    try{const pathname=new URL(request.url!,'http://localhost').pathname;if(!pathname.startsWith(prefix))throw Error('prefix');const path=resolve(root,decodeURIComponent(pathname.slice(prefix.length))||'index.html');if(!path.startsWith(root+sep))throw Error('outside');const content=readFileSync(path);response.writeHead(200,{'Content-Type':types[extname(path)]??'application/octet-stream'});response.end(content)}catch{response.writeHead(404);response.end()}
  })
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve))
  const url=`http://127.0.0.1:${(server.address() as {port:number}).port}${prefix}`
  try {
    await page.goto(url)
    const manifest=await (await page.request.get(url+'manifest.webmanifest')).json()
    expect([manifest.id,manifest.start_url,manifest.scope,manifest.display]).toEqual(['./','./','./','standalone'])
    expect(await page.locator('link[rel="apple-touch-icon"]').getAttribute('href')).toBe('./apple-touch-icon.png')
    expect(await page.evaluate(async()=>(await navigator.serviceWorker.ready).scope)).toBe(url)
    await page.reload()
    await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true)
    await context.setOffline(true);expect((await page.reload())?.fromServiceWorker()).toBe(true)
    await page.getByRole('navigation').getByRole('button',{name:'設定',exact:true}).click()
    await page.getByRole('button',{name:'アプリアイコン',exact:true}).click()
    const editor=page.getByRole('region',{name:'アイコン作成'})
    await expect(editor.getByRole('img',{name:'現在のMyDietアイコン'})).toBeVisible()
    expect(await editor.getByRole('img').evaluate((img:HTMLImageElement)=>img.naturalWidth)).toBe(512)
    await editor.getByRole('button',{name:'文字・数字',exact:true}).click()
    await editor.getByLabel('文字・数字（1〜5文字）').fill('食事管理中')
    await expect(editor.getByRole('button',{name:'PNGを保存',exact:true})).toBeEnabled()
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true)
    await page.screenshot({path:testInfo.outputPath('icon-editor.png'),fullPage:true})
  }finally{await context.setOffline(false);server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()))}
})
