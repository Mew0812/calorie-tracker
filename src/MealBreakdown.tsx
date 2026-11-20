import { dayLabel } from './display'
import { fmt, totals, type Entry } from './model'
import { Modal } from './ui'

export default function MealBreakdown({date,entries,close}:{date:string;entries:Entry[];close:()=>void}) {
  const foods=entries.filter(entry=>entry.count>0)
  const total=totals(foods)
  return <Modal title={dayLabel(date)+'の食事内訳'} close={close} sheet>
    <div className="meal-total"><strong>{fmt(total.kcal)} kcal</strong><p>P {fmt(total.p)} g / F {fmt(total.f)} g / C {fmt(total.c)} g</p></div>
    {foods.length?foods.map(entry=>{
      const value=totals([entry])
      return <article className="detail meal-item" key={entry.foodId}>
        <div className="detail-row"><strong>{entry.name}</strong><span>{entry.count} × {entry.unit}</span></div>
        <strong>{fmt(value.kcal)} kcal</strong><p>P {fmt(value.p)} g / F {fmt(value.f)} g / C {fmt(value.c)} g</p>
      </article>
    }):<p>この日の食事記録はありません</p>}
  </Modal>
}
