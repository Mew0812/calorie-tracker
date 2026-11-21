import { db, snapshot, restore, validateBackup } from './model'

export async function readLocalValue<T=unknown>(key:string):Promise<T|undefined> {
  return (await db.cloudLocal.get(key))?.value as T|undefined
}
export async function writeLocalValue(key:string,value:unknown) {
  await db.cloudLocal.put({key,value})
}
export async function restoreCloudBackup(value:unknown,recoveryKey:string) {
  const next=validateBackup(value)
  await db.transaction('rw',db.tables,async()=>{
    await writeLocalValue(recoveryKey,await snapshot())
    await restore(next)
  })
  return true
}
