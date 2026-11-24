import { useSettingsNavigation } from './settingsNavigation'
import { useEdgeBack } from './edgeBack'
import AppIcon from './AppIcon'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { createRoot } from 'react-dom/client'
import { liveQuery } from 'dexie'
import { Activity, CalendarDays, ChartNoAxesColumnIncreasing, Check, ChevronLeft, ChevronRight, ClipboardList, Dumbbell, Layers, Minus, Plus, Settings as Gear, Star, Trash2, Utensils, X } from 'lucide-react'
import { backupReminderDue, refreshDayStates, recordState, changeQuantities, dateObject, db, deleteFood, fmt, goalAt, initialGoals, localDate, newId, periodDates, restore, saveGoals, saveSet, shift, snapshot, sortFoods, sortSets, totals, updateDay, validateBackup, zero, type Food, type FoodSet, type Metric, type Settings, type Undo } from './model'
import { formatQuantity } from './quantity'
import './style.css'
import { nutritionDraft, parseGoal } from './nutritionInput'
import FoodList from './FoodList'
import SetList from './SetList'
import MealBreakdown from './MealBreakdown'
import CloudBackupPanel from './CloudBackupPanel'
import { useCloudBackup } from './useCloudBackup'
import { restoreCloudBackup } from './cloudStorage'
import AnalysisScreen from './AnalysisScreen'
import { dayLabel, signed, status } from './display'
import { ErrorNotice, Modal, NutrientFields, NutritionCard, PanelTitle } from './ui'
import { FoodEditor, SetEditor } from './foodEditors'

const tabs = [['記録',ClipboardList],['分析',ChartNoAxesColumnIncreasing],['食品',Utensils],['設定',Gear]] as const
type Tab=typeof tabs[number][0]
const blankFood=():Food=>({id:newId(),name:'',unit:'',weight:0,image:'',nutrition:zero,input:zero,mode:'unit',favorite:false,archived:false,order:0})

