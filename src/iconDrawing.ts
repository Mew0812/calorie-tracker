export const supportsIconText=typeof Intl.Segmenter==='function'
const segmenter=supportsIconText?new Intl.Segmenter('ja',{granularity:'grapheme'}):undefined
export function limitIconText(value:string) {
  if(!segmenter)throw new Error('文字アイコンには新しいSafariなどのブラウザーが必要です。')
  return Array.from(segmenter.segment(value),item=>item.segment).slice(0,5).join('')
}
export function imagePlacement(width:number,height:number,edge:number,zoom:number,x:number,y:number) {
  if(![width,height,edge,zoom,x,y].every(Number.isFinite)||Math.min(width,height,edge)<=0)throw new Error('画像のサイズが正しくありません。')
  const scale=Math.max(edge/width,edge/height)*Math.min(4,Math.max(1,zoom))
  const w=width*scale,h=height*scale
  return {width:w,height:h,left:(edge-w)*(1-Math.max(-100,Math.min(100,x))/100)/2,top:(edge-h)*(1-Math.max(-100,Math.min(100,y))/100)/2}
}
export function drawIconText(ctx:CanvasRenderingContext2D,text:string,edge:number,color:string) {
  ctx.fillStyle=color;ctx.textAlign='left';ctx.textBaseline='alphabetic'
  ctx.font='700 760px system-ui, sans-serif'
  const measure=ctx.measureText(text)
  const left=measure.actualBoundingBoxLeft,right=measure.actualBoundingBoxRight
  const ascent=measure.actualBoundingBoxAscent,descent=measure.actualBoundingBoxDescent
  const width=left+right||measure.width,height=ascent+descent
  const scale=Math.min(1,edge*.72/Math.max(width,1),edge*.72/Math.max(height,1))
  ctx.save();ctx.translate(edge/2,edge/2);ctx.scale(scale,scale)
  ctx.fillText(text,(left-right)/2,(ascent-descent)/2);ctx.restore()
}
