import { dateObject, fmt, recordState, type Day } from './model'
export const dayLabel=(date:string)=>dateObject(date).toLocaleDateString('ja-JP',{timeZone:'Asia/Tokyo',month:'long',day:'numeric',weekday:'short'})
export const signed=(value:number)=>(value>0?'+':'')+fmt(value)
export const status=(day?:Day)=>day?recordState(day).completed?'記録完了':'記録中':'未記録'
