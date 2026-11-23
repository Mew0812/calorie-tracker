import { expect,it } from 'vitest'
import { isBackSwipe } from './edgeBack'
it('左端24px以内の十分に長い右スワイプだけを戻る操作にする',()=>{
  expect(isBackSwipe(5,100,8)).toBe(true)
  expect(isBackSwipe(24,72,0)).toBe(true)
  expect(isBackSwipe(25,120,0)).toBe(false)
  expect(isBackSwipe(5,71,0)).toBe(false)
  expect(isBackSwipe(5,-120,0)).toBe(false)
  expect(isBackSwipe(5,100,100)).toBe(false)
  expect(isBackSwipe(5,100,33)).toBe(false)
})
