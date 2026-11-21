import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { expect, it } from 'vitest'
import { db, initialGoals, snapshot } from './model'

it('IndexedDB v3からv4への更新で既存の全バックアップ対象を保持する',async()=>{
  await db.delete()
  const legacy=new Dexie('MyDiet')
  legacy.version(3).stores({
    foods:'id',sets:'id',days:'date',entries:'[date+foodId],date',
    goals:'id,date',settings:'id',localBackups:'id',reportHistory:'id'
  })
  const nutrition={kcal:75,p:6,f:5,c:0}
  const food={id:'egg',name:'卵',unit:'個',weight:50,image:'data:image/png;base64,YQ==',
    nutrition,input:nutrition,mode:'unit',favorite:true,archived:false,order:0}
  const day={date:'2026-11-21',kind:'rest',goals:initialGoals,completed:true}
  const entry={date:day.date,foodId:food.id,name:food.name,unit:food.unit,nutrition,count:2}
  const goal={id:'goal',date:day.date,goals:initialGoals}
  const set={id:'set',name:'朝食',items:[{id:food.id,count:2}]}
  const settings={id:'app',theme:'dark'}
  const history={id:'nutrition',exportedAt:'2026-11-21T00:00:00.000Z',through:day.date}
  await legacy.open()
  await legacy.transaction('rw',legacy.tables,async()=>{
    for(const [table,value] of Object.entries({foods:food,sets:set,days:day,entries:entry,goals:goal,settings,reportHistory:history})) {
      await legacy.table(table).put(value)
    }
    await legacy.table('localBackups').put({id:'latest',data:{untouched:true}})
  })
  legacy.close()
  await db.open()
  expect(db.verno).toBe(4)
  expect(await snapshot()).toEqual({
    version:2,foods:[food],sets:[set],days:[day],entries:[entry],goals:[goal],settings,reportHistory:history
  })
  expect(await db.table('localBackups').get('latest')).toEqual({id:'latest',data:{untouched:true}})
  expect(await db.cloudLocal.count()).toBe(0)
  db.close()
})
