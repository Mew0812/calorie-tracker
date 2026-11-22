const number=new Intl.NumberFormat('ja-JP',{maximumFractionDigits:6,useGrouping:false})
const suffix='個|パック|袋|本|枚|杯|切れ|粒|皿|食|合|g|kg|ml|mL|L|ℓ|ミリリットル|リットル'
const numeric=new RegExp('^(\\d+(?:\\.\\d+)?)(?:/(\\d+))?\\s*('+suffix+')$')
const bare=new RegExp('^('+suffix+')$')
const gcd=(a:number,b:number):number=>b?gcd(b,a%b):a
/** Display only: never changes the registered unit or nutrient calculations. */
export function formatQuantity(unit:string,count:number) {
  const text=unit.trim()
  const match=text.match(numeric)
  if(match) {
    const numerator=Number(match[1])*count,denominator=match[2]?Number(match[2]):1
    if(denominator>0&&Number.isFinite(numerator)) {
      if(match[2]&&Number.isSafeInteger(numerator)&&Number.isSafeInteger(denominator)) {
        const divisor=gcd(numerator,denominator)
        return (denominator/divisor===1?String(numerator/divisor):`${numerator/divisor}/${denominator/divisor}`)+match[3]
      }
      return number.format(numerator/denominator)+match[3]
    }
  }
  if(bare.test(text))return number.format(count)+text
  if(!text)return number.format(count)+'単位'
  return count===1?text:text+' × '+number.format(count)
}
