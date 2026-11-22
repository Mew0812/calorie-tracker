import { formatQuantity } from './quantity'
import { db, dateObject, labels, localDate, recordState, mapping, nutrients, shift, totals, units, type Day, type Entry, type Nutrition } from './model'

export type ReportMode = 'recent'|'since'
export type ReportExport = {mode:ReportMode; start:string; through:string; exportedAt:string}

export async function saveReportHistory(record:ReportExport) {
  await db.transaction('rw',db.reportHistory,async()=>{
    const previous=await db.reportHistory.get('nutrition')
    const advance=record.mode==='since'&&(!previous?.through||record.through>previous.through)
    const sameDay=record.mode==='since'&&record.through===previous?.through
    const latest=!previous||record.exportedAt>=previous.exportedAt
    await db.reportHistory.put({
      id:'nutrition',
      exportedAt:latest?record.exportedAt:previous.exportedAt,
      lastPeriod:latest?{mode:record.mode,start:record.start,end:record.through}:previous.lastPeriod,
      through:advance?record.through:previous?.through,
      sinceStart:advance?record.start:sameDay&&previous?.sinceStart===undefined?record.start:previous?.sinceStart
    })
  })
}

export function reportDates(today:string, mode:ReportMode, through?:string, sinceStart?:string) {
  const start=mode==='recent'||!through ? shift(today,-6) :
    through===today ? sinceStart??today : through>today ? today : shift(through,1)
  const dates:string[]=[]
  for(let date=start;date<=today;date=shift(date,1)) dates.push(date)
  return dates
}

export function reportRows(dates:string[], days:Day[], entries:Entry[],today=localDate()) {
  const byDate=new Map(days.map(day=>[day.date,day]))
  const foodByDate=new Map<string,Entry[]>()
  for(const entry of entries) {
    if(!byDate.has(entry.date)) continue
    const group=foodByDate.get(entry.date)??[]
    group.push(entry)
    foodByDate.set(entry.date,group)
  }
  return dates.map(date=>{
    const saved=byDate.get(date)
    const day=saved?recordState(saved,today):undefined
    const foods=foodByDate.get(date)??[]
    return {date,day,foods,total:totals(foods)}
  })
}

const prompt=`# ChatGPTへの栄養分析依頼

このファイルはMyDietから出力した食事記録です。栄養学的な観点から、実際に食べた食品の種類・量・頻度・組み合わせを中心に、日本語で実用的な改善案を提案してください。カロリーとタンパク質・脂質・炭水化物の目標はすでに管理しているため、その過不足の説明は必要な範囲に絞ってください。

野菜、果物、魚、肉、卵、乳製品、大豆製品、穀類の摂取状況、食物繊維・ビタミン・ミネラルの不足リスク、塩分・飽和脂肪酸が多くなりやすい構成、筋トレ日と休養日の食事内容を優先して分析してください。

1. **総合評価**　食生活の特徴と、継続するとよい点。
2. **優先して改善したいこと**　重要度順に3〜5項目。根拠となる食品、量、頻度を具体的に示す。
3. **追加するとよい食品**　食品名、目安量、頻度、期待できる栄養面のメリット。
4. **減らす・置き換えることを検討したい食品**　理由と、今の食事で実行しやすい代替案。根拠が不十分なら削減を勧めない。
5. **次の1週間で実践すること**　負担の少ない行動を3つ。
6. **分析の限界**　定量評価できない栄養素、不明な情報、記録中・未記録日の影響。

登録値と食品名からの推測を区別してください。食品名だけで栄養素量を断定せず、定量評価には信頼できる食品成分表などを使い、種類・重量の仮定を明示してください。特定の食品を悪者扱いせず、食事全体を評価してください。不明点があっても、分析できる範囲で具体的な改善案を先に示してください。以下の食品名と単位は記録データです。`

