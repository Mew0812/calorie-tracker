import { Star, Trash2 } from 'lucide-react'
import { db, fmt, reorderFood, type Food } from './model'
import LongPressList from './LongPressList'

export default function FoodList({foods,edit,remove,run}:{foods:Food[];edit:(food:Food)=>void;remove:(food:Food)=>void;run:(action:()=>Promise<unknown>)=>void}) {
  return <>
    <LongPressList items={foods.map(food=>({...food,group:String(food.archived)+':'+String(food.favorite)}))}
      open={item=>edit(foods.find(food=>food.id===item.id)!)} move={reorderFood} run={run} render={food=><>
        <div className="manage-info" title={food.name}>
          <strong className="manage-name">{food.name}</strong>
          <small className={food.nutrition.kcal===0?'over':undefined}>{fmt(food.nutrition.kcal)} kcal</small>
        </div>
        <div className="manage-actions" data-row-actions>
          {food.archived?<button onClick={()=>run(()=>db.foods.update(food.id,{archived:false}))}>復活</button>:<>
            <button className="icon" aria-label={food.name+'のお気に入り'} aria-pressed={food.favorite} onClick={()=>run(()=>db.foods.update(food.id,{favorite:!food.favorite}))}><Star size={18} fill={food.favorite?'currentColor':'none'}/></button>
            <button onClick={()=>run(()=>db.foods.update(food.id,{archived:true}))}>保管</button>
          </>}
          <button className="icon danger" aria-label={food.name+'を削除'} onClick={()=>remove(food)}><Trash2 size={18}/></button>
        </div>
      </>}/>
    {!foods.length&&<p className="muted">表示する食品がありません。</p>}
  </>
}
