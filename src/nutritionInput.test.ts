import { expect, it } from 'vitest'
import { nutritionDraft, parseNutrition, parseNutrientInput } from './nutritionInput'

it('空欄・明示的な0・小数を区別し、保存済みの値を再編集できる',()=>{
  const empty=nutritionDraft()
  expect(empty).toEqual({kcal:'',p:'',f:'',c:''})
  expect(parseNutrition(empty)).toBeUndefined()
  const saved={kcal:80,p:0,f:0.5,c:12}
  const edited=nutritionDraft(saved)
  expect(parseNutrition(edited)).toEqual(saved)
  expect(parseNutrition({...edited,f:''})).toBeUndefined()
  expect(parseNutrition({...edited,f:'2'})).toEqual({...saved,f:2})
})

it.each(['Infinity','NaN','-1','1000001',' '])('不正な入力 %s を拒否する',raw=>{
  expect(parseNutrientInput(raw)).toBeUndefined()
})
