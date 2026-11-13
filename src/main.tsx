import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { liveQuery } from 'dexie'
import { Activity, ArrowDown, ArrowUp, CalendarDays, ChartNoAxesColumnIncreasing, Check, ChevronLeft, ChevronRight, ClipboardList, Dumbbell, Layers, Minus, Plus, Search, Settings as Gear, Star, Utensils, X, type LucideIcon } from 'lucide-react'
import { average, changeQuantities, dateObject, db, fmt, goalAt, initialGoals, labels, localDate, mapping, newId, nutrients, periodDates, restore, saveGoals, shift, snapshot, sortFoods, summarize, totals, units, updateDay, validateBackup, zero, type Day, type Food, type FoodSet, type Goals, type Metric, type Nutrition, type Settings, type Undo } from './model'
import './style.css'

const tabs = [['記録',ClipboardList],['分析',ChartNoAxesColumnIncreasing],['カレンダー',CalendarDays],['食品',Utensils],['設定',Gear]] as const
type Tab=typeof tabs[number][0]
const dayLabel=(date:string)=>dateObject(date).toLocaleDateString('ja-JP',{month:'long',day:'numeric',weekday:'short'})
const signed=(value:number)=>(value>0?'+':'')+fmt(value)
const status=(day?:Day)=>day?.completed?'記録完了':day?'記録中':'未記録'
const balance=(used:number,goal:number,unit:string)=>used>goal?'超過 '+fmt(used-goal)+' '+unit:'残り '+fmt(goal-used)+' '+unit
const progress=(used:number,goal:number)=>goal>0?Math.min(used/goal,1):Number(used>0)
const blankFood=():Food=>({id:newId(),name:'',unit:'個',weight:0,image:'',nutrition:zero,input:zero,mode:'unit',favorite:false,archived:false,order:0})

