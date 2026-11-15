import { ChartNoAxesColumnIncreasing } from 'lucide-react'
import { average, fmt, labels, nutrients, periodDates, summarize, units, type Day, type Entry, type Metric } from './model'
import { PanelTitle } from './ui'
import ReportPanel from './ReportPanel'
import { dayLabel, signed, status } from './display'

type Props = {
  today:string
  data?:{days:Day[];entries:Entry[]}
  period:string
  setPeriod:(value:string)=>void
  monthly:boolean
  setMonthly:(value:boolean)=>void
  metric:Metric
  setMetric:(value:Metric)=>void
}

export default function AnalysisScreen({today,data,period,setPeriod,monthly,setMonthly,metric,setMetric}:Props) {
  const dates=periodDates(period,monthly)
  const analyzed=summarize(data?.days??[],data?.entries??[],dates)
  const completed=analyzed.filter(row=>row.completed)
  const week=summarize(data?.days??[],data?.entries??[],periodDates(period,false)).filter(row=>row.completed)
  const weekUsed=week.reduce((sum,row)=>sum+row.total.kcal,0)
  const weekGoal=week.reduce((sum,row)=>sum+row.goals[row.kind].kcal,0)
  const means=average(analyzed)
  const max=Math.max(1,...analyzed.map(row=>row.total[metric]))
    return <>
      <h1>栄養分析</h1>
      <ReportPanel today={today} data={data}/>
      <div className="toolbar"><div className="segment"><button aria-pressed={!monthly} onClick={()=>setMonthly(false)}>週間</button><button aria-pressed={monthly} onClick={()=>setMonthly(true)}>月間</button></div><input aria-label="分析の基準日" type="date" value={period} onChange={e=>{if(e.target.value)setPeriod(e.target.value)}}/></div>
      <section className="card detail"><PanelTitle icon={ChartNoAxesColumnIncreasing} title={labels[metric]+'の推移'}/><div className="segment metrics">{nutrients.map(key=><button key={key} aria-pressed={key===metric} onClick={()=>setMetric(key)}>{labels[key]}</button>)}</div>
      <p className="muted">{dates[0]} 〜 {dates.at(-1)} · 斜線は記録中</p>
      <div className="chart">{dates.map(value=>{const row=analyzed.find(x=>x.date===value);return <div className="column" key={value}><div className="bar-space">{row&&<div tabIndex={0} className={'bar '+(!row.completed?'draft':'')} aria-label={dayLabel(value)+' '+fmt(row.total[metric])+' '+units[metric]} title={dayLabel(value)+' '+fmt(row.total[metric])+' '+units[metric]} style={{height:Math.max(2,row.total[metric]/max*100)+'%'}}/>}</div><small>{value.slice(-2)}</small></div>})}</div>
      </section>
      <section className="card detail"><h2>{monthly?'月間':'週間'}平均</h2><p className="muted">記録完了 {completed.length} 日が対象</p><div className="form-grid">{nutrients.map(key=><div key={key}>{labels[key]} <strong>{means?fmt(means[key])+' '+units[key]:'—'}</strong></div>)}</div></section>
      <section className="card detail"><h2>目標との差</h2><p className="muted">週間合計は記録完了 {week.length} 日が対象です。差は摂取カロリーと設定目標の比較です。</p><div className="detail-row"><span>週間摂取合計 / 週間目標合計</span><strong>{week.length?fmt(weekUsed)+' / '+fmt(weekGoal)+' kcal':'—'}</strong></div><div className="detail-row"><span>週間の差</span><strong>{week.length?signed(weekUsed-weekGoal)+' kcal':'—'}</strong></div>{analyzed.map(row=><div className="detail-row" key={row.date}><span>{dayLabel(row.date)} · {status(row)}</span><strong>{signed(row.total.kcal-row.goals[row.kind].kcal)} kcal</strong></div>)}</section>
    </>
}
