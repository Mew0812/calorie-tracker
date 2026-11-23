import { useEffect, useRef, useState } from 'react'
import { drawIconText, imagePlacement, limitIconText, supportsIconText } from './iconDrawing'

type Mode='文字・数字'|'写真・画像'
const backgroundDefault='#2463eb'
export default function AppIcon({onDirty}:{onDirty?:(dirty:boolean)=>void}) {
  const [mode,setMode]=useState<Mode>()
  const [text,setText]=useState('食')
  const [background,setBackground]=useState(backgroundDefault)
  const [foreground,setForeground]=useState('#ffffff')
  const [file,setFile]=useState<File>()
  const [photo,setPhoto]=useState<HTMLImageElement>()
  const [zoom,setZoom]=useState(1),[x,setX]=useState(0),[y,setY]=useState(0)
  const [size,setSize]=useState(1024)
  const [error,setError]=useState('')
  const [renderReady,setRenderReady]=useState(false)
  const [saved,setSaved]=useState<string>()
  const canvas=useRef<HTMLCanvasElement>(null)
  const value=supportsIconText?limitIconText(text.trim()):''
  const showCanvas=mode==='文字・数字'||mode==='写真・画像'&&!!photo
  const signature=JSON.stringify({mode,value,background,foreground,file:file&&[file.name,file.size,file.lastModified],zoom,x,y,size})
  const dirty=!!mode&&(mode==='文字・数字'?!!value:!!file)&&signature!==saved
  useEffect(()=>{onDirty?.(dirty);return ()=>onDirty?.(false)},[onDirty,dirty])
  useEffect(()=>{
    if(!file)return
    const url=URL.createObjectURL(file),image=new Image()
    image.onload=()=>setPhoto(image)
    image.onerror=()=>setError('画像を開けませんでした。JPG、PNG、WebPなどの画像を選んでください。')
    image.src=url
    return ()=>{image.onload=null;image.onerror=null;URL.revokeObjectURL(url)}
  },[file])
  useEffect(()=>{
    setRenderReady(false)
    if(!showCanvas)return
    try {
      const ctx=canvas.current?.getContext('2d',{alpha:false})
      if(!ctx)throw new Error('アイコンを描画できませんでした。')
      const edge=ctx.canvas.width
      ctx.fillStyle=mode==='写真・画像'?backgroundDefault:background
      ctx.fillRect(0,0,edge,edge)
      if(mode==='写真・画像'&&photo) {
        const rect=imagePlacement(photo.naturalWidth,photo.naturalHeight,edge,zoom,x,y)
        ctx.imageSmoothingQuality='high';ctx.drawImage(photo,rect.left,rect.top,rect.width,rect.height)
      } else if(value)drawIconText(ctx,value,edge,foreground)
      setRenderReady(mode==='写真・画像'?!!photo:!!value)
    }catch(cause){setError(cause instanceof Error?cause.message:'アイコンを描画できませんでした。')}
  },[mode,showCanvas,value,background,foreground,photo,zoom,x,y])
  function png() {
    if(!canvas.current||!renderReady)throw new Error('アイコンのプレビューを確認してください。')
    const output=document.createElement('canvas');output.width=size;output.height=size
    const ctx=output.getContext('2d',{alpha:false})
    if(!ctx)throw new Error('画像を生成できませんでした。')
    ctx.imageSmoothingQuality='high';ctx.drawImage(canvas.current,0,0,size,size)
    return output.toDataURL('image/png')
  }
  function download() {
    try {
      setError('')
      const link=document.createElement('a');link.href=png();link.download=`mydiet-icon-${size}.png`
      document.body.append(link);link.click();link.remove();setSaved(signature)
    }catch{setError('PNGを保存できませんでした。もう一度お試しください。')}
  }
  async function share() {
    try {
      setError('')
      // Generate synchronously so the iOS share sheet keeps the user's activation.
      const bytes=Uint8Array.from(atob(png().split(',')[1]),char=>char.charCodeAt(0))
      const files=[new File([bytes],`mydiet-icon-${size}.png`,{type:'image/png'})]
      if(!navigator.canShare?.({files})){download();return}
      await navigator.share({files})
      setSaved(signature)
    }catch(cause){if(!(cause instanceof DOMException&&cause.name==='AbortError'))setError('共有できませんでした。「PNGを保存」をお試しください。')}
  }
  return <section className="card detail icon-editor" aria-label="アイコン作成">
    <div className="icon-modes">{(['文字・数字','写真・画像'] as const).map(option=><button key={option} aria-pressed={mode===option}
      disabled={option==='文字・数字'&&!supportsIconText} onClick={()=>{setMode(option);setRenderReady(false);setError('')}}>{option}</button>)}</div>
    {showCanvas?<canvas className="icon-preview" ref={canvas} width={1024} height={1024} role="img" aria-label="作成したアイコンのプレビュー"/>
      :<img className="icon-preview" src={import.meta.env.BASE_URL+'icon-512.png'} alt="現在のMyDietアイコン"/>}
    {!supportsIconText&&<p>文字アイコンには新しいSafariなどのブラウザーが必要です。</p>}
    {mode==='文字・数字'&&<>
      <label>文字・数字（1〜5文字）<input value={text} onChange={event=>setText((event.nativeEvent as InputEvent).isComposing?event.target.value:limitIconText(event.target.value))}
        onCompositionEnd={event=>setText(limitIconText(event.currentTarget.value))}/></label>
      <div className="icon-colors"><label>背景色<input type="color" value={background} onChange={event=>setBackground(event.target.value)}/></label>
        <label>文字色<input type="color" value={foreground} onChange={event=>setForeground(event.target.value)}/></label></div>
    </>}
    {mode==='写真・画像'&&<>
      <label>画像を選択<input type="file" accept="image/*" onChange={event=>{
        const next=event.currentTarget.files?.[0];event.currentTarget.value='';if(!next)return
        if(next.size>25*1024*1024){setError('25 MB以下の画像を選んでください。');return}
        setFile(next);setPhoto(undefined);setRenderReady(false);setError('');setZoom(1);setX(0);setY(0)
      }}/></label>
      {photo&&<>
        <label>拡大・縮小<input type="range" min="1" max="4" step="0.01" value={zoom} onChange={event=>setZoom(event.target.valueAsNumber)}/></label>
        <label>左右の位置<input type="range" min="-100" max="100" value={x} onChange={event=>setX(event.target.valueAsNumber)}/></label>
        <label>上下の位置<input type="range" min="-100" max="100" value={y} onChange={event=>setY(event.target.valueAsNumber)}/></label>
      </>}
    </>}
    {mode&&<>
      <label>出力サイズ<select value={size} onChange={event=>setSize(Number(event.target.value))}>
        {[1024,512,192,180].map(edge=><option key={edge} value={edge}>{edge} × {edge} px{edge===180?'（Apple用）':''}</option>)}
      </select></label>
      <div className="icon-actions"><button className="primary" disabled={!renderReady} onClick={download}>PNGを保存</button>
        {typeof navigator.share==='function'&&typeof navigator.canShare==='function'&&<button disabled={!renderReady} onClick={()=>void share()}>共有・ファイルに保存</button>}</div>
    </>}
    {error&&<p className="danger" role="alert">{error}</p>}
    <p className="muted">保存したPNGだけでは、ホーム画面アイコンは変わりません。正式アイコンの組み込みと公開は別の操作です。食品・記録データの変更やGitHubへの自動アップロードは行いません。</p>
  </section>
}
