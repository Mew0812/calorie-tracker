import { totals, type Entry, type Metric } from './model'

export function mealRanking(entries:Entry[], metric:Metric) {
  return entries.filter(entry=>entry.count>0)
    .map((entry,index)=>({entry,value:totals([entry]),index}))
    .sort((a,b)=>b.value[metric]-a.value[metric]||a.index-b.index)
}
