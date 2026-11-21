import Dexie, { type Table } from 'dexie'

export const nutrients = ['kcal', 'p', 'f', 'c'] as const
export type Metric = typeof nutrients[number]
export type Nutrition = Record<Metric, number>
export type Kind = 'training' | 'rest'
export type Goals = Record<Kind, Nutrition>
export type Food = {id:string; name:string; unit:string; weight:number; image:string; nutrition:Nutrition; favorite:boolean; archived:boolean; deleted?:boolean; order:number; mode:'unit'|'100g'; input:Nutrition}
export type FoodSet = {id:string; name:string; items:{id:string; count:number}[]}
export type Entry = {date:string; foodId:string; count:number; name:string; unit:string; nutrition:Nutrition}
export type Day = {date:string; kind:Kind; goals:Goals; completed:boolean}
export type Revision = {id:string; date:string; goals:Goals}
export type Settings = {id:'app'; theme:'system'|'light'|'dark'}
export type ReportHistory = {
  id:'nutrition'
  exportedAt:string
  through?:string
  sinceStart?:string
  lastPeriod?:{mode:'recent'|'since'; start:string; end:string}
}
export const zero = {kcal:0,p:0,f:0,c:0}
export function calorieGoal(value:Pick<Nutrition,'p'|'f'|'c'>):Nutrition {
  if([value.p,value.f,value.c].some(amount=>!Number.isFinite(amount)||amount<0)) {
    throw new Error('栄養素の目標値には0以上の数値を入力してください。')
  }
  const kcal=Math.round((value.p*4+value.f*9+value.c*4)*1e6)/1e6
  if(!Number.isFinite(kcal))throw new Error('目標値が大きすぎます。')
  return {...value,kcal}
}
export const initialGoals: Goals = {training:calorieGoal({p:140,f:60,c:275}),rest:calorieGoal({p:130,f:55,c:220})}
export const labels = {kcal:'カロリー',p:'タンパク質',f:'脂質',c:'炭水化物'}
export const units = {kcal:'kcal',p:'g',f:'g',c:'g'}
export const round = (value:number) => Math.round((value + Number.EPSILON) * 1e6) / 1e6
export const fmt = (value:number) => new Intl.NumberFormat('ja-JP',{maximumFractionDigits:1}).format(value)
export const mapping = (fn:(key:Metric)=>number) => Object.fromEntries(nutrients.map(key=>[key,round(fn(key))])) as Nutrition
export const totals = (entries:Entry[]) => mapping(key=>entries.reduce((sum,entry)=>sum + entry.count * entry.nutrition[key],0))
export const localDate = (date = new Date()) => [date.getFullYear(),date.getMonth()+1,date.getDate()].map(n=>String(n).padStart(2,'0')).join('-')
export const dateObject = (date:string) => new Date(date+'T12:00:00')
export function shift(date:string, offset:number) { const value=dateObject(date); value.setDate(value.getDate()+offset); return localDate(value) }
export function periodDates(date:string, month:boolean) {
  const value=dateObject(date)
  const start=month ? date.slice(0,7)+'-01' : shift(date,-((value.getDay()+6)%7))
  const count=month ? new Date(value.getFullYear(),value.getMonth()+1,0).getDate() : 7
  return Array.from({length:count},(_,i)=>shift(start,i))
}
class Database extends Dexie {
  foods!:Table<Food,string>
  sets!:Table<FoodSet,string>
  days!:Table<Day,string>
  entries!:Table<Entry,[string,string]>
  goals!:Table<Revision,string>
  settings!:Table<Settings,string>
  reportHistory!:Table<ReportHistory,string>
  cloudLocal!:Table<{key:string; value:unknown},string>
  constructor(name='MyDiet') {
    super(name)
    this.version(1).stores({foods:'id',sets:'id',days:'date',entries:'[date+foodId],date',goals:'id,date',settings:'id'})
    this.version(2).stores({localBackups:'id'})
    this.version(3).stores({reportHistory:'id'})
    this.version(4).stores({cloudLocal:'key'})
  }
}
export const db = new Database()
export const sortFoods = (foods:Food[]) => [...foods].sort((a,b)=>Number(b.favorite)-Number(a.favorite)||a.order-b.order)
export async function reorderFood(id:string, targetId:string, after:boolean) {
  await db.transaction('rw',db.foods,async()=>{
    const food=await db.foods.get(id)
    if(!food||food.archived||food.deleted)return
    const group=sortFoods(await db.foods.toArray()).filter(item=>!item.archived&&!item.deleted&&item.favorite===food.favorite)
    const target=group.find(item=>item.id===targetId)
    if(!target||target.id===id)return
    const ordered=group.filter(item=>item.id!==id)
    ordered.splice(ordered.findIndex(item=>item.id===targetId)+(after?1:0),0,food)
    await db.foods.bulkPut(ordered.map((item,order)=>({...item,order})))
  })
}
export async function goalAt(date:string) {
  const revisions=await db.goals.where('date').belowOrEqual(date).sortBy('date')
  const saved=revisions.at(-1)?.goals ?? initialGoals
  return {training:calorieGoal(saved.training),rest:calorieGoal(saved.rest)}
}
export async function saveGoals(goals:Goals) {
  const calculated={training:calorieGoal(goals.training),rest:calorieGoal(goals.rest)}
  const date=localDate()
  await db.transaction('rw',db.goals,async()=>{
    const latest=await db.goals.where('date').equals(date).last()
    const order=latest ? Number(latest.id.split('-')[0])+1 : Date.now()
    await db.goals.add({id:String(order).padStart(16,'0')+'-'+newId(),date,goals:calculated})
  })
}
export const newId = () => Date.now().toString(36)+'-'+Array.from(crypto.getRandomValues(new Uint32Array(2)),n=>n.toString(36)).join('-')
async function getDay(date:string):Promise<Day> {
  return await db.days.get(date) ?? {date,kind:'rest',goals:await goalAt(date),completed:false}
}
export async function updateDay(date:string, patch:Partial<Pick<Day,'kind'|'completed'>>) {
  await db.transaction('rw',db.days,db.goals,async()=>db.days.put({...await getDay(date),...patch}))
}
export async function deleteFood(id:string) {
  await db.transaction('rw',db.foods,db.sets,async()=>{
    const food=await db.foods.get(id)
    if(!food||food.deleted)return
    await db.foods.update(id,{deleted:true})
    const sets=await db.sets.toArray()
    await db.sets.bulkPut(sets.filter(set=>set.items.some(item=>item.id===id))
      .map(set=>({...set,items:set.items.filter(item=>item.id!==id)})))
  })
}
export async function saveSet(set:FoodSet) {
  await db.transaction('rw',db.foods,db.sets,async()=>{
    const foods=await db.foods.bulkGet(set.items.map(item=>item.id))
    if(foods.some(food=>!food||food.deleted)) throw new Error('セットに削除済みの食品が含まれています。')
    await db.sets.put(set)
  })
}

