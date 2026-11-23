import { useEffect, useRef, useState } from 'react'
export type SettingsView='main'|'goals'|'backup'|'icon'|'history'
const detail=(value:unknown):value is Exclude<SettingsView,'main'>=>['goals','backup','icon','history'].includes(String(value))
export function useSettingsNavigation(isDirty:()=>boolean,onChange:()=>void) {
  const [view,setView]=useState<SettingsView>('main')
  const current=useRef<SettingsView>('main'),guard=useRef(isDirty),changed=useRef(onChange)
  const moving=useRef(false),explicit=useRef(false),restoring=useRef(false),timer=useRef<number|undefined>(undefined)
  guard.current=isDirty;changed.current=onChange
  function apply(next:SettingsView){current.current=next;setView(next);changed.current()}
  function settle(){window.clearTimeout(timer.current);timer.current=window.setTimeout(()=>{moving.current=false},250)}
  useEffect(()=>{
    if(detail(window.history.state?.mydietView)) {
      const state={...window.history.state};delete state.mydietView;window.history.replaceState(state,'',window.location.href)
    }
    const pop=()=>{
      const next=detail(window.history.state?.mydietView)?window.history.state.mydietView as SettingsView:'main'
      if(current.current!=='main'&&next!==current.current&&!explicit.current&&guard.current()) {
        moving.current=true;restoring.current=true;window.history.forward();return
      }
      if(restoring.current){restoring.current=false;explicit.current=false;settle();return}
      if(next!=='main'||current.current!=='main')apply(next)
      explicit.current=false;settle()
    }
    window.addEventListener('popstate',pop)
    return ()=>{window.removeEventListener('popstate',pop);window.clearTimeout(timer.current)}
  },[])
  function open(next:Exclude<SettingsView,'main'>) {
    if(current.current===next||moving.current&&current.current!=='main')return
    moving.current=false;window.clearTimeout(timer.current)
    window.history.pushState({...window.history.state,mydietView:next},'',window.location.href)
    apply(next)
  }
  function back(force=false) {
    if(moving.current||current.current==='main'||!force&&guard.current())return
    moving.current=true;explicit.current=force
    if(window.history.state?.mydietView===current.current){window.history.back();return}
    apply('main');explicit.current=false;settle()
  }
  function leave() {
    if(current.current==='main')return
    const state={...window.history.state};delete state.mydietView;window.history.replaceState(state,'',window.location.href)
    current.current='main';setView('main');explicit.current=false;restoring.current=false;moving.current=false
  }
  return {view,open,back,leave}
}
