import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { X, type LucideIcon } from 'lucide-react'
import { fmt, labels, nutrients, units, type Nutrition } from './model'
import { maxNutrientInput, type NutritionDraft } from './nutritionInput'

const balance=(used:number,goal:number,unit:string)=>used>goal?'超過 '+fmt(used-goal)+' '+unit:'残り '+fmt(goal-used)+' '+unit
const progress=(used:number,goal:number)=>goal>0?Math.min(used/goal,1):Number(used>0)
export function PanelTitle({icon:Icon,title,action}:{icon:LucideIcon;title:string;action?:ReactNode}) {
  return <div className="section-title"><h2><Icon size={19}/>{title}</h2>{action}</div>
}
export function NutritionCard({used,goal,open}:{used:Nutrition;goal:Nutrition;open?:()=>void}) {
  return <section className="nutrition card" aria-label={open?'食事内訳を表示':'栄養サマリー'} role={open?'button':undefined} tabIndex={open?0:undefined} onClick={open} onKeyDown={event=>{if(open&&(event.key==='Enter'||event.key===' ')){event.preventDefault();open()}}}>
    <div className="energy"><span className="caption">摂取カロリー</span><div className="ring" style={{background:'conic-gradient(var(--blue) '+(progress(used.kcal,goal.kcal)*100)+'%, var(--track) 0)'}}>
      <div><strong>{fmt(used.kcal)}</strong><small> / {fmt(goal.kcal)} kcal</small></div>
    </div><span className={'balance '+(used.kcal>goal.kcal?'over':'')}>{balance(used.kcal,goal.kcal,'kcal')}</span></div>
    <div className="macros">{(['p','f','c'] as const).map(key=><div className={'macro '+key} key={key}><div className="macro-head"><strong>{labels[key]}</strong><span>{fmt(used[key])} / {fmt(goal[key])} g</span></div>
      <div className="track"><i style={{width:progress(used[key],goal[key])*100+'%'}}/></div><small className={used[key]>goal[key]?'over':''}>{balance(used[key],goal[key],'g')}</small></div>)}</div>
  </section>
}
export const ErrorNotice=createContext('')
export function Modal({title,children,close,sheet=false}:{title:string;children:ReactNode;close:()=>void;sheet?:boolean}) {
  const error=useContext(ErrorNotice)
  const [node,setNode]=useState<HTMLDialogElement|null>(null)
  useEffect(()=>{if(node&&!node.open)node.showModal()},[node])
  return <dialog className={sheet?'bottom-sheet':undefined} ref={setNode} onCancel={event=>{event.preventDefault();close()}}><div className="dialog-title"><h2>{title}</h2><button type="button" className="icon" onClick={close} aria-label="閉じる"><X/></button></div>{children}{error&&<p className="danger" role="alert">{error}</p>}</dialog>
}
export function NutrientFields({value,change}:{value:NutritionDraft;change:(value:NutritionDraft)=>void}) {
  return <div className="form-grid">{nutrients.map(key=><label key={key}>{labels[key]}（{units[key]}）<input type="number" min="0" max={maxNutrientInput} step="any" required inputMode="decimal" value={value[key]} onChange={e=>change({...value,[key]:e.target.value})}/></label>)}</div>
}
