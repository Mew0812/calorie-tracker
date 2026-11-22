import 'fake-indexeddb/auto'
import { beforeEach, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { SetEditor } from './foodEditors'
import { changeQuantities, db, deleteFood, localDate, restore, saveSet, shift, snapshot, totals, type Food } from './model'

const nutrition={kcal:75,p:6,f:5,c:1}
const food:Food={id:'egg',name:'卵',unit:'1個',nutrition,input:nutrition,weight:0,image:'',order:0,mode:'unit',favorite:false,archived:false}
beforeEach(async()=>{
  await db.transaction('rw',db.tables,async()=>{for(const table of db.tables)await table.clear()})
  await db.foods.put(food)
  await saveSet({id:'breakfast',name:'朝食',items:[{id:'egg',count:2}]})
})

it('セット内の食品を保管しても関連付けと履歴を保持し、再起動後もセットから追加できる',async()=>{
  const today=localDate(),past=shift(today,-1)
  await changeQuantities(past,[{id:'egg',count:1}],'set')
  const previous=await db.entries.get([past,'egg']),set=await db.sets.get('breakfast')
  await db.foods.update('egg',{archived:true})
  db.close();await db.open()
  expect(await db.sets.get('breakfast')).toEqual(set)
  expect(await db.foods.get('egg')).toMatchObject({archived:true})
  expect((await db.foods.toArray()).filter(item=>!item.archived)).toHaveLength(0)
  const undo=await changeQuantities(today,set!.items,'set')
  expect(totals(await db.entries.where('date').equals(today).toArray())).toEqual({kcal:150,p:12,f:10,c:2})
  expect(await db.entries.get([past,'egg'])).toEqual(previous)
  await db.foods.update('egg',{name:'編集後の卵',nutrition:{kcal:999,p:0,f:0,c:0}})
  await changeQuantities(today,[{id:'egg',count:1}])
  expect(await db.entries.get([today,'egg'])).toMatchObject({name:'卵',count:3,nutrition})
  await changeQuantities(today,undo.items.map(item=>({...item,count:-item.count})),'undo')
  expect((await db.entries.get([today,'egg']))?.count).toBe(1)
  const backup=await snapshot()
  await restore(JSON.parse(JSON.stringify(backup)))
  expect(await db.sets.get('breakfast')).toEqual(set)
  expect((await db.foods.get('egg'))?.archived).toBe(true)
  await db.foods.update('egg',{archived:false})
  expect((await db.foods.toArray()).filter(item=>!item.archived)).toHaveLength(1)
  expect(await db.entries.get([past,'egg'])).toEqual(previous)
})

it('記録済みの保管食品を0まで減らせるが、通常一覧から未記録の保管食品は追加しない',async()=>{
  const today=localDate()
  await db.foods.update('egg',{archived:true})
  await expect(changeQuantities(today,[{id:'egg',count:1}])).rejects.toThrow('利用できない')
  await changeQuantities(today,[{id:'egg',count:2}],'set')
  await changeQuantities(today,[{id:'egg',count:-2}])
  expect(await db.entries.get([today,'egg'])).toBeUndefined()
  expect((await db.foods.get('egg'))?.archived).toBe(true)
})

it('完全削除は既存どおりセットから除去し、削除済み食品の新規セット追加を拒否する',async()=>{
  const today=localDate(),set=await db.sets.get('breakfast')
  await changeQuantities(today,set!.items,'set')
  const recorded=await db.entries.toArray()
  await deleteFood('egg')
  expect((await db.sets.get('breakfast'))?.items).toEqual([])
  await expect(changeQuantities(today,set!.items,'set')).rejects.toThrow('利用できない')
  await expect(saveSet(set!)).rejects.toThrow('削除済み')
  expect(await db.entries.toArray()).toEqual(recorded)
})

it('セット編集で保管食品の名前と数量を保持し、候補にも保管状態を表示する',()=>{
  const html=renderToStaticMarkup(createElement(SetEditor,{
    item:{id:'set',name:'朝食',items:[{id:'egg',count:2}]},
    foods:[{...food,archived:true},{...food,id:'other',name:'納豆',archived:true},{...food,id:'deleted',name:'削除食品',deleted:true}],
    save:()=>{},remove:()=>{},close:()=>{}
  }))
  expect(html).toContain('卵<small>（アーカイブ済み）</small>')
  expect(html).toMatch(/aria-label="数量"[^>]*value="2"/)
  expect(html).toContain('<option value="other">納豆（アーカイブ済み）</option>')
  expect(html).not.toContain('削除食品')
})