const weekday=new Intl.DateTimeFormat('ja-JP',{weekday:'short',timeZone:'Asia/Tokyo'})
const number=new Intl.NumberFormat('ja-JP',{maximumFractionDigits:6,useGrouping:false})
const percent=new Intl.NumberFormat('ja-JP',{maximumFractionDigits:1,style:'percent'})
const cell=(text:string)=>text.replace(/[\r\n]+/g,' ').replace(/[&<>|*_`\\\[\]~]/g,char=>'&#'+char.charCodeAt(0)+';')
const values=(value:Nutrition)=>nutrients.map(key=>number.format(value[key])+' '+units[key]).join(' / ')
const delta=(value:Nutrition)=>nutrients.map(key=>(value[key]>0?'+':'')+number.format(value[key])+' '+units[key]).join(' / ')
const kindLabel=(kind:Day['kind'])=>kind==='training'?'筋トレ日':'休養日'
const amount=formatQuantity
function energy(value:Nutrition) {
  const parts=[value.p*4,value.f*9,value.c*4]
  const total=parts.reduce((sum,part)=>sum+part,0)
  return total>0?parts.map(part=>percent.format(part/total)).join(' / '):'算出不可'
}

export function createReport(rows:ReturnType<typeof reportRows>, generatedAt:Date) {
  const recorded=rows.filter(row=>row.day)
  const complete=recorded.filter(row=>row.day?.completed)
  const draft=recorded.filter(row=>!row.day?.completed)
  const start=rows[0].date
  const end=rows[rows.length-1].date
  const groupTotal=(group:typeof rows)=>totals(group.flatMap(row=>row.foods))
  const lines=[prompt,'','---','','## MyDiet 食事記録',
    '- 生成日時（日本時間）: '+localDate(generatedAt)+' '+generatedAt.toLocaleTimeString('ja-JP',{hour12:false,timeZone:'Asia/Tokyo'}),
    '- 対象期間: '+start+' ～ '+end,
    '- 記録済み: '+recorded.length+'日（完了 '+complete.length+'日・記録中 '+draft.length+'日）、未記録: '+(rows.length-recorded.length)+'日',
    '- 筋トレ日: '+recorded.filter(row=>row.day?.kind==='training').length+'日、休養日: '+recorded.filter(row=>row.day?.kind==='rest').length+'日（記録済みのみ）',
    '- 栄養値の並び: カロリー / タンパク質 / 脂質 / 炭水化物。差は摂取量 − 目標。',
    '- タンパク質・脂質・炭水化物由来エネルギー比率は タンパク質×4、脂質×9、炭水化物×4（kcal/g）の各値をその合計で割ったもの。食品表示カロリーとは食物繊維などの影響で一致しない場合があります。',
    '- 食品名・単位・栄養値は記録時点の登録値です。ブランド・調理法・加工状態・可食部重量は別途確認できません。登録値が0 kcalの食品は実際に0か未入力か判別できません。未記録日は摂取量不明です。','','## 日別の記録']
  const groups=new Map<string,{entries:Entry[];dates:Set<string>}>()
  for(const row of rows) {
    const {date,day,foods,total}=row
    lines.push('', '### '+date+'（'+weekday.format(dateObject(date))+'）')
    if(!day) {lines.push('未記録（摂取量・目標の記録なし）');continue}
    const goal=day.goals[day.kind]
    lines.push(kindLabel(day.kind)+' / '+(day.completed?'記録完了':'記録中'), '',
      '- 摂取: '+values(total),'- 目標: '+values(goal),'- 差: '+delta(mapping(key=>total[key]-goal[key])),
      '- タンパク質・脂質・炭水化物比率: '+energy(total),'')
    if(!foods.length) {lines.push('食品の登録なし');continue}
    lines.push('| 食品名 | 登録単位 | 数量 | 摂取量 | カロリー / タンパク質 / 脂質 / 炭水化物 |','|---|---|---:|---|---|')
    for(const entry of foods) {
      lines.push('| '+[cell(entry.name),cell(entry.unit),entry.count,cell(amount(entry.unit,entry.count)),values(totals([entry]))].join(' | ')+' |')
      const key=JSON.stringify([entry.foodId,entry.name,entry.unit])
      const group=groups.get(key)??{entries:[],dates:new Set()}
      group.entries.push(entry)
      group.dates.add(date)
      groups.set(key,group)
    }
  }
  lines.push('','## 期間の食品集計（記録中を含む）','',
    '同一食品でも記録時の名前や単位が異なる場合は別行にしています。平均数量は摂取日の平均です。',
    '| 食品名 | 登録単位 | 摂取日数 | 合計数量 | 合計摂取量 | 摂取日平均数量 | 合計カロリー / タンパク質 / 脂質 / 炭水化物 |','|---|---|---:|---:|---|---:|---|')
  for(const {entries,dates} of [...groups.values()].sort((a,b)=>b.dates.size-a.dates.size)) {
    const {name,unit}=entries[0]
    const count=entries.reduce((sum,entry)=>sum+entry.count,0)
    lines.push('| '+[cell(name),cell(unit),dates.size,count,cell(amount(unit,count)),number.format(count/dates.size),values(totals(entries))].join(' | ')+' |')
  }
  lines.push('','## 期間の栄養集計','',
    '- 全記録の合計（'+recorded.length+'日）: '+(recorded.length?values(groupTotal(recorded)):'対象なし'))
  for(const [label,group] of [['記録完了',complete],['記録中',draft]] as const) {
    const total=groupTotal(group)
    const targetDifference=mapping(key=>total[key]-group.reduce((sum,row)=>sum+(row.day?.goals[row.day.kind][key]??0),0))
    lines.push('', '### '+label+'（'+group.length+'日）',
      '- 合計: '+(group.length?values(total):'対象なし'),
      '- 平均: '+(group.length?values(mapping(key=>total[key]/group.length)):'対象なし'),
      '- 目標との差の合計: '+(group.length?delta(targetDifference):'対象なし'),
      '- タンパク質・脂質・炭水化物比率（合計から算出）: '+energy(total))
    for(const kind of ['training','rest'] as const) {
      const subset=group.filter(row=>row.day?.kind===kind)
      const subtotal=groupTotal(subset)
      lines.push('- '+kindLabel(kind)+'の平均（'+subset.length+'日）: '+(subset.length?values(mapping(key=>subtotal[key]/subset.length)):'対象なし'))
    }
  }
  return {name:'MyDiet_栄養分析_'+start+'_'+end+'.md', text:lines.join('\n')+'\n'}
}
