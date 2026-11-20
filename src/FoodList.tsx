import { useRef, useState, type ReactNode } from 'react'
import { DndContext, DragOverlay, KeyboardSensor, MouseSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, closestCenter, type DragOverEvent } from '@dnd-kit/core'

import { GripVertical, Star, Trash2 } from 'lucide-react'
import { db, fmt, reorderFood, type Food } from './model'

function FoodRow({food,children,insert,dragging}:{food:Food;children:ReactNode;insert?:boolean;dragging:boolean}) {
  const {setNodeRef:setDrop}=useDroppable({id:food.id,data:{favorite:food.favorite}})
  const {setNodeRef:setDrag,listeners,attributes}=useDraggable({id:food.id,data:{favorite:food.favorite},disabled:food.archived})
  return <div ref={node=>{setDrop(node);setDrag(node)}} className={'manage-row draggable-food'+(dragging?' drag-source':'')} data-insert={insert===undefined?undefined:insert?'after':'before'}>
    {children}
    {!food.archived&&<button className="icon drag-handle" {...listeners} {...attributes} aria-label={food.name+'を長押しして並び替え'}><GripVertical size={19}/></button>}
  </div>
}

export default function FoodList({foods,edit,remove,run}:{foods:Food[];edit:(food:Food)=>void;remove:(food:Food)=>void;run:(action:()=>Promise<unknown>)=>void}) {
  const [active,setActive]=useState<Food>()
  const [insertion,setInsertion]=useState<{id:string;after:boolean}>()
  const insertionRef=useRef(insertion)
  const sensors=useSensors(
    useSensor(TouchSensor,{activationConstraint:{delay:350,tolerance:8}}),
    useSensor(MouseSensor,{activationConstraint:{delay:250,tolerance:5}}),
    useSensor(KeyboardSensor,{coordinateGetter:(event,{currentCoordinates,context})=>{
      if(event.code!=='ArrowDown'&&event.code!=='ArrowUp')return
      event.preventDefault()
      const current=foods.find(food=>food.id===context.active?.id)
      const group=foods.filter(food=>!food.archived&&food.favorite===current?.favorite)
      const over=String(context.over?.id??current?.id)
      const index=group.findIndex(food=>food.id===over)
      const target=group[index+(event.code==='ArrowDown'?1:-1)]
      const rect=target&&context.droppableRects.get(target.id)
      if(rect)return {x:currentCoordinates.x,y:rect.top+(event.code==='ArrowDown'?rect.height:0)}
    }})
  )
  function update(event:DragOverEvent) {
    const over=event.over
    const target=foods.find(food=>food.id===over?.id)
    const valid=active&&target&&!target.archived&&target.favorite===active.favorite&&target.id!==active.id
    const translated=event.active.rect.current.translated
    const value=valid&&over?{id:target.id,after:!!translated&&translated.top+translated.height/2>over.rect.top+over.rect.height/2}:undefined
    insertionRef.current=value
    setInsertion(value)
  }
  function clear(){setActive(undefined);setInsertion(undefined);insertionRef.current=undefined}
  return <DndContext sensors={sensors} collisionDetection={args=>closestCenter({...args,droppableContainers:args.droppableContainers.filter(item=>item.data.current?.favorite===active?.favorite)})}
    onDragStart={event=>setActive(foods.find(food=>food.id===event.active.id))}
    onDragOver={update} onDragMove={update} onDragCancel={clear}
    onDragEnd={()=>{const target=insertionRef.current;if(active&&target)run(()=>reorderFood(active.id,target.id,target.after));clear()}}>
    {foods.map(food=><FoodRow key={food.id} food={food} dragging={active?.id===food.id} insert={insertion?.id===food.id?insertion.after:undefined}>
      <div className="manage-info"><button className="link" onClick={()=>edit(food)}>{food.name}</button><small className={food.nutrition.kcal===0?'over':undefined}>{fmt(food.nutrition.kcal)} kcal</small></div>
      <div className="manage-actions">
        {food.archived?<button className="manage-restore" onClick={()=>run(()=>db.foods.update(food.id,{archived:false}))}>復活</button>:<>
          <button className="icon" aria-label={food.name+'のお気に入り'} aria-pressed={food.favorite} onClick={()=>run(()=>db.foods.update(food.id,{favorite:!food.favorite}))}><Star size={18} fill={food.favorite?'currentColor':'none'}/></button>
          <span aria-hidden="true"/>
          <button onClick={()=>run(()=>db.foods.update(food.id,{archived:true}))}>保管</button>
        </>}
        <button className="icon danger" aria-label={food.name+'を削除'} onClick={()=>remove(food)}><Trash2 size={18}/></button>
      </div>
    </FoodRow>)}
    {!foods.length&&<p className="muted">表示する食品がありません。</p>}
    <DragOverlay>{active&&<div className="card drag-preview"><strong>{active.name}</strong><span>{fmt(active.nutrition.kcal)} kcal</span></div>}</DragOverlay>
  </DndContext>
}
