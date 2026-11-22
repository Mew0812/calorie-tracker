import 'fake-indexeddb/auto'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { db, changeQuantities, initialGoals, localDate, refreshDayStates, restore, snapshot, totals, updateDay } from './model'
import { reportRows } from './report'
import { formatQuantity } from './quantity'

beforeEach(async()=>{
  vi.useFakeTimers({toFake:['Date']})
  vi.setSystemTime(new Date('2026-11-21T23:59:59+09:00'))
  await db.transaction('rw',db.tables,async()=>{for(const table of db.tables)await table.clear()})
  await db.foods.add({id:'egg',name:'卵',unit:'1個',nutrition:{kcal:75,p:6,f:5,c:1},input:{kcal:75,p:6,f:5,c:1},weight:0,image:'',order:0,mode:'unit',favorite:false,archived:false})
})
afterEach(()=>vi.useRealTimers())

it('日本時間0時に既存記録だけを完了し、繰り返しても世代と記録を重複させない',async()=>{
  await changeQuantities('2026-11-21',[{id:'egg',count:2}])
  expect((await db.days.get('2026-11-21'))?.completed).toBe(false)
  const entries=await db.entries.toArray(),before=await db.cloudLocal.get('analysis-generation')
  vi.setSystemTime(new Date('2026-11-22T00:00:00+09:00'))
  expect(localDate()).toBe('2026-11-22')
  await refreshDayStates();await refreshDayStates()
  expect(await db.days.count()).toBe(1)
  expect(await db.days.get('2026-11-22')).toBeUndefined()
  expect((await db.days.get('2026-11-21'))?.completed).toBe(true)
  expect(await db.entries.toArray()).toEqual(entries)
  expect((await db.cloudLocal.get('analysis-generation'))?.value).toBe(Number(before?.value)+1)
})

it('終了中・復帰時の補正、旧完了状態、JSON復元を安全に扱う',async()=>{
  await db.days.put({date:'2026-11-20',kind:'training',completed:false,goals:initialGoals})
  await db.days.put({date:'2026-11-21',kind:'rest',completed:true,goals:initialGoals})
  db.close();await db.open();await refreshDayStates()
  expect((await db.days.get('2026-11-20'))?.completed).toBe(true)
  expect((await db.days.get('2026-11-21'))?.completed).toBe(false)
  const backup=await snapshot()
  await restore({...backup,days:backup.days.map(day=>({...day,completed:!day.completed}))})
  expect(await db.days.toArray()).toEqual(backup.days)
})

it('過去日の編集はスナップショットと完了状態を維持し、今日には影響しない',async()=>{
  await changeQuantities('2026-11-20',[{id:'egg',count:1}])
  await changeQuantities('2026-11-21',[{id:'egg',count:2}])
  const previous=await db.entries.get(['2026-11-20','egg']),today=await db.entries.get(['2026-11-21','egg'])
  const goals=(await db.days.get('2026-11-20'))?.goals
  await db.foods.update('egg',{name:'編集後',deleted:true,nutrition:{kcal:999,p:0,f:0,c:0}})
  await db.cloudLocal.put({key:'analysis:diet:project:user',value:{confirmedAt:'old',weekEnd:'2026-11-15'}})
  const generation=Number((await db.cloudLocal.get('analysis-generation'))?.value)
  await changeQuantities('2026-11-20',[{id:'egg',count:1}])
  expect(await db.entries.get(['2026-11-20','egg'])).toEqual({...previous,count:2})
  expect(await db.entries.get(['2026-11-21','egg'])).toEqual(today)
  expect(await db.days.get('2026-11-20')).toMatchObject({completed:true,goals})
  expect((await db.cloudLocal.get('analysis-generation'))?.value).toBe(generation+1)
  expect((await db.cloudLocal.get('analysis:diet:project:user'))?.value).toMatchObject({confirmedAt:undefined,needsResync:true})
  expect(totals(await db.entries.where('date').equals('2026-11-20').toArray()).kcal).toBe(150)
})

it('未来日と不正な日付を拒否し、記録を作らない',async()=>{
  await expect(changeQuantities('2026-11-22',[{id:'egg',count:1}])).rejects.toThrow('未来日')
  await expect(updateDay('2026-02-30',{kind:'rest'})).rejects.toThrow('日付')
  expect(await db.days.count()).toBe(0)
})

it('日本時間の日付・レポート状態は端末の時差に依存しない',async()=>{
  expect(localDate(new Date('2026-11-21T14:59:59Z'))).toBe('2026-11-21')
  expect(localDate(new Date('2026-11-21T15:00:00Z'))).toBe('2026-11-22')
  const rows=reportRows(['2026-11-19','2026-11-20','2026-11-21'],[
    {date:'2026-11-20',kind:'rest',completed:false,goals:initialGoals},
    {date:'2026-11-21',kind:'rest',completed:true,goals:initialGoals}
  ],[])
  expect(rows.map(row=>row.day?.completed)).toEqual([undefined,true,false])
})

it.each([
  ['1個',2,'2個'],['1個',1,'1個'],['2食',1,'2食'],['30g',1,'30g'],['30g',2,'60g'],
  ['0.5合',1,'0.5合'],['1/3袋',1,'1/3袋'],['1/3袋',2,'2/3袋'],['1/3袋',3,'1袋'],
  ['0.5個',2,'1個'],['個',2,'2個'],['1.5kg',2,'3kg'],['200ml',2,'400ml'],
  ['適量',2,'適量 × 2'],['大さじ1（目安）',2,'大さじ1（目安） × 2'],['',2,'2単位'],['1/0袋',2,'1/0袋 × 2']
])('数量表示 %s × %i → %s',(unit,count,expected)=>expect(formatQuantity(unit,count)).toBe(expected))
