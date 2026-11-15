import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { expect, it, vi } from 'vitest'

const root='https://mydiet.example/'
const asset='./assets/build.js'
const html='<script src="'+asset+'"></script>'
function worker(fetch) {
  const handlers=new Map()
  const items=new Map()
  const cache={
    addAll:vi.fn(async requests=>{
      for(const request of requests) {
        const response=await fetch(request.url)
        if(!response.ok)throw new Error('Asset unavailable')
        items.set(request.url,response)
      }
    }),
    put:async (url,response)=>items.set(url,response),
    match:async url=>items.get(typeof url==='string'?url:url.url)?.clone()
  }
  const caches={open:async()=>cache,keys:async()=>['other','mydiet:'+root+':v1'],delete:vi.fn()}
  const source=readFileSync(new URL('../public/sw.js',import.meta.url),'utf8')
    .replace('__BUILD_VERSION__','test')
    .replace('__BUILD_ASSETS__',asset)
  runInNewContext(source,{
    self:{registration:{scope:root},addEventListener:(name,handler)=>handlers.set(name,handler)},
    Request, URL, caches, fetch
  })
  function dispatch(name,request) {
    let pending
    handlers.get(name)({request,waitUntil:result=>pending=result,respondWith:result=>pending=result})
    return pending
  }
  return {dispatch,caches}
}

it('新キャッシュを準備し、起動時に旧キャッシュのみ削除してオフライン配信する',async()=>{
  const fetch=vi.fn(async url=>new Response(url===root?html:'app'))
  const {dispatch,caches}=worker(fetch)
  await dispatch('install')
  expect(caches.delete).not.toHaveBeenCalled()
  await dispatch('activate')
  expect(caches.delete.mock.calls).toEqual([['mydiet:'+root+':v1']])
  fetch.mockRejectedValue(new Error('offline'))
  expect(await (await dispatch('fetch',{url:root,method:'GET',mode:'navigate'})).text()).toBe(html)
  expect(await (await dispatch('fetch',{url:new URL(asset,root).href,method:'GET'})).text()).toBe('app')
})

it('別ビルドのHTMLや取得に失敗したアセットで更新を完了しない',async()=>{
  const mismatch=worker(async()=>new Response('<script src="./assets/other.js"></script>'))
  await expect(mismatch.dispatch('install')).rejects.toThrow('does not match')
  expect(mismatch.caches.delete).not.toHaveBeenCalled()
  const missing=worker(async url=>url===root?new Response(html):new Response('',{status:404}))
  await expect(missing.dispatch('install')).rejects.toThrow('Asset unavailable')
  expect(missing.caches.delete.mock.calls).toEqual([['mydiet:'+root+':test']])
})