function PanelTitle({icon:Icon,title,action}:{icon:LucideIcon;title:string;action?:ReactNode}) {
  return <div className="section-title"><h2><Icon size={19}/>{title}</h2>{action}</div>
}
function NutritionCard({used,goal}:{used:Nutrition;goal:Nutrition}) {
  return <section className="nutrition card" aria-label="栄養サマリー">
    <div className="energy"><span className="caption">摂取カロリー</span><div className="ring" style={{background:'conic-gradient(var(--blue) '+(progress(used.kcal,goal.kcal)*100)+'%, var(--track) 0)'}}>
      <div><strong>{fmt(used.kcal)}</strong><small> / {fmt(goal.kcal)} kcal</small></div>
    </div><span className={'balance '+(used.kcal>goal.kcal?'over':'')}>{balance(used.kcal,goal.kcal,'kcal')}</span></div>
    <div className="macros">{(['p','f','c'] as const).map(key=><div className={'macro '+key} key={key}><div className="macro-head"><strong><b>{key.toUpperCase()}</b> {labels[key]}</strong><span>{fmt(used[key])} / {fmt(goal[key])} g</span></div>
      <div className="track"><i style={{width:progress(used[key],goal[key])*100+'%'}}/></div><small className={used[key]>goal[key]?'over':''}>{balance(used[key],goal[key],'g')}</small></div>)}</div>
  </section>
}
function Modal({title,children,close}:{title:string;children:ReactNode;close:()=>void}) {
  const [node,setNode]=useState<HTMLDialogElement|null>(null)
  useEffect(()=>{if(node&&!node.open)node.showModal()},[node])
  return <dialog ref={setNode} onCancel={event=>{event.preventDefault();close()}}><div className="dialog-title"><h2>{title}</h2><button type="button" className="icon" onClick={close} aria-label="閉じる"><X/></button></div>{children}</dialog>
}
function NutrientFields({value,change}:{value:Nutrition;change:(value:Nutrition)=>void}) {
  return <div className="form-grid">{nutrients.map(key=><label key={key}>{labels[key]}（{units[key]}）<input type="number" min="0" max="1000000" step="any" required inputMode="decimal" value={value[key]} onChange={e=>change({...value,[key]:Number(e.target.value)})}/></label>)}</div>
}
function FoodEditor({food,save,close,fail}:{food:Food;save:(food:Food)=>void;close:()=>void;fail:(error:unknown)=>void}) {
  const [draft,set]=useState(food)
  const [reading,setReading]=useState(false)
  const nutrition=mapping(key=>draft.input[key]*(draft.mode==='100g'?draft.weight/100:1))
  return <Modal title={food.name?'食品を編集':'食品を登録'} close={close}><form onSubmit={e=>{e.preventDefault();if(draft.name.trim()&&draft.unit.trim())save({...draft,name:draft.name.trim(),unit:draft.unit.trim(),nutrition})}}>
    <label>食品名<input required maxLength={80} value={draft.name} onChange={e=>set({...draft,name:e.target.value})}/></label>
    <div className="form-grid"><label>単位<input required maxLength={20} value={draft.unit} onChange={e=>set({...draft,unit:e.target.value})}/></label><label>1単位の重量（g）<input type="number" min={draft.mode==='100g'?0.001:0} max="1000000" step="any" required value={draft.weight} onChange={e=>set({...draft,weight:Number(e.target.value)})}/></label></div>
    <label>食品画像<input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/heic,image/heif" onChange={e=>{
      const file=e.target.files?.[0]; if(!file)return
      if(!/^image\/(png|jpeg|webp|gif|avif|heic|heif)$/i.test(file.type)||file.size>5*1024*1024){fail(new Error('対応する5 MB以下の画像を選択してください。'));return}
      const reader=new FileReader();setReading(true)
      reader.onload=()=>{set(current=>({...current,image:String(reader.result)}));setReading(false)}
      reader.onerror=()=>{setReading(false);fail(new Error('画像を読み込めませんでした。'))};reader.readAsDataURL(file)
    }}/></label>
    {draft.image&&<div className="row"><img className="thumb" src={draft.image} alt="食品画像"/><button type="button" onClick={()=>set({...draft,image:''})}>画像を外す</button></div>}
    <div className="segment"><button type="button" aria-pressed={draft.mode==='unit'} onClick={()=>set({...draft,mode:'unit'})}>1単位あたり</button><button type="button" aria-pressed={draft.mode==='100g'} onClick={()=>set({...draft,mode:'100g'})}>100gあたり</button></div>
    <NutrientFields value={draft.input} change={input=>set({...draft,input})}/>
    <div className="notice"><strong>1{draft.unit}あたり</strong><div>{nutrients.map(key=><span key={key}>{key==='kcal'?'':key.toUpperCase()+' '}{fmt(nutrition[key])} {units[key]}　</span>)}</div></div>
    <label className="row"><input type="checkbox" checked={draft.favorite} onChange={e=>set({...draft,favorite:e.target.checked})}/>お気に入り</label>
    <button className="primary wide" disabled={reading}>保存する</button>
  </form></Modal>
}
function SetEditor({item,foods,save,remove,close}:{item:FoodSet;foods:Food[];save:(item:FoodSet)=>void;remove:()=>void;close:()=>void}) {
  const [draft,set]=useState(item)
  const [selected,select]=useState('')
  const available=foods.filter(food=>!food.archived&&!draft.items.some(row=>row.id===food.id))
  return <Modal title={item.name?'食品セットを編集':'食品セットを作成'} close={close}><form onSubmit={e=>{e.preventDefault();if(draft.name.trim()&&draft.items.length)save({...draft,name:draft.name.trim()})}}>
    <label>セット名<input required maxLength={80} value={draft.name} onChange={e=>set({...draft,name:e.target.value})}/></label>
    {draft.items.map(row=><div className="set-row" key={row.id}><span>{foods.find(food=>food.id===row.id)?.name}{foods.find(food=>food.id===row.id)?.archived?'（アーカイブ済み）':''}</span><input aria-label="数量" type="number" inputMode="numeric" required min="1" max="9999" value={row.count} onChange={e=>set({...draft,items:draft.items.map(x=>x.id===row.id?{...x,count:Number(e.target.value)}:x)})}/><button type="button" aria-label="食品を外す" onClick={()=>set({...draft,items:draft.items.filter(x=>x.id!==row.id)})}><X size={17}/></button></div>)}
    <div className="row"><select aria-label="追加する食品" value={selected} onChange={e=>select(e.target.value)}><option value="">食品を選ぶ</option>{available.map(food=><option key={food.id} value={food.id}>{food.name}</option>)}</select><button type="button" disabled={!selected} onClick={()=>{set({...draft,items:[...draft.items,{id:selected,count:1}]});select('')}}>追加</button></div>
    <button className="primary wide" disabled={!draft.items.length}>保存する</button>
    {item.name&&<button className="wide danger" type="button" onClick={remove}>セットを削除</button>}
  </form></Modal>
}