function App() {
  const [data,setData]=useState<Awaited<ReturnType<typeof snapshot>>>()
  const cloud=useCloudBackup(!!data)
  const [dismissedReminder,setDismissedReminder]=useState('')
  const [today,setToday]=useState(localDate)
  const [calendarDate,setCalendarDate]=useState(today)
  const [tab,setTab]=useState<Tab>('記録')
  const [calendarEditing,setCalendarEditing]=useState(false)
  const [month,setMonth]=useState(today.slice(0,7)+'-01')
  const [period,setPeriod]=useState(today)
  const [monthly,setMonthly]=useState(false)
  const [metric,setMetric]=useState<Metric>('kcal')
  const [mealOpen,setMealOpen]=useState(false)
  const [foodEdit,setFoodEdit]=useState<Food>()
  const [setEdit,setSetEdit]=useState<FoodSet>()
  const [foodView,setFoodView]=useState<'active'|'archive'|'sets'>('active')
  const [undo,setUndo]=useState<Undo>()
  const [foodDelete,setFoodDelete]=useState<Food>()
  const [note,setNote]=useState('')
  const [pendingBackup,setPendingBackup]=useState<ReturnType<typeof validateBackup>>()
  const [goals,setGoals]=useState(()=>({training:nutritionDraft(initialGoals.training),rest:nutritionDraft(initialGoals.rest)}))
  const [applicable,setApplicable]=useState(initialGoals)
  const goalBaseline=useRef(JSON.stringify(goals))
  const iconDirty=useRef(false)
  const markIconDirty=useCallback((dirty:boolean)=>{iconDirty.current=dirty},[])
  const operationBusy=useRef(false)
  const [busy,setBusy]=useState(false)
  const fail=(error:unknown)=>setNote(error instanceof Error?error.message:String(error))
  const blocked=()=>busy||!!foodEdit||!!setEdit||!!foodDelete||!!pendingBackup||mealOpen||
    document.activeElement?.matches('input,textarea,select,[contenteditable="true"]')||
    settingsView==='backup'&&(!!document.querySelector('.cloud-backup fieldset:disabled')||Array.from(document.querySelectorAll<HTMLInputElement|HTMLSelectElement>('.cloud-backup input,.cloud-backup select')).some(field=>!!field.value))||
    settingsView==='icon'&&iconDirty.current||settingsView==='goals'&&JSON.stringify(goals)!==goalBaseline.current
  const {view:settingsView,open:openSettings,back:backSettings,leave:leaveSettings}=useSettingsNavigation(blocked,()=>{
    setTab('設定');setCalendarEditing(false);setMealOpen(false);iconDirty.current=false;window.scrollTo(0,0)
  })
  const date=tab==='設定'&&settingsView==='history'?calendarDate:today
  useEdgeBack(tab==='設定'&&settingsView!=='main',blocked,()=>backSettings())
  useEffect(()=>{
    const sub=liveQuery(snapshot).subscribe({next:setData,error:fail})
    return ()=>sub.unsubscribe()
  },[])
  useEffect(()=>{
    const check=()=>{const current=localDate();setToday(current);void refreshDayStates(current).catch(fail)}
    check()
    const timer=window.setInterval(check,15000)
    const midnight=window.setTimeout(check,Math.max(1,new Date(today+'T00:00:00+09:00').getTime()+86400000-Date.now()+20))
    document.addEventListener('visibilitychange',check)
    window.addEventListener('focus',check)
    window.addEventListener('pageshow',check)
    return ()=>{window.clearInterval(timer);window.clearTimeout(midnight);document.removeEventListener('visibilitychange',check);window.removeEventListener('focus',check);window.removeEventListener('pageshow',check)}
  },[today])
  useEffect(()=>{
    const sub=liveQuery(()=>goalAt(date)).subscribe({next:setApplicable,error:fail});return ()=>sub.unsubscribe()
  },[date])
  useEffect(()=>{document.documentElement.dataset.theme=data?.settings?.theme??'system'},[data?.settings?.theme])
  function run(action:()=>Promise<unknown>) { setNote('');void action().catch(fail) }
  function exclusive(action:()=>Promise<unknown>) {
    if(operationBusy.current)return
    operationBusy.current=true
    setBusy(true)
    run(async()=>{try{await action()}finally{operationBusy.current=false;setBusy(false)}})
  }
  const foods=sortFoods((data?.foods??[]).filter(food=>!food.deleted))
  const active=foods.filter(food=>!food.archived)
  const entries=(data?.entries??[]).filter(entry=>entry.date===date)
  const savedDay=data?.days.find(item=>item.date===date)
  const day=savedDay?recordState(savedDay,today):undefined
  const goal=(day?.goals??applicable)[day?.kind??'rest']
  const used=totals(entries)
  const sets=sortSets(data?.sets??[])
  const calendar=periodDates(month,true)
  const navigate=(next:Tab)=>{
    leaveSettings()
    setToday(localDate());setCalendarEditing(false);setMealOpen(false);setTab(next);window.scrollTo(0,0)
  }
  const reminder=data&&dismissedReminder!==today&&backupReminderDue(today)&&(data.foods.length>0||data.days.length>0)
  const recordEditor=<>
      <div className="day-type"><button aria-pressed={day?.kind!=='training'}  onClick={()=>run(()=>updateDay(date,{kind:'rest'}))}>休養日</button><button aria-pressed={day?.kind==='training'}  onClick={()=>run(()=>updateDay(date,{kind:'training'}))}><Dumbbell size={15}/>筋トレ日</button></div>
      <NutritionCard used={used} goal={goal} open={()=>setMealOpen(true)}/>
      <section className="block food-sets"><PanelTitle icon={Layers} title="食品セット" action={undo?.date===date&&<button className="link set-undo" disabled={busy} onClick={()=>exclusive(async()=>{await changeQuantities(date,undo.items.map(row=>({...row,count:-row.count})),'undo');setUndo(undefined)})}>直前の追加を取り消す</button>}/>
        {sets.length>0&&<div className="scroll-row">{sets.map(item=><button className="set card" disabled={busy||!item.items.length||item.items.some(row=>!foods.some(food=>food.id===row.id))} key={item.id} onClick={()=>exclusive(async()=>{const result=await changeQuantities(date,item.items,'set');setUndo(result)})}><span className="tile-icon"><Layers size={19}/></span><strong>{item.name}</strong></button>)}
        </div>}
      </section>
      <section className="block"><PanelTitle icon={Utensils} title="食品一覧"/>
      <div className="food-grid">{active.map(food=>{
        const recorded=entries.find(entry=>entry.foodId===food.id)
        const count=recorded?.count??0
        const FoodInfo=date===today?'button':'div'
        const name=recorded?.name??food.name
        const nutrition=recorded?.nutrition??food.nutrition
        const unit=recorded?.unit??food.unit
        return <article className="card food" key={food.id}><FoodInfo className="food-info" onClick={date===today?()=>setFoodEdit(food):undefined}>{food.image?<img className="thumb" src={food.image} alt=""/>:<span className="thumb"><Utensils size={23}/></span>}<span><strong>{name} {food.favorite&&<Star size={13} className="star" fill="currentColor"/>}</strong><small>{fmt(nutrition.kcal)} kcal / {unit}</small></span></FoodInfo><div className="stepper"><button aria-label={name+'を1減らす'} disabled={!count} onClick={()=>run(()=>changeQuantities(date,[{id:food.id,count:-1}]))}><Minus size={19}/></button><output aria-label={name+'の数量'}>{count}</output><button aria-label={name+'を1増やす'}  onClick={()=>run(()=>changeQuantities(date,[{id:food.id,count:1}]))}><Plus size={19}/></button></div></article>
      })}</div>
      {!active.length&&<div className="empty card"><span className="tile-icon"><Utensils size={22}/></span><h3>よく食べる食品を登録</h3><p>下部メニューの「食品」から登録できます。</p></div>}
      {entries.filter(entry=>!active.some(food=>food.id===entry.foodId)).map(entry=><div className="card archived-entry" key={entry.foodId}><span>{entry.name} · {formatQuantity(entry.unit,entry.count)}</span><button  onClick={()=>run(()=>changeQuantities(date,[{id:entry.foodId,count:-1}]))} aria-label={entry.name+'を1減らす'}><Minus size={18}/></button>{(date<today||foods.some(food=>food.id===entry.foodId&&food.archived))&&<button aria-label={entry.name+'を1増やす'} onClick={()=>run(()=>changeQuantities(date,[{id:entry.foodId,count:1}]))}><Plus size={18}/></button>}</div>)}
      </section>
  </>
  const detail=<><NutritionCard used={used} goal={goal}/><section className="card detail"><PanelTitle icon={ClipboardList} title="記録の詳細"/><p>{status(day)} · {day?.kind==='training'?'筋トレ日':'休養日'} · 目標との差 {day?signed(used.kcal-goal.kcal)+' kcal':'—'}</p>{entries.map(entry=><div className="detail-row" key={entry.foodId}><span>{entry.name}</span><strong>{formatQuantity(entry.unit,entry.count)}</strong></div>)}{!entries.length&&<p className="muted">食品の記録はありません。</p>}</section></>

  return <ErrorNotice.Provider value={note}>
    <header className="top"><div className="top-inner"><button className="brand" onClick={()=>{setCalendarDate(today);navigate('記録')}}><span><Activity size={21}/></span>MyDiet</button><span className="top-date"><CalendarDays size={15}/>{dayLabel(today)}</span></div></header>
    <main className={tab==='食品'&&foodView!=='archive'?'with-create-fab':undefined}>
    {reminder&&<section className="card detail" aria-label="月末のバックアップ">
      <p role="status">月末です。食事記録をバックアップしましょう。</p>
      <div className="row"><button className="primary" onClick={()=>{setDismissedReminder(today);openSettings('backup')}}>バックアップを開く</button><button onClick={()=>setDismissedReminder(today)}>あとで</button></div>
    </section>}
    {tab==='記録'&&<>
      {recordEditor}
    </>}
    {tab==='設定'&&settingsView==='history'&&<>
      <h1>履歴</h1>
      <section className="card calendar"><div className="calendar-head"><button className="icon" aria-label="前の月" onClick={()=>setMonth(shift(month,-1).slice(0,7)+'-01')}><ChevronLeft/></button><strong>{dateObject(month).toLocaleDateString('ja-JP',{timeZone:'Asia/Tokyo',year:'numeric',month:'long'})}</strong><button className="icon" aria-label="次の月" onClick={()=>setMonth(shift(calendar.at(-1)!,1))}><ChevronRight/></button></div>
      <div className="calendar-grid">{['月','火','水','木','金','土','日'].map(value=><span key={value}>{value}</span>)}{Array.from({length:(new Date(month+'T00:00:00Z').getUTCDay()+6)%7},(_,i)=><span key={'blank'+i}/>)}{calendar.map(value=>{const saved=data?.days.find(x=>x.date===value);const record=saved?recordState(saved,today):undefined;return <button key={value} aria-pressed={date===value} aria-label={dayLabel(value)+' '+status(record)} disabled={value>today} onClick={()=>{setCalendarDate(value);setCalendarEditing(false);setMealOpen(false)}}>{Number(value.slice(-2))}<i>{record?.completed?<Check size={13}/>:record?'●':''}</i></button>})}</div></section>
      <div className="section-title"><h2>{dayLabel(date)}</h2><button className="link" disabled={date>today} onClick={()=>setCalendarEditing(value=>!value)}>{calendarEditing?'詳細に戻る':'この日の記録を編集'}</button></div>{calendarEditing&&date<=today?recordEditor:detail}
    </>}
    {tab==='分析'&&<AnalysisScreen {...{today,data,period,setPeriod,monthly,setMonthly,metric,setMetric}}/>}
    {tab==='食品'&&<>
      <div className="section-title"><h1>食品管理</h1></div>
      <div className="segment"><button aria-pressed={foodView==='active'} onClick={()=>setFoodView('active')}>食品</button><button aria-pressed={foodView==='sets'} onClick={()=>setFoodView('sets')}>セット</button><button aria-pressed={foodView==='archive'} onClick={()=>setFoodView('archive')}>アーカイブ</button></div>
      {foodView==='sets'?<section className="card detail"><SetList sets={sets} edit={setSetEdit} run={run}/></section>:<section className="card detail"><FoodList foods={foodView==='archive'?foods.filter(food=>food.archived):active} edit={setFoodEdit} remove={food=>{setNote('');setFoodDelete(food)}} run={run}/></section>}
    </>}
    {tab==='設定'&&settingsView!=='history'&&<>
      <h1>{settingsView==='icon'?'アプリアイコン':settingsView==='goals'?'目標設定':settingsView==='backup'?'バックアップ・復元':'設定'}</h1>
      {settingsView==='main'&&<section className="card detail"><PanelTitle icon={Gear} title="アプリ設定"/><div className="detail-row"><button className="link" onClick={()=>openSettings('icon')}>アプリアイコン <ChevronRight size={17}/></button></div><div className="detail-row"><button className="link" onClick={()=>run(async()=>{const saved=await goalAt(today);const next={training:nutritionDraft(saved.training),rest:nutritionDraft(saved.rest)};goalBaseline.current=JSON.stringify(next);setGoals(next);openSettings('goals')})}>筋トレ日・休養日の目標 <ChevronRight size={17}/></button></div><div className="detail-row"><button className="link" onClick={()=>openSettings('backup')}>バックアップ・復元 <ChevronRight size={17}/></button></div><div className="detail-row"><button className="link" onClick={()=>openSettings('history')}>履歴 <ChevronRight size={17}/></button></div><label>外観<select value={data?.settings?.theme??'system'} onChange={e=>{const theme=e.target.value as Settings['theme'];run(()=>db.settings.put({id:'app',theme}))}}><option value="system">端末の設定に合わせる</option><option value="light">ライト</option><option value="dark">ダーク</option></select></label></section>}
      {settingsView==='icon'&&<AppIcon onDirty={markIconDirty}/>}
      {settingsView==='goals'&&<form onSubmit={(e:FormEvent)=>{e.preventDefault();const training=parseGoal(goals.training);const rest=parseGoal(goals.rest);if(training&&rest)exclusive(async()=>{await saveGoals({training,rest});goalBaseline.current=JSON.stringify(goals)})}}>{(['training','rest'] as const).map(kind=><section className="card detail" key={kind}><h2>{kind==='training'?'筋トレ日':'休養日'}</h2><NutrientFields autoCalories value={goals[kind]} change={value=>setGoals({...goals,[kind]:value})}/></section>)}<button className="primary" disabled={busy}>目標を保存</button></form>}
      {settingsView==='backup'&&<section className="card detail">
        <button className="primary" disabled={!data} onClick={()=>run(async()=>{
          if(!data)return
          const file=new File([JSON.stringify(data,null,2)],'mydiet-'+localDate()+'.json',{type:'application/json'})
          const shareData={files:[file]}
          if(navigator.share&&navigator.canShare?.(shareData)){
            try {await navigator.share(shareData)}
            catch(error){if(!(error instanceof DOMException&&error.name==='AbortError'))throw error}
            return
          }
          const url=URL.createObjectURL(new Blob([file],{type:'application/octet-stream'}))
          const link=document.createElement('a')
          link.href=url
          link.download=file.name
          document.body.append(link)
          link.click()
          link.remove()
          window.setTimeout(()=>URL.revokeObjectURL(url),30000)
        })}>JSONをエクスポート</button><label>復元するファイル<input type="file" accept=".json,application/json" onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)run(async()=>setPendingBackup(validateBackup(JSON.parse(await file.text()))))}}/></label></section>}
      {settingsView==='backup'&&<CloudBackupPanel cloud={cloud} restore={async next=>{
        await restoreCloudBackup(next,cloud.recoveryKey)
        setUndo(undefined)
        return true
      }}/>}
    </>}
    </main>
    {tab==='食品'&&foodView!=='archive'&&!foodEdit&&!setEdit&&<button className="primary create-fab" aria-label={foodView==='sets'?'食品セットを新規作成':'食品を新規作成'} onClick={()=>foodView==='sets'?setSetEdit({id:newId(),name:'',items:[]}):setFoodEdit(blankFood())}><Plus size={32} aria-hidden="true"/></button>}
    <nav className="nav" aria-label="メインメニュー"><div>{tabs.map(([name,Icon])=><button key={name} aria-current={tab===name?'page':undefined} onClick={()=>navigate(name)}><Icon size={21}/><span>{name}</span></button>)}</div></nav>
    {mealOpen&&<MealBreakdown date={date} entries={entries} close={()=>setMealOpen(false)}/>}
    {foodEdit&&<FoodEditor food={foodEdit} close={()=>setFoodEdit(undefined)} fail={fail} save={food=>exclusive(async()=>{
      await db.transaction('rw',db.foods,async()=>{const existing=await db.foods.get(food.id);if(existing?.deleted)throw new Error('この食品は削除済みです。');const all=await db.foods.toArray();await db.foods.put({...food,order:existing?.order??Math.max(-1,...all.map(x=>x.order))+1})})
      setFoodEdit(undefined)
    })}/>}
    {setEdit&&<SetEditor item={setEdit} foods={foods} close={()=>setSetEdit(undefined)} save={item=>exclusive(async()=>{await saveSet(item);setSetEdit(undefined)})} remove={()=>{if(confirm('このセットを削除しますか？'))exclusive(async()=>{await db.sets.delete(setEdit.id);setSetEdit(undefined)})}}/>}
    {foodDelete&&<Modal title="食品を削除" close={()=>{if(!busy)setFoodDelete(undefined)}}>
      <p>「{foodDelete.name}」を削除しますか？削除した食品は通常の操作では復元できません。食事記録は保持されます。</p>
      {sets.some(set=>set.items.some(item=>item.id===foodDelete.id))&&<>
        <p>以下のセットからこの食品を取り除きます。空になったセットは、食品を追加するまで一括追加できません。</p>
        <ul>{sets.filter(set=>set.items.some(item=>item.id===foodDelete.id)).map(set=><li key={set.id}>{set.name}</li>)}</ul>
      </>}
      <div className="row"><button disabled={busy} onClick={()=>setFoodDelete(undefined)}>キャンセル</button><button className="danger" disabled={busy} onClick={()=>exclusive(async()=>{await deleteFood(foodDelete.id);setFoodDelete(undefined)})}>削除する</button></div>
    </Modal>}
    {pendingBackup&&<Modal title="復元の確認" close={()=>setPendingBackup(undefined)}><p>現在の端末内データを、食品 {pendingBackup.foods.length} 件と記録 {pendingBackup.days.length} 日分を含むバックアップで置き換えます。</p><button className="primary wide" disabled={busy} onClick={()=>exclusive(async()=>{await restore(pendingBackup);setPendingBackup(undefined);setUndo(undefined)})}>復元する</button></Modal>}
    {note&&!foodEdit&&!setEdit&&!foodDelete&&!pendingBackup&&<div className="toast" role="status">{note}<button aria-label="通知を閉じる" onClick={()=>setNote('')}><X size={17}/></button></div>}
  </ErrorNotice.Provider>
}
createRoot(document.getElementById('root')!).render(<App/>)
if(import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load',()=>{
    void navigator.serviceWorker.register(import.meta.env.BASE_URL+'sw.js',{updateViaCache:'none'}).then(registration=>{
      document.addEventListener('visibilitychange',()=>{
        if(document.visibilityState==='visible')void registration.update().catch(()=>{})
      })
    }).catch(console.error)
  })
}

