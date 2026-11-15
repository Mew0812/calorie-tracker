import { useState } from 'react'
import { X } from 'lucide-react'
import { fmt, mapping, nutrients, units, type Food, type FoodSet } from './model'
import { nutritionDraft, parseNutrientInput, parseNutrition } from './nutritionInput'
import { Modal, NutrientFields } from './ui'

export function FoodEditor({food,save,close,fail}:{food:Food;save:(food:Food)=>void;close:()=>void;fail:(error:unknown)=>void}) {
  const [draft,set]=useState(food)
  const [reading,setReading]=useState(false)
  const [inputText,setInputText]=useState(()=>nutritionDraft(food.name?food.input:undefined))
  const hasWeight=Number.isFinite(food.weight)&&food.weight>0
  const needsWeight=draft.mode==='100g'&&!hasWeight
  const input=parseNutrition(inputText)
  const nutrition=input&&draft.mode===food.mode&&nutrients.every(key=>input[key]===food.input[key])
    ?food.nutrition
    :mapping(key=>(parseNutrientInput(inputText[key])??0)*(draft.mode==='100g'?food.weight/100:1))
  return <Modal title={food.name?'食品を編集':'食品を登録'} close={close}><form onSubmit={e=>{
    e.preventDefault()
    if(input&&!needsWeight&&draft.name.trim()&&draft.unit.trim())save({...draft,name:draft.name.trim(),input,nutrition})
  }}>
    <label>食品名<input required maxLength={80} value={draft.name} onChange={e=>set({...draft,name:e.target.value})}/></label>
    <label>単位<input required maxLength={20} value={draft.unit} onChange={e=>set({...draft,unit:e.target.value})}/></label>
    <label>食品画像<input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/heic,image/heif" onChange={e=>{
      const file=e.target.files?.[0]; if(!file)return
      if(!/^image\/(png|jpeg|webp|gif|avif|heic|heif)$/i.test(file.type)||file.size>5*1024*1024){fail(new Error('対応する5 MB以下の画像を選択してください。'));return}
      const reader=new FileReader();setReading(true)
      reader.onload=()=>{set(current=>({...current,image:String(reader.result)}));setReading(false)}
      reader.onerror=()=>{setReading(false);fail(new Error('画像を読み込めませんでした。'))};reader.readAsDataURL(file)
    }}/></label>
    {draft.image&&<div className="row"><img className="thumb" src={draft.image} alt="食品画像"/><button type="button" onClick={()=>set({...draft,image:''})}>画像を外す</button></div>}
    <div className="segment"><button type="button" aria-pressed={draft.mode==='unit'} onClick={()=>set({...draft,mode:'unit'})}>1単位あたり</button><button type="button" aria-pressed={draft.mode==='100g'} disabled={!hasWeight} onClick={()=>set({...draft,mode:'100g'})}>100gあたり</button></div>
    {!hasWeight&&<small>100gあたりの換算には保存済みの重量が必要です。1単位あたりの栄養成分を入力してください。</small>}
    <NutrientFields value={inputText} change={setInputText}/>
    {!needsWeight&&<div className="notice"><strong>1単位あたり{draft.unit.trim() && `（${draft.unit}）`}</strong><div>{nutrients.map(key=><span key={key}>{key==='kcal'?'':key.toUpperCase()+' '}{fmt(nutrition[key])} {units[key]}　</span>)}</div></div>}
    <label className="row"><input type="checkbox" checked={draft.favorite} onChange={e=>set({...draft,favorite:e.target.checked})}/>お気に入り</label>
    <button className="primary wide" disabled={reading||needsWeight}>保存する</button>
  </form></Modal>
}
export function SetEditor({item,foods,save,remove,close}:{item:FoodSet;foods:Food[];save:(item:FoodSet)=>void;remove:()=>void;close:()=>void}) {
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