function App() {
  const [data,setData]=useState<Awaited<ReturnType<typeof snapshot>>>()
  const [today,setToday]=useState(localDate)
  const [date,setDate]=useState(today)
  const [tab,setTab]=useState<Tab>('記録')
  const [query,setQuery]=useState('')
  const [month,setMonth]=useState(today.slice(0,7)+'-01')
  const [period,setPeriod]=useState(today)
  const [monthly,setMonthly]=useState(false)
  const [metric,setMetric]=useState<Metric>('kcal')
  const [foodEdit,setFoodEdit]=useState<Food>()
  const [setEdit,setSetEdit]=useState<FoodSet>()
  const [foodView,setFoodView]=useState<'active'|'archive'|'sets'>('active')
  const [undo,setUndo]=useState<Undo>()
  const [note,setNote]=useState('')
  const [pendingBackup,setPendingBackup]=useState<ReturnType<typeof validateBackup>>()
  const [goals,setGoals]=useState(initialGoals)
  const [applicable,setApplicable]=useState(initialGoals)
  const [settingsView,setSettingsView]=useState<'main'|'goals'|'backup'>('main')
  const [busy,setBusy]=useState(false)
  const fail=(error:unknown)=>setNote(error instanceof Error?error.message:String(error))
  useEffect(()=>{
    const sub=liveQuery(snapshot).subscribe({next:setData,error:fail})
    return ()=>sub.unsubscribe()
  },[])
  useEffect(()=>{
    const check=()=>{const current=localDate();if(current!==today){setToday(current);setDate(previous=>previous===today?current:previous)}}
    const timer=window.setInterval(check,15000)
    document.addEventListener('visibilitychange',check)
    return ()=>{window.clearInterval(timer);document.removeEventListener('visibilitychange',check)}
  },[today])
  useEffect(()=>{
    const sub=liveQuery(()=>goalAt(date)).subscribe({next:setApplicable,error:fail});return ()=>sub.unsubscribe()
  },[date])
  useEffect(()=>{document.documentElement.dataset.theme=data?.settings?.theme??'system'},[data?.settings?.theme])
  function run(action:()=>Promise<unknown>) { void action().catch(fail) }
  function exclusive(action:()=>Promise<unknown>) {
    if(busy)return
    setBusy(true)
    run(async()=>{try{await action()}finally{setBusy(false)}})
  }
  const foods=sortFoods(data?.foods??[])
  const active=foods.filter(food=>!food.archived)
  const entries=(data?.entries??[]).filter(entry=>entry.date===date)
  const day=data?.days.find(item=>item.date===date)
  const goal=(day?.goals??applicable)[day?.kind??'rest']
  const used=totals(entries)
  const shown=active.filter(food=>food.name.normalize('NFKC').toLocaleLowerCase().includes(query.trim().normalize('NFKC').toLocaleLowerCase()))
  const sets=data?.sets??[]
  const dates=periodDates(period,monthly)
  const analyzed=summarize(data?.days??[],data?.entries??[],dates)
  const completed=analyzed.filter(row=>row.completed)
  const week=summarize(data?.days??[],data?.entries??[],periodDates(period,false)).filter(row=>row.completed)
  const weekUsed=week.reduce((sum,row)=>sum+row.total.kcal,0)
  const weekGoal=week.reduce((sum,row)=>sum+row.goals[row.kind].kcal,0)
  const means=average(analyzed)
  const max=Math.max(1,...analyzed.map(row=>row.total[metric]))
  const calendar=periodDates(month,true)
  async function move(food:Food,offset:number) {
    await db.transaction('rw',db.foods,async()=>{
      const same=sortFoods(await db.foods.toArray()).filter(x=>!x.archived&&x.favorite===food.favorite)
      const index=same.findIndex(x=>x.id===food.id)
      if(index<0||!same[index+offset])return
      ;[same[index],same[index+offset]]=[same[index+offset],same[index]]
      await db.foods.bulkPut(same.map((x,order)=>({...x,order})))
    })
  }
  const navigate=(next:Tab)=>{setTab(next);window.scrollTo(0,0)}
  const dayControls=<div className="date-row"><button className="icon" aria-label="前の日" onClick={()=>setDate(shift(date,-1))}><ChevronLeft size={19}/></button><label className="date-picker"><span>{date===today?'今日 · ':''}{dayLabel(date)}</span><input type="date" aria-label="記録日" value={date} onChange={e=>{if(e.target.value)setDate(e.target.value)}}/></label><button className="icon" aria-label="次の日" onClick={()=>setDate(shift(date,1))}><ChevronRight size={19}/></button></div>
  const detail=<><NutritionCard used={used} goal={goal}/><section className="card detail"><PanelTitle icon={ClipboardList} title="記録の詳細"/><p>{status(day)} · {day?.kind==='training'?'筋トレ日':'休養日'} · 目標との差 {day?signed(used.kcal-goal.kcal)+' kcal':'—'}</p>{entries.map(entry=><div className="detail-row" key={entry.foodId}><span>{entry.name}</span><strong>{entry.count} {entry.unit}</strong></div>)}{!entries.length&&<p className="muted">食品の記録はありません。</p>}</section></>

  return <>
    <header className="top"><div className="top-inner"><button className="brand" onClick={()=>{setDate(today);navigate('記録')}}><span><Activity size={21}/></span>MyDiet</button><span className="top-date"><CalendarDays size={15}/>{dayLabel(today)}</span></div></header>
    <main>
    {tab==='記録'&&<>
      <label className="search"><Search size={20}/><input aria-label="食品を検索" placeholder="食品名で検索" value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<button className="icon" aria-label="検索をクリア" onClick={()=>setQuery('')}><X size={18}/></button>}</label>
      <div className="hero"><div><div className="eyebrow"><span/>{status(day)}</div><h1>{date===today?'今日の食事記録':'日別の食事記録'}</h1></div>{dayControls}</div>
      <div className="day-type"><button aria-pressed={day?.kind!=='training'} disabled={day?.completed} onClick={()=>run(()=>updateDay(date,{kind:'rest'}))}>休養日</button><button aria-pressed={day?.kind==='training'} disabled={day?.completed} onClick={()=>run(()=>updateDay(date,{kind:'training'}))}><Dumbbell size={15}/>筋トレ日</button></div>
      <NutritionCard used={used} goal={goal}/>
      <section className="block"><PanelTitle icon={Layers} title="食品セット" action={<button className="link" onClick={()=>{setFoodView('sets');navigate('食品')}}>管理 <ChevronRight size={16}/></button>}/>
        <div className="scroll-row">{sets.map(item=><button className="set card" disabled={day?.completed||busy||item.items.some(row=>!active.some(food=>food.id===row.id))} key={item.id} onClick={()=>exclusive(async()=>{const result=await changeQuantities(date,item.items,'set');setUndo(result);setNote(item.name+'を追加しました。')})}><span className="tile-icon"><Layers size={19}/></span><span><strong>{item.name}</strong><small>{item.items.length}種類</small></span><Plus size={18}/></button>)}
        <button className="set add-set" onClick={()=>setSetEdit({id:newId(),name:'',items:[]})}><Plus size={18}/>セットを作成</button></div>
        {undo?.date===date&&<button className="link undo" disabled={busy||day?.completed} onClick={()=>exclusive(async()=>{await changeQuantities(date,undo.items.map(row=>({...row,count:-row.count})),'undo');setUndo(undefined);setNote('セット追加を取り消しました。')})}>直前のセット追加を取り消す</button>}
      </section>
      <section className="block"><PanelTitle icon={Utensils} title="食品一覧" action={<button className="link" onClick={()=>setFoodEdit(blankFood())}><Plus size={17}/>食品を追加</button>}/>
      <div className="food-grid">{shown.map(food=>{
        const count=entries.find(entry=>entry.foodId===food.id)?.count??0
        return <article className="card food" key={food.id}><button className="food-info" onClick={()=>setFoodEdit(food)}>{food.image?<img className="thumb" src={food.image} alt=""/>:<span className="thumb"><Utensils size={23}/></span>}<span><strong>{food.name} {food.favorite&&<Star size={13} className="star" fill="currentColor"/>}</strong><small>{fmt(food.nutrition.kcal)} kcal / 1{food.unit}</small></span></button><div className="stepper"><button aria-label={food.name+'を1減らす'} disabled={!count||day?.completed} onClick={()=>run(()=>changeQuantities(date,[{id:food.id,count:-1}]))}><Minus size={19}/></button><output aria-label={food.name+'の数量'}>{count}</output><button aria-label={food.name+'を1増やす'} disabled={day?.completed} onClick={()=>run(()=>changeQuantities(date,[{id:food.id,count:1}]))}><Plus size={19}/></button></div></article>
      })}</div>
      {!shown.length&&<div className="empty card"><span className="tile-icon"><Utensils size={22}/></span><h3>{query?'一致する食品がありません':'よく食べる食品を登録'}</h3>{!query&&<><p>登録した食品は、＋・−ボタンで毎日かんたんに記録できます。</p><button className="primary" onClick={()=>setFoodEdit(blankFood())}><Plus size={18}/>最初の食品を登録</button></>}</div>}
      {entries.filter(entry=>!active.some(food=>food.id===entry.foodId)).map(entry=><div className="card archived-entry" key={entry.foodId}><span>{entry.name}（アーカイブ済み） × {entry.count}</span><button disabled={day?.completed} onClick={()=>run(()=>changeQuantities(date,[{id:entry.foodId,count:-1}]))} aria-label={entry.name+'を1減らす'}><Minus size={18}/></button></div>)}
      </section>
      <div className="finish"><button className="primary wide" disabled={!data||busy} onClick={()=>exclusive(async()=>{await updateDay(date,{completed:!day?.completed});setUndo(undefined)})}>{day?.completed?<ClipboardList size={19}/>:<Check size={20}/>} {day?.completed?'記録を再編集する':date===today?'今日の記録を完了する':'この日の記録を完了する'}</button></div>
    </>}
    {tab==='カレンダー'&&<>
      <h1>カレンダー</h1>
      <section className="card calendar"><div className="calendar-head"><button className="icon" aria-label="前の月" onClick={()=>setMonth(shift(month,-1).slice(0,7)+'-01')}><ChevronLeft/></button><strong>{dateObject(month).toLocaleDateString('ja-JP',{year:'numeric',month:'long'})}</strong><button className="icon" aria-label="次の月" onClick={()=>setMonth(shift(calendar.at(-1)!,1))}><ChevronRight/></button></div>
      <div className="calendar-grid">{['月','火','水','木','金','土','日'].map(value=><span key={value}>{value}</span>)}{Array.from({length:(dateObject(month).getDay()+6)%7},(_,i)=><span key={'blank'+i}/>)}{calendar.map(value=>{const record=data?.days.find(x=>x.date===value);return <button key={value} aria-pressed={date===value} aria-label={dayLabel(value)+' '+status(record)} onClick={()=>setDate(value)}>{Number(value.slice(-2))}<i>{record?.completed?<Check size={13}/>:record?'●':''}</i></button>})}</div></section>
      <div className="section-title"><h2>{dayLabel(date)}</h2><button className="link" onClick={()=>navigate('記録')}>記録を開く <ChevronRight size={16}/></button></div>{detail}
    </>}
    {tab==='分析'&&<>
      <h1>栄養分析</h1>
      <div className="toolbar"><div className="segment"><button aria-pressed={!monthly} onClick={()=>setMonthly(false)}>週間</button><button aria-pressed={monthly} onClick={()=>setMonthly(true)}>月間</button></div><input aria-label="分析の基準日" type="date" value={period} onChange={e=>{if(e.target.value)setPeriod(e.target.value)}}/></div>
      <section className="card detail"><PanelTitle icon={ChartNoAxesColumnIncreasing} title={labels[metric]+'の推移'}/><div className="segment metrics">{nutrients.map(key=><button key={key} aria-pressed={key===metric} onClick={()=>setMetric(key)}>{labels[key]}</button>)}</div>
      <p className="muted">{dates[0]} 〜 {dates.at(-1)} · 斜線は記録中</p>
      <div className="chart">{dates.map(value=>{const row=analyzed.find(x=>x.date===value);return <div className="column" key={value}><div className="bar-space">{row&&<div tabIndex={0} className={'bar '+(!row.completed?'draft':'')} aria-label={dayLabel(value)+' '+fmt(row.total[metric])+' '+units[metric]} title={dayLabel(value)+' '+fmt(row.total[metric])+' '+units[metric]} style={{height:Math.max(2,row.total[metric]/max*100)+'%'}}/>}</div><small>{value.slice(-2)}</small></div>})}</div>
      </section>
      <section className="card detail"><h2>{monthly?'月間':'週間'}平均</h2><p className="muted">記録完了 {completed.length} 日が対象</p><div className="form-grid">{nutrients.map(key=><div key={key}>{labels[key]} <strong>{means?fmt(means[key])+' '+units[key]:'—'}</strong></div>)}</div></section>
      <section className="card detail"><h2>目標との差</h2><p className="muted">週間合計は記録完了 {week.length} 日が対象です。差は摂取カロリーと設定目標の比較です。</p><div className="detail-row"><span>週間摂取合計 / 週間目標合計</span><strong>{week.length?fmt(weekUsed)+' / '+fmt(weekGoal)+' kcal':'—'}</strong></div><div className="detail-row"><span>週間の差</span><strong>{week.length?signed(weekUsed-weekGoal)+' kcal':'—'}</strong></div>{analyzed.map(row=><div className="detail-row" key={row.date}><span>{dayLabel(row.date)} · {status(row)}</span><strong>{signed(row.total.kcal-row.goals[row.kind].kcal)} kcal</strong></div>)}</section>
    </>}
    {tab==='食品'&&<>
      <div className="section-title"><h1>食品管理</h1>{foodView!=='archive'&&<button className="primary" onClick={()=>foodView==='sets'?setSetEdit({id:newId(),name:'',items:[]}):setFoodEdit(blankFood())}><Plus size={18}/>新規作成</button>}</div>
      <div className="segment"><button aria-pressed={foodView==='active'} onClick={()=>setFoodView('active')}>食品</button><button aria-pressed={foodView==='sets'} onClick={()=>setFoodView('sets')}>セット</button><button aria-pressed={foodView==='archive'} onClick={()=>setFoodView('archive')}>アーカイブ</button></div>
      {foodView==='sets'?<section className="card detail">{sets.length?sets.map(item=><div className="detail-row" key={item.id}><span>{item.name} · {item.items.length}種類</span><button onClick={()=>setSetEdit(item)}>編集</button></div>):<p className="muted">食品セットはありません。</p>}</section>:<section className="card detail">{(foodView==='archive'?foods.filter(food=>food.archived):active).map(food=>{
        const group=active.filter(x=>x.favorite===food.favorite);const index=group.findIndex(x=>x.id===food.id)
        return <div className="manage-row" key={food.id}><button className="link" onClick={()=>setFoodEdit(food)}>{food.name}</button><div className="row">{food.archived?<button onClick={()=>run(()=>db.foods.update(food.id,{archived:false}))}>復活</button>:<>
          <button className="icon" aria-label={food.name+'のお気に入り'} aria-pressed={food.favorite} onClick={()=>run(()=>db.foods.update(food.id,{favorite:!food.favorite}))}><Star size={18} fill={food.favorite?'currentColor':'none'}/></button>
          <button className="icon" aria-label={food.name+'を上へ'} disabled={index===0} onClick={()=>run(()=>move(food,-1))}><ArrowUp size={18}/></button><button className="icon" aria-label={food.name+'を下へ'} disabled={index===group.length-1} onClick={()=>run(()=>move(food,1))}><ArrowDown size={18}/></button><button onClick={()=>run(()=>db.foods.update(food.id,{archived:true}))}>保管</button></>}</div></div>
      })}{!(foodView==='archive'?foods.some(food=>food.archived):active.length)&&<p className="muted">表示する食品がありません。</p>}</section>}
    </>}
    {tab==='設定'&&<>
      <h1>{settingsView==='goals'?'目標設定':settingsView==='backup'?'バックアップ・復元':'設定'}</h1>
      {settingsView!=='main'&&<button className="link" onClick={()=>setSettingsView('main')}><ChevronLeft size={17}/>設定に戻る</button>}
      {settingsView==='main'&&<section className="card detail"><PanelTitle icon={Gear} title="アプリ設定"/><label>外観<select value={data?.settings?.theme??'system'} onChange={e=>{const theme=e.target.value as Settings['theme'];run(()=>db.settings.put({id:'app',theme}))}}><option value="system">端末の設定に合わせる</option><option value="light">ライト</option><option value="dark">ダーク</option></select></label><div className="detail-row"><button className="link" onClick={()=>run(async()=>{setGoals(await goalAt(today));setSettingsView('goals')})}>筋トレ日・休養日の目標 <ChevronRight size={17}/></button></div><div className="detail-row"><button className="link" onClick={()=>setSettingsView('backup')}>バックアップ・復元 <ChevronRight size={17}/></button></div></section>}
      {settingsView==='goals'&&<form onSubmit={(e:FormEvent)=>{e.preventDefault();exclusive(async()=>{await saveGoals(goals);setNote('目標を保存しました。')})}}>{(['training','rest'] as const).map(kind=><section className="card detail" key={kind}><h2>{kind==='training'?'筋トレ日':'休養日'}</h2><NutrientFields value={goals[kind]} change={value=>setGoals({...goals,[kind]:value})}/></section>)}<button className="primary" disabled={busy}>目標を保存</button></form>}
      {settingsView==='backup'&&<section className="card detail"><button className="primary" onClick={()=>run(async()=>{
        const latest=await snapshot();const url=URL.createObjectURL(new Blob([JSON.stringify(latest,null,2)],{type:'application/json'}))
        const link=document.createElement('a');link.href=url;link.download='mydiet-'+localDate()+'.json';document.body.append(link);link.click();link.remove();window.setTimeout(()=>URL.revokeObjectURL(url),30000)
      })}>JSONをエクスポート</button><label>復元するファイル<input type="file" accept=".json,application/json" onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)run(async()=>setPendingBackup(validateBackup(JSON.parse(await file.text()))))}}/></label></section>}
    </>}
    </main>
    <nav className="nav" aria-label="メインメニュー"><div>{tabs.map(([name,Icon])=><button key={name} aria-current={tab===name?'page':undefined} onClick={()=>navigate(name)}><Icon size={21}/><span>{name}</span></button>)}</div></nav>
    {foodEdit&&<FoodEditor food={foodEdit} close={()=>setFoodEdit(undefined)} fail={fail} save={food=>exclusive(async()=>{
      await db.transaction('rw',db.foods,async()=>{const existing=await db.foods.get(food.id);const all=await db.foods.toArray();await db.foods.put({...food,order:existing?.order??Math.max(-1,...all.map(x=>x.order))+1})})
      setFoodEdit(undefined);setNote('食品を保存しました。')
    })}/>}
    {setEdit&&<SetEditor item={setEdit} foods={foods} close={()=>setSetEdit(undefined)} save={item=>exclusive(async()=>{await db.sets.put(item);setSetEdit(undefined);setNote('セットを保存しました。')})} remove={()=>{if(confirm('このセットを削除しますか？'))exclusive(async()=>{await db.sets.delete(setEdit.id);setSetEdit(undefined)})}}/>}
    {pendingBackup&&<Modal title="復元の確認" close={()=>setPendingBackup(undefined)}><p>現在の端末内データを、食品 {pendingBackup.foods.length} 件と記録 {pendingBackup.days.length} 日分を含むバックアップで置き換えます。</p><button className="primary wide" disabled={busy} onClick={()=>exclusive(async()=>{await restore(pendingBackup);setPendingBackup(undefined);setUndo(undefined);setNote('バックアップを復元しました。')})}>復元する</button></Modal>}
    {note&&<div className="toast" role="status">{note}<button aria-label="通知を閉じる" onClick={()=>setNote('')}><X size={17}/></button></div>}
  </>
}
createRoot(document.getElementById('root')!).render(<App/>)
if(import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load',()=>{void navigator.serviceWorker.register(import.meta.env.BASE_URL+'sw.js').catch(console.error)})
}

