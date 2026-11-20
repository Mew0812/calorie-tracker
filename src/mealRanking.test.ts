import { expect, it } from 'vitest'
import { mealRanking } from './mealRanking'
import { totals, type Entry } from './model'

const entries:Entry[]=[
  {date:'2026-11-20',foodId:'a',name:'卵',unit:'個',count:2,nutrition:{kcal:70,p:6,f:6,c:0}},
  {date:'2026-11-20',foodId:'b',name:'納豆',unit:'パック',count:1,nutrition:{kcal:100,p:15,f:8,c:10}},
  {date:'2026-11-20',foodId:'c',name:'同率',unit:'個',count:1,nutrition:{kcal:140,p:0,f:0,c:0}}
]
it.each([
  ['kcal',['a','c','b']],['p',['b','a','c']],
  ['f',['a','b','c']],['c',['b','a','c']]
] as const)('%s の摂取合計で降順にし、同率は元の順序にする',(metric,expected)=>{
  const before=structuredClone(entries)
  const ranked=mealRanking(entries,metric)
  expect(ranked.map(row=>row.entry.foodId)).toEqual(expected)
  expect(totals(ranked.map(row=>row.entry))).toEqual(totals(entries))
  expect(entries).toEqual(before)
})
it('空・全て0・過去日のスナップショットを扱う',()=>{
  expect(mealRanking([],'kcal')).toEqual([])
  expect(mealRanking(entries.map(entry=>({...entry,count:0})),'kcal')).toEqual([])
  const rows=mealRanking(entries.filter(entry=>entry.foodId==='a'),'c')
  expect(rows[0].value.c).toBe(0)
  expect(rows[0].value.f).toBe(12)
})
