import 'fake-indexeddb/auto'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {average, backupReminderDue, changeQuantities, db, deleteFood, goalAt, initialGoals, localDate, mapping, periodDates, restore, saveGoals, shift, snapshot, sortFoods, summarize, totals, updateDay, type Food} from './model'

const date='2024-02-29'
const egg:Food={id:'egg',name:'卵',unit:'個',weight:50,image:'',order:0,mode:'unit',input:{kcal:70,p:6.3,f:5,c:0.1},nutrition:{kcal:70,p:6.3,f:5,c:0.1},favorite:false,archived:false}
const add=(count:number,day=date)=>changeQuantities(day,[{id:'egg',count}])
beforeEach(async()=>{
  await db.transaction('rw',db.tables,async()=>{for(const table of db.tables)await table.clear()})
  await db.foods.add(egg)
})
describe('計算と日付',()=>{
  it('100gからの換算と丸め',()=>expect(mapping(key=>({kcal:120,p:10,f:3.2,c:8}[key]*1.5))).toEqual({kcal:180,p:15,f:4.8,c:12}))
  it('うるう年、月境界、月曜始まりを処理する',()=>{
    expect(localDate(new Date(2024,1,29,23,59))).toBe(date)
    expect(shift(date,1)).toBe('2024-03-01')
    expect(periodDates(date,true)).toHaveLength(29)
    expect(periodDates(date,false)[0]).toBe('2024-02-26')
  })
})
describe('保存',()=>{
  it('数量を0で止め、日ごとに記録し、再接続後も保持する',async()=>{
    await add(-1)
    expect(await db.days.count()).toBe(0)
    await Promise.all([add(1),add(1),add(1,shift(date,1))])
    db.close()
    await db.open()
    expect(totals(await db.entries.where('date').equals(date).toArray())).toEqual({kcal:140,p:12.6,f:10,c:0.2})
    await add(-5)
    expect(await db.entries.count()).toBe(1)
  })
  it('セットは一括で追加し、失敗時にロールバックし、追加分を取り消す',async()=>{
    await db.foods.add({...egg,id:'tofu'})
    await add(1)
    await expect(changeQuantities(date,[{id:'egg',count:2},{id:'unknown',count:1}])).rejects.toThrow()
    expect((await db.entries.get([date,'egg']))?.count).toBe(1)
    const {items}=await changeQuantities(date,[{id:'egg',count:2},{id:'tofu',count:1}])
    await add(1)
    await changeQuantities(date,items.map(x=>({...x,count:-x.count})),'undo')
    expect((await db.entries.toArray()).map(x=>x.count)).toEqual([2])
  })
  it('完了・再編集・再完了と栄養成分スナップショットを保持する',async()=>{
    await add(1)
    await updateDay(date,{completed:true})
    await expect(add(1)).rejects.toThrow()
    await updateDay(date,{completed:false})
    await db.foods.update('egg',{nutrition:{...egg.nutrition,kcal:120}})
    await add(1)
    await updateDay(date,{completed:true})
    expect((await db.days.get(date))?.completed).toBe(true)
    expect((await db.entries.get([date,'egg']))?.nutrition.kcal).toBe(70)
  })
  it('当日の目標履歴を保存し、既存のスナップショットを保持する',async()=>{
    const today=localDate()
    await add(1,today)
    await saveGoals({...initialGoals,rest:{...initialGoals.rest,kcal:1234}})
    await saveGoals({...initialGoals,rest:{...initialGoals.rest,kcal:2345}})
    expect((await goalAt(today)).rest.kcal).toBe(2345)
    expect((await db.days.get(today))?.goals.rest.kcal).toBe(initialGoals.rest.kcal)
    expect(await db.goals.count()).toBe(2)
  })
  it('未記録・記録中の日を平均に含めない',async()=>{
    await add(2)
    await updateDay(date,{completed:true})
    await add(1,shift(date,1))
    const rows=summarize(await db.days.toArray(),await db.entries.toArray(),periodDates(date,false).concat(shift(date,4)))
    expect(rows).toHaveLength(2)
    expect(average(rows)?.kcal).toBe(140)
  })
  it('お気に入り順とアーカイブ状態を保存し、食品画像も復元する',async()=>{
    const image='data:image/png;base64,YQ=='
    await db.foods.update('egg',{image,archived:true})
    await db.foods.add({...egg,id:'favorite',order:9,favorite:true})
    await db.foods.add({...egg,id:'top',order:2,favorite:true})
    const backup=await snapshot()
    await expect(restore({...backup,version:99})).rejects.toThrow()
    expect(await db.foods.count()).toBe(3)
    await db.foods.update('egg',{archived:false,image:''})
    await restore(JSON.parse(JSON.stringify(backup)))
    expect(sortFoods(await db.foods.toArray()).map(x=>x.id)).toEqual(['top','favorite','egg'])
    expect(await db.foods.get('egg')).toMatchObject({archived:true,image})
    await db.foods.update('egg',{archived:false})
    expect((await db.foods.get('egg'))?.archived).toBe(false)
  })
})