export type Undo = {date:string; items:{id:string; count:number}[]}
export async function changeQuantities(date:string, changes:FoodSet['items'], mode:'normal'|'set'|'undo'='normal'):Promise<Undo> {
  return db.transaction('rw',db.days,db.entries,db.foods,db.goals,async()=>{
    const day=await getDay(date)
    if(day.completed) throw new Error('再編集を開始してください。')
    const items:Undo['items']=[]
    for(const {id,count} of changes) {
      const previous=await db.entries.get([date,id])
      const next=Math.max(0,(previous?.count??0)+count)
      if(!Number.isSafeInteger(next)) throw new Error('数量の上限を超えています。')
      const food=mode==='set'||next>(previous?.count??0) ? await db.foods.get(id) : undefined
      if((mode==='set'||next>(previous?.count??0))&&(!food||food.archived||food.deleted)) {
        throw new Error('利用できない食品が含まれています。')
      }
      if(next===(previous?.count??0)) continue
      if(!next) await db.entries.delete([date,id])
      // All units in an existing daily line use the original food snapshot.
      else if(previous) await db.entries.put({...previous,count:next})
      else if(food) {
        await db.entries.put({date,foodId:id,count:next,name:food.name,unit:food.unit,nutrition:food.nutrition})
      }
      items.push({id,count:next-(previous?.count??0)})
    }
    if(items.length) await db.days.put({...day,completed:false})
    return {date,items}
  })
}
export function summarize(days:Day[], entries:Entry[], dates:string[]) {
  return dates.flatMap(date=>{
    const day=days.find(item=>item.date===date)
    return day ? [{...day,total:totals(entries.filter(entry=>entry.date===date))}] : []
  })
}
export const average = (rows:ReturnType<typeof summarize>) => {
  const completed=rows.filter(day=>day.completed)
  return completed.length ? mapping(key=>completed.reduce((sum,day)=>sum+day.total[key],0)/completed.length) : null
}
export async function snapshot() {
  return db.transaction('r',db.tables,async()=>({
    version:2, foods:await db.foods.toArray(),sets:await db.sets.toArray(),days:await db.days.toArray(),
    entries:await db.entries.toArray(),goals:await db.goals.toArray(),settings:await db.settings.get('app'),
    reportHistory:await db.reportHistory.get('nutrition')
  }))
}
export type Backup = Awaited<ReturnType<typeof snapshot>>
export function backupReminderDue(today:string) {
  return shift(today,1).slice(0,7)!==today.slice(0,7)
}
type ObjectValue = Record<string, unknown>
const obj = (v:unknown):v is ObjectValue => typeof v==='object' && v!==null && !Array.isArray(v)
const str = (v:unknown):v is string => typeof v==='string' && v.trim().length>0
const num = (v:unknown):v is number => typeof v==='number' && Number.isFinite(v) && v>=0
const integer = (v:unknown):v is number => num(v) && Number.isSafeInteger(v)
const dateValid = (v:unknown):v is string => str(v) && /^\d{4}-\d{2}-\d{2}$/.test(v) && localDate(dateObject(v))===v
const nutrition = (v:unknown) => obj(v) && nutrients.every(key=>num(v[key]))
const goalPair = (v:unknown) => obj(v) && nutrition(v.training) && nutrition(v.rest)
const list = (v:unknown, valid:(item:ObjectValue)=>boolean, key:(item:ObjectValue)=>unknown) =>
  Array.isArray(v) && v.every(item=>obj(item)&&valid(item)) && new Set(v.map(key)).size===v.length
