import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { changeQuantities, db, deleteFood, initialGoals, snapshot, updateDay, type Food } from './model'
import { createReport, reportDates, reportRows, saveReportHistory } from './report'

describe('AI栄養分析レポート',()=>{
  it('7暦日・初回・前回の翌日・同日の再出力を扱う',()=>{
    expect(reportDates('2026-11-15','recent','2026-11-14')).toEqual([
      '2026-11-09','2026-11-10','2026-11-11','2026-11-12','2026-11-13','2026-11-14','2026-11-15'
    ])
    expect(reportDates('2026-11-15','since')).toEqual(reportDates('2026-11-15','recent'))
    expect(reportDates('2026-11-15','since','2026-11-13')).toEqual(['2026-11-14','2026-11-15'])
    expect(reportDates('2026-11-15','since','2026-11-15')).toEqual(['2026-11-15'])
    expect(reportDates('2026-11-15','since','2026-11-15','2026-11-13')).toEqual(['2026-11-13','2026-11-14','2026-11-15'])
  })

  it('正常出力分の履歴が再接続後も残り、直近7日の出力は基準日を変えない',async()=>{
    await saveReportHistory({mode:'since',start:'2026-11-07',through:'2026-11-13',exportedAt:'2026-11-13T02:00:00Z'})
    await saveReportHistory({mode:'recent',start:'2026-11-09',through:'2026-11-15',exportedAt:'2026-11-15T02:00:00Z'})
    db.close()
    await db.open()
    expect(await db.reportHistory.get('nutrition')).toMatchObject({
      through:'2026-11-13',sinceStart:'2026-11-07',exportedAt:'2026-11-15T02:00:00Z',lastPeriod:{mode:'recent',start:'2026-11-09',end:'2026-11-15'}
    })
  })

  it('セット追加後に削除した食品も日本語で出力し、日別と期間の栄養値を一致させる',async()=>{
    const nutrition={kcal:75,p:6,f:5,c:0.5}
    const egg:Food={
      id:'private-food-id',name:'卵',unit:'0.5個',weight:0,image:'',nutrition,input:nutrition,
      mode:'unit',favorite:false,archived:false,order:0
    }
    await db.foods.add(egg)
    await changeQuantities('2026-11-13',[{id:egg.id,count:2}],'set')
    await updateDay('2026-11-13',{kind:'training',completed:true})
    await changeQuantities('2026-11-14',[{id:egg.id,count:1}],'set')
    await db.foods.update(egg.id,{name:'変更後の名前',nutrition:initialGoals.rest})
    await deleteFood(egg.id)
    const before=await snapshot()
    const rows=reportRows(reportDates('2026-11-15','recent'),before.days,before.entries)
    const report=createReport(rows,new Date(2026,10,15,12))
    expect(report.name).toBe('MyDiet_栄養分析_2026-11-09_2026-11-15.md')
    const text=new TextDecoder().decode(new TextEncoder().encode(report.text))
    expect(text).toContain('記録済み: 2日（完了 1日・記録中 1日）、未記録: 5日')
    expect(text).toContain('| 卵 | 0.5個 | 2 | 1個 | 150 kcal / 12 g / 10 g / 1 g |')
    expect(text).toContain('| 卵 | 0.5個 | 2 | 3 | 1.5個 | 1.5 | 225 kcal / 18 g / 15 g / 1.5 g |')
    expect(text).toContain('全記録の合計（2日）: 225 kcal / 18 g / 15 g / 1.5 g')
    expect(text).toContain('平均: 150 kcal / 12 g / 10 g / 1 g')
    expect(text).toContain('2026-11-15（日）\n未記録')
    expect(text).not.toMatch(/private-food-id|変更後の名前/)
    expect(await snapshot()).toEqual(before)
  })
})
