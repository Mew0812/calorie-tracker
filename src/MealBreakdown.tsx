import { dayLabel } from './display'
import { useState } from 'react'
import { fmt, labels, nutrients, totals, units, type Entry, type Metric } from './model'
import { mealRanking } from './mealRanking'
import { Modal } from './ui'

export default function MealBreakdown({date,entries,close}:{date:string;entries:Entry[];close:()=>void}) {
  const [metric,setMetric]=useState<Metric>('kcal')
  const foods=mealRanking(entries,metric)
  const total=totals(entries.filter(entry=>entry.count>0))
  const maximum=foods[0]?.value[metric]??0
  return <Modal title={dayLabel(date)+'の食事内訳'} close={close} sheet>
    <div className="meal-selectors">{nutrients.map(key=><button key={key} aria-pressed={metric===key} onClick={()=>setMetric(key)}>
      <span>{labels[key]}</span><strong>{fmt(total[key])} {units[key]}</strong>
    </button>)}</div>
    {foods.length>0&&<p className="muted meal-comparison">比較バーは、この日の最多食品を100%として表示します。</p>}
    {foods.length?foods.map(({entry,value},index)=>{
      return <article className="detail meal-item" key={entry.foodId}>
        <div className="meal-ranking-head"><div><strong>{index+1}. {entry.name}</strong><small>{entry.count} × {entry.unit}</small></div>
          <strong className="meal-selected-value">{fmt(value[metric])} {units[metric]}</strong>
        </div>
        <div className="track" role="img" aria-label={labels[metric]+'の相対量 '+fmt(maximum>0?value[metric]/maximum*100:0)+'%'}><i style={{width:(maximum>0?value[metric]/maximum*100:0)+'%'}}/></div>
        <div className="meal-nutrients">{nutrients.map(key=><span key={key}>{labels[key]} {fmt(value[key])} {units[key]}</span>)}</div>
      </article>
    }):<p>この日の食事記録はありません</p>}
  </Modal>
}
