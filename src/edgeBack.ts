import { useLayoutEffect, useRef } from 'react'
export function isBackSwipe(startX:number,dx:number,dy:number) {
  return startX>=0&&startX<=24&&dx>=72&&Math.abs(dy)<=32&&dx>Math.abs(dy)*2
}
export function useEdgeBack(enabled:boolean,blocked:()=>boolean,back:()=>void) {
  const latest=useRef({enabled,blocked,back});latest.current={enabled,blocked,back}
  useLayoutEffect(()=>{
    if(!enabled)return
    let start:{x:number;y:number;horizontal:boolean}|undefined
    const excluded='input,textarea,select,button,a,[role="slider"],[contenteditable="true"],.scroll-row,[data-swipe-ignore]'
    const focused=()=>document.activeElement?.matches('input,textarea,select,[contenteditable="true"]')
    const begin=(event:TouchEvent)=>{
      start=undefined
      const touch=event.touches[0],target=event.target
      if(!latest.current.enabled||latest.current.blocked()||focused()||event.touches.length!==1||!touch||touch.clientX>24||touch.clientX<0||!(target instanceof Element)||!target.closest('main')||target.closest(excluded)||document.querySelector('dialog[open]'))return
      start={x:touch.clientX,y:touch.clientY,horizontal:false}
    }
    const move=(event:TouchEvent)=>{
      if(!start)return
      if(event.touches.length!==1){start=undefined;return}
      const dx=event.touches[0].clientX-start.x,dy=event.touches[0].clientY-start.y
      if(dx< -8||Math.abs(dy)>12&&Math.abs(dy)>Math.max(dx,0)*.75){start=undefined;return}
      if(dx>14&&dx>Math.abs(dy)*2)start.horizontal=true
      if(start.horizontal&&event.cancelable)event.preventDefault()
    }
    const end=(event:TouchEvent)=>{
      const from=start;start=undefined
      const touch=event.changedTouches[0]
      if(!from?.horizontal||!touch||!latest.current.enabled||latest.current.blocked()||focused()||!isBackSwipe(from.x,touch.clientX-from.x,touch.clientY-from.y))return
      if(event.cancelable)event.preventDefault()
      latest.current.back()
    }
    const cancel=()=>{start=undefined}
    document.addEventListener('touchstart',begin,{passive:true})
    document.addEventListener('touchmove',move,{passive:false})
    document.addEventListener('touchend',end,{passive:false})
    document.addEventListener('touchcancel',cancel)
    return ()=>{document.removeEventListener('touchstart',begin);document.removeEventListener('touchmove',move);document.removeEventListener('touchend',end);document.removeEventListener('touchcancel',cancel)}
  },[enabled])
}