const imageValid = (v:unknown) => v==='' || (str(v) && /^data:image\/(png|jpeg|webp|gif|avif|heic|heif);base64,[A-Za-z0-9+/]+={0,2}$/i.test(v))
const validSettings = (v:unknown) => obj(v) && v.id==='app' &&
  (v.theme==='light'||v.theme==='dark'||v.theme==='system')
const validReportHistory = (v:unknown) => obj(v) && v.id==='nutrition' &&
  str(v.exportedAt) && Number.isFinite(Date.parse(v.exportedAt)) &&
  new Date(v.exportedAt).toISOString()===v.exportedAt &&
  (v.through===undefined||dateValid(v.through)) &&
  (v.sinceStart===undefined||(dateValid(v.sinceStart)&&dateValid(v.through)&&v.sinceStart<=v.through)) &&
  (v.lastPeriod===undefined||(obj(v.lastPeriod)&&
    (v.lastPeriod.mode==='recent'||v.lastPeriod.mode==='since')&&
    dateValid(v.lastPeriod.start)&&dateValid(v.lastPeriod.end)&&v.lastPeriod.start<=v.lastPeriod.end))
export function validateBackup(value:unknown):Backup {
  if(!obj(value) || (value.version!==1 && value.version!==2) ||
    !list(value.foods,r=>str(r.id)&&str(r.name)&&str(r.unit)&&num(r.weight)&&imageValid(r.image)&&nutrition(r.nutrition)&&nutrition(r.input)&&typeof r.favorite==='boolean'&&typeof r.archived==='boolean'&&(r.deleted===undefined||typeof r.deleted==='boolean')&&integer(r.order)&&(r.mode==='unit'||(r.mode==='100g'&&r.weight>0)),r=>r.id) ||
    !list(value.days,r=>dateValid(r.date)&&(r.kind==='rest'||r.kind==='training')&&goalPair(r.goals)&&typeof r.completed==='boolean',r=>r.date) ||
    !list(value.entries,r=>dateValid(r.date)&&str(r.foodId)&&str(r.name)&&str(r.unit)&&integer(r.count)&&r.count>0&&nutrition(r.nutrition),r=>JSON.stringify([r.date,r.foodId])) ||
    !list(value.sets,r=>str(r.id)&&str(r.name)&&list(r.items,x=>str(x.id)&&integer(x.count)&&x.count>0,x=>x.id),r=>r.id) ||
    !list(value.goals,r=>str(r.id)&&dateValid(r.date)&&goalPair(r.goals),r=>r.id) ||
    !(value.settings===undefined || validSettings(value.settings)) ||
    (value.version===2 && value.reportHistory!==undefined && !validReportHistory(value.reportHistory))) throw new Error('バックアップの形式またはバージョンが無効です。')
  const data={...value,reportHistory:value.version===2?value.reportHistory:undefined} as Backup
  const foods=new Set(data.foods.map(food=>food.id))
  const dates=new Set(data.days.map(day=>day.date))
  if(data.entries.some(entry=>!dates.has(entry.date)||!foods.has(entry.foodId))||data.sets.some(set=>set.items.some(item=>!foods.has(item.id)))) throw new Error('バックアップ内の参照先が見つかりません。')
  return data
}
export async function restore(value:unknown) {
  const data=validateBackup(value)
  await db.transaction('rw',db.tables,async()=>{
    // Keep deletion markers when restoring a backup made before the deletion.
    const deleted=new Map((await db.foods.toArray()).filter(food=>food.deleted).map(food=>[food.id,food]))
    for(const food of data.foods) if(food.deleted) deleted.set(food.id,food)
    const foods=[...data.foods.filter(food=>!deleted.has(food.id)),...deleted.values()]
    const sets=data.sets.map(set=>({...set,items:set.items.filter(item=>!deleted.has(item.id))}))
    for(const table of [db.foods,db.sets,db.days,db.entries,db.goals,db.settings]) await table.clear()
    await db.foods.bulkAdd(foods)
    await db.sets.bulkAdd(sets)
    await db.days.bulkAdd(data.days)
    await db.entries.bulkAdd(data.entries)
    await db.goals.bulkAdd(data.goals)
    if(data.settings) await db.settings.add(data.settings)
    if(data.version===2) {
      await db.reportHistory.clear()
      if(data.reportHistory) await db.reportHistory.add(data.reportHistory)
    }
  })
}