it('食品を削除しても履歴を維持し、セットと旧バックアップから削除済み食品を除外する',async()=>{
  await add(2)
  await db.foods.add({...egg,id:'tofu'})
  await db.sets.bulkAdd([
    {id:'empty',name:'卵セット',items:[{id:'egg',count:1}]},
    {id:'mixed',name:'朝食',items:[{id:'egg',count:1},{id:'tofu',count:1}]}
  ])
  const before=await snapshot()
  await deleteFood('egg')
  db.close()
  await db.open()
  expect(await db.foods.get('egg')).toMatchObject({deleted:true})
  expect(await db.entries.toArray()).toEqual(before.entries)
  expect(await db.days.toArray()).toEqual(before.days)
  const mixed=await db.sets.get('mixed')
  expect(mixed?.items).toEqual([{id:'tofu',count:1}])
  await changeQuantities(shift(date,1),mixed!.items,'set')
  expect((await db.sets.get('empty'))?.items).toEqual([])
  await restore(JSON.parse(JSON.stringify(await snapshot())))
  await restore(before)
  expect(await db.foods.get('egg')).toMatchObject({deleted:true})
  expect(await db.entries.toArray()).toEqual(before.entries)
  expect(await db.sets.get('mixed')).toEqual(mixed)
})

it('月末だけ案内する',()=>{
  expect(backupReminderDue('2024-02-28')).toBe(false)
  expect(backupReminderDue('2024-02-29')).toBe(true)
  expect(backupReminderDue('2026-12-31')).toBe(true)
})

it('新形式のレポート履歴と旧形式を復元し、不正な履歴を拒否する',async()=>{
  const history={id:'nutrition' as const,exportedAt:'2026-11-15T12:00:00.000Z',through:'2026-11-15'}
  await db.reportHistory.put(history)
  const backup=await snapshot()
  await expect(restore({...backup,reportHistory:{...history,through:'2026-02-30'}})).rejects.toThrow()
  expect(await snapshot()).toEqual(backup)
  await db.reportHistory.clear()
  await restore(backup)
  expect(await db.reportHistory.get('nutrition')).toEqual(history)
  await restore({...backup,version:1,reportHistory:undefined})
  expect(await db.reportHistory.get('nutrition')).toEqual(history)
  expect(await db.foods.toArray()).toEqual(backup.foods)
})

it('復元途中のエラーで既存データをロールバックする',async()=>{
  await add(1)
  const before=await snapshot()
  const fail=vi.spyOn(db.entries,'bulkAdd').mockRejectedValueOnce(new Error('write failed'))
  try {
    await expect(restore(before)).rejects.toThrow('write failed')
    expect(await snapshot()).toEqual(before)
  } finally {fail.mockRestore()}
})

it('マスター変更後も同じ日のセット追加と取り消しに元のスナップショットを使う',async()=>{
  await add(2)
  const original=await db.entries.get([date,egg.id])
  await db.foods.update(egg.id,{name:'新しい名前',unit:'パック',nutrition:{...egg.nutrition,kcal:100}})
  const undo=await changeQuantities(date,[{id:egg.id,count:3}],'set')
  expect(await db.entries.get([date,egg.id])).toEqual({...original,count:5})
  await changeQuantities(date,undo.items.map(item=>({...item,count:-item.count})),'undo')
  expect(await db.entries.get([date,egg.id])).toEqual(original)
  await deleteFood(egg.id)
  await expect(add(1)).rejects.toThrow()
  expect(await db.entries.get([date,egg.id])).toEqual(original)
})
