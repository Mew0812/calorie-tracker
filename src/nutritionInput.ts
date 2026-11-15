import { nutrients, type Metric, type Nutrition } from './model'

export const maxNutrientInput = 1000000
export type NutritionDraft = Record<Metric,string>

export function nutritionDraft(value?:Nutrition):NutritionDraft {
  return Object.fromEntries(nutrients.map(key=>[key,value?String(value[key]):''])) as NutritionDraft
}

export function parseNutrientInput(raw:string):number|undefined {
  const value=Number(raw)
  if(raw.trim()&&Number.isFinite(value)&&value>=0&&value<=maxNutrientInput) return value
}

export function parseNutrition(draft:NutritionDraft):Nutrition|undefined {
  const parsed=nutrients.map(key=>parseNutrientInput(draft[key]))
  if(parsed.some(value=>value===undefined))return
  return Object.fromEntries(nutrients.map((key,index)=>[key,parsed[index]])) as Nutrition
}
