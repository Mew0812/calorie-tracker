import 'fake-indexeddb/auto'
import { beforeEach, expect, it, vi } from 'vitest'
import { db, snapshot, type Backup } from './model'
import { CloudBackup, DAY, type CloudAPI, type CloudMeta, type CloudRow } from './cloudBackup'
import { readLocalValue, restoreCloudBackup } from './cloudStorage'

beforeEach(async()=>{
  await db.transaction('rw',db.tables,async()=>{for(const table of db.tables)await table.clear()})
})
async function setup() {
  await db.foods.put({id:'food',name:'卵',unit:'個',weight:0,image:'data:image/png;base64,YQ==',nutrition:{kcal:75,p:6,f:5,c:0},input:{kcal:75,p:6,f:5,c:0},mode:'unit',order:0,archived:false,favorite:true})
  await db.reportHistory.put({id:'nutrition',exportedAt:'2026-11-21T01:00:00.000Z'})
  let local=await snapshot(),meta:CloudMeta|undefined,online=true,now=Date.now()
  const rows:CloudRow[]=[]
  const api:CloudAPI={
    latest:async()=>rows[0]??null,list:async()=>rows.slice(0,30),get:async id=>rows.find(row=>row.id===id)??null,
    insert:vi.fn(async pending=>{
      const existing=rows.find(row=>row.id===pending.id)
      if(existing)return {status:'saved' as const,backup:existing}
      if((rows[0]?.id??null)!==pending.expected)return {status:'conflict' as const,latest:rows[0]}
      const row={id:pending.id,created_at:new Date(now).toISOString(),schema_version:pending.data.version,backup_data:pending.data}
      rows.unshift(row)
      return {status:'saved' as const,backup:row}
    }),prune:async()=>{rows.splice(30);return true}
  }
  const deps={api,readData:async()=>local,readMeta:async()=>meta,writeMeta:async(value:CloudMeta)=>{meta=value},
    online:()=>online,now:()=>now,lock:async<T,>(task:()=>Promise<T>)=>task()}
  const cloud=new CloudBackup(deps,()=>{})
  return {cloud,api,rows,meta:()=>meta,advance:()=>{now+=DAY},offline:()=>{online=false},setLocal:(value:Backup)=>{local=value}}
}
it('画像・履歴を含め保存し、手動成功後24時間は自動送信しない',async()=>{
  const s=await setup(),before=await snapshot()
  await s.cloud.backup(false)
  expect(s.rows[0].backup_data).toEqual(before)
  await s.cloud.backup(true)
  expect(s.api.insert).toHaveBeenCalledTimes(1)
  s.advance()
  await s.cloud.backup(true)
  expect(s.api.insert).toHaveBeenCalledTimes(2)
  expect(await snapshot()).toEqual(before)
})
it('オフライン・空データ・初回競合を自動送信せず、既存クラウドを保護する',async()=>{
  const s=await setup()
  s.offline()
  await s.cloud.backup(true)
  expect(s.rows).toHaveLength(0)
  const t=await setup()
  await t.cloud.backup(false)
  const other=new CloudBackup({api:t.api,readData:async()=>({...await snapshot(),foods:[]}),readMeta:async()=>undefined,writeMeta:async()=>{},online:()=>true,now:Date.now,lock:async task=>task()},()=>{})
  await other.backup(true)
  expect(other.state.conflict).toBeDefined()
  expect(t.rows).toHaveLength(1)
})
it('応答紛失後は同じIDで再試行し二重保存しない',async()=>{
  const s=await setup()
  const insert=s.api.insert
  let failed=false
  s.api.insert=async pending=>{const result=await insert(pending);if(!failed){failed=true;throw new Error('lost response')}return result}
  await s.cloud.backup(true)
  const id=s.meta()?.pending?.id
  expect(s.meta()?.lastSuccess).toBeUndefined()
  await s.cloud.backup(true)
  expect(s.rows).toHaveLength(1)
  expect(s.meta()?.head).toBe(id)
  expect(s.meta()?.pending).toBeUndefined()
})
it('クラウド復元前の退避を同一トランザクションで保持する',async()=>{
  await setup()
  const before=await snapshot()
  await restoreCloudBackup({...before,foods:[]},'recovery')
  expect(await readLocalValue('recovery')).toEqual(before)
  await expect(restoreCloudBackup({version:99},'recovery')).rejects.toThrow()
  expect(await readLocalValue('recovery')).toEqual(before)
})
it('初回の空データを送信しない',async()=>{
  const s=await setup()
  s.setLocal({version:2,foods:[],days:[],entries:[],sets:[],goals:[],settings:undefined,reportHistory:undefined})
  await s.cloud.backup(true)
  expect(s.api.insert).not.toHaveBeenCalled()
})
it('復元途中で失敗した場合、端末データと以前の退避を保持する',async()=>{
  await setup()
  const before=await snapshot()
  await db.cloudLocal.put({key:'recovery',value:before})
  const fail=vi.spyOn(db.entries,'bulkAdd').mockRejectedValueOnce(new Error('disk full'))
  try {
    await expect(restoreCloudBackup(before,'recovery')).rejects.toThrow('disk full')
    expect(await snapshot()).toEqual(before)
    expect(await readLocalValue('recovery')).toEqual(before)
  } finally {fail.mockRestore()}
})
