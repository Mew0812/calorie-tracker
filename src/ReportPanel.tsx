import { useEffect, useState } from 'react'
import { liveQuery } from 'dexie'
import { db, localDate, type Day, type Entry, type ReportHistory } from './model'
import { createReport, reportDates, reportRows, saveReportHistory, type ReportExport, type ReportMode } from './report'

export default function ReportPanel({today, data}:{
  today:string
  data?:{days:Day[]; entries:Entry[]}
}) {
  const [mode,setMode]=useState<ReportMode>('recent')
  const [history,setHistory]=useState<ReportHistory>()
  const [ready,setReady]=useState(false)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [download,setDownload]=useState<ReportExport>()

  useEffect(()=>{
    const sub=liveQuery(()=>db.reportHistory.get('nutrition')).subscribe({
      next:value=>{setHistory(value);setReady(true)},
      error:()=>setError('出力履歴を読み込めませんでした。画面を開き直してください。')
    })
    return ()=>sub.unsubscribe()
  },[])

  const dates=reportDates(today,mode,history?.through,history?.sinceStart)
  const rows=reportRows(dates,data?.days??[],data?.entries??[])
  const recorded=rows.filter(row=>row.day).length

  async function finish(record:ReportExport) {
    try {
      await saveReportHistory(record)
      setDownload(undefined)
    } catch {
      setError('出力履歴を保存できませんでした。もう一度お試しください。')
    }
  }

  async function exportReport() {
    if(!data||!ready||busy)return
    setError('')
    setBusy(true)
    try {
      const now=new Date()
      const end=localDate(now)
      const dates=reportDates(end,mode,history?.through,history?.sinceStart)
      const report=createReport(reportRows(dates,data.days,data.entries),now)
      const record={mode,start:dates[0],through:end,exportedAt:now.toISOString()}
      const file=new File([report.text],report.name,{type:'text/markdown;charset=utf-8'})
      const shareData={files:[file]}
      const plainData={files:[new File([report.text],report.name,{type:'text/plain'})]}
      if(navigator.share&&(navigator.canShare?.(shareData)||navigator.canShare?.(plainData))) {
        await navigator.share(navigator.canShare(shareData)?shareData:plainData)
        await finish(record)
        return
      }
      const url=URL.createObjectURL(file)
      const link=document.createElement('a')
      link.href=url
      link.download=file.name
      document.body.append(link)
      try {link.click()} finally {
        link.remove()
        window.setTimeout(()=>URL.revokeObjectURL(url),30000)
      }
      setDownload(record)
    } catch(cause) {
      if(!(cause instanceof DOMException&&cause.name==='AbortError')) {
        setError('レポートを出力できませんでした。もう一度お試しください。')
      }
    } finally {
      setBusy(false)
    }
  }

  return <section className="card detail" aria-label="AI栄養分析レポート">
    <h2>AI栄養分析レポート</h2>
    <div className="segment">
      <button aria-pressed={mode==='recent'} disabled={busy||!!download} onClick={()=>setMode('recent')}>直近7日間</button>
      <button aria-pressed={mode==='since'} disabled={busy||!!download} onClick={()=>setMode('since')}>前回の出力以降</button>
    </div>
    {mode==='since'&&ready&&!history?.through&&<p className="muted">初回は直近7日間を出力します。</p>}
    {mode==='since'&&history?.through===today&&<p className="muted">{history.sinceStart?'同日の再出力は同じ期間が対象です。':'同日の再出力は今日の記録が対象です。'}</p>}
    <p>対象期間 {dates[0]} ～ {today}<br/>
      {data&&<>記録済み {recorded}日 · 未記録 {dates.length-recorded}日</>}
    </p>
    <p className="muted">前回出力日時 {history?new Date(history.exportedAt).toLocaleString('ja-JP'):'—'}</p>
    {download?<div className="notice">
      <p>ダウンロードしたファイルを確認してから、出力履歴を記録してください。</p>
      <div className="segment">
        <button disabled={busy} onClick={async()=>{setError('');setBusy(true);try {await finish(download)} finally {setBusy(false)}}}>保存できた</button>
        <button disabled={busy} onClick={()=>{setError('');setDownload(undefined)}}>履歴を記録しない</button>
      </div>
    </div>:<button className="primary" disabled={!ready||!data||busy} onClick={()=>void exportReport()}>レポートを出力</button>}
    {error&&<p className="danger" role="alert">{error}</p>}
  </section>
}
