import { useRef, useState, type ReactNode } from 'react'
import { DndContext, DragOverlay, KeyboardSensor, MouseSensor, TouchSensor, closestCenter, useDraggable, useDroppable, useSensor, useSensors, type DragOverEvent } from '@dnd-kit/core'

type Row={id:string;name:string;group:string}
const isAction=(target:EventTarget|null)=>target instanceof Element&&!!target.closest('[data-row-actions]')
function DragRow({item,children,insert,dragging,open,blocked}:{
  item:Row;children:ReactNode;insert?:boolean;dragging:boolean;open:()=>void;blocked:()=>boolean
}) {
  const {setNodeRef:drop}=useDroppable({id:item.id,data:{group:item.group}})
  const {setNodeRef:drag,listeners,attributes}=useDraggable({id:item.id})
  return <div {...attributes} ref={node=>{drop(node);drag(node)}} aria-label={item.name+'（タップで編集・長押しで並び替え）'}
    className={'manage-row draggable-food compact-manage-row'+(dragging?' drag-source':'')}
    data-insert={insert===undefined?undefined:insert?'after':'before'}
    onMouseDown={event=>{if(!isAction(event.target))listeners?.onMouseDown?.(event)}}
    onTouchStart={event=>{if(!isAction(event.target))listeners?.onTouchStart?.(event)}}
    onKeyDown={event=>{
      if(isAction(event.target))return
      if(event.key==='Enter'&&!blocked()){event.preventDefault();open();return}
      listeners?.onKeyDown?.(event)
    }}
    onContextMenu={event=>{if(!isAction(event.target))event.preventDefault()}}
    onClick={event=>{if(!isAction(event.target)&&!blocked())open()}}>
    {children}
  </div>
}
export default function LongPressList<T extends Row>({items,open,move,render,run}:{
  items:T[];open:(item:T)=>void;move:(id:string,target:string,after:boolean)=>Promise<unknown>;
  render:(item:T)=>ReactNode;run:(action:()=>Promise<unknown>)=>void
}) {
  const [active,setActive]=useState<T>()
  const [insertion,setInsertion]=useState<{id:string;after:boolean}>()
  const insertionRef=useRef(insertion)
  const suppressClick=useRef(0)
  const sensors=useSensors(
    useSensor(TouchSensor,{activationConstraint:{delay:400,tolerance:8}}),
    useSensor(MouseSensor,{activationConstraint:{delay:400,tolerance:5}}),
    useSensor(KeyboardSensor,{coordinateGetter:(event,{currentCoordinates,context})=>{
      if(!['ArrowDown','ArrowUp'].includes(event.code))return
      event.preventDefault()
      const current=items.find(item=>item.id===context.active?.id)
      const group=items.filter(item=>item.group===current?.group)
      const index=group.findIndex(item=>item.id===(context.over?.id??current?.id))
      const target=group[index+(event.code==='ArrowDown'?1:-1)]
      const rect=target&&context.droppableRects.get(target.id)
      if(rect)return {x:currentCoordinates.x,y:rect.top+(event.code==='ArrowDown'?rect.height:0)}
    }})
  )
  function update(event:DragOverEvent) {
    const target=items.find(item=>item.id===event.over?.id)
    const valid=active&&target&&target.id!==active.id&&target.group===active.group
    const rect=event.active.rect.current.translated
    const value=valid&&event.over?{id:target.id,after:!!rect&&rect.top+rect.height/2>event.over.rect.top+event.over.rect.height/2}:undefined
    insertionRef.current=value;setInsertion(value)
  }
  function clear(){setActive(undefined);setInsertion(undefined);insertionRef.current=undefined;suppressClick.current=Date.now()+400}
  return <DndContext sensors={sensors} collisionDetection={args=>closestCenter({...args,
    droppableContainers:args.droppableContainers.filter(item=>item.data.current?.group===active?.group)})}
    onDragStart={event=>{suppressClick.current=Infinity;setActive(items.find(item=>item.id===event.active.id))}}
    onDragMove={update} onDragOver={update} onDragCancel={clear}
    onDragEnd={()=>{const target=insertionRef.current;if(active&&target)run(()=>move(active.id,target.id,target.after));clear()}}>
    {items.map(item=><DragRow key={item.id} item={item} open={()=>open(item)} blocked={()=>Date.now()<suppressClick.current}
      dragging={active?.id===item.id} insert={insertion?.id===item.id?insertion.after:undefined}>{render(item)}</DragRow>)}
    <DragOverlay>{active&&<div className="card drag-preview"><strong>{active.name}</strong></div>}</DragOverlay>
  </DndContext>
}
