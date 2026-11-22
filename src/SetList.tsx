import { reorderSet, type FoodSet } from './model'
import LongPressList from './LongPressList'

export default function SetList({sets,edit,run}:{sets:FoodSet[];edit:(item:FoodSet)=>void;run:(action:()=>Promise<unknown>)=>void}) {
  return <>
    <LongPressList items={sets.map(item=>({...item,group:'sets'}))} open={item=>edit(sets.find(set=>set.id===item.id)!)} move={reorderSet} run={run}
      render={item=><>
        <div className="manage-info" title={item.name}><strong className="manage-name">{item.name}</strong><small>{item.items.length}種類</small></div>
        <div className="manage-actions" data-row-actions><button onClick={()=>edit(sets.find(set=>set.id===item.id)!)}>編集</button></div>
      </>}/>
    {!sets.length&&<p className="muted">食品セットはありません。</p>}
  </>
}
