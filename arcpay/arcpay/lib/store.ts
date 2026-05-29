export interface Employee {
  id: string
  name: string
  address: `0x${string}`
  salary: number   // in USDC (whole units)
  role: string
  schedule: 'weekly' | 'biweekly' | 'monthly'
  active: boolean
  addedAt: number
}

export interface TxRecord {
  id: string
  employeeId: string
  employeeName: string
  toAddress: string
  amount: number
  txHash: string
  status: 'success' | 'failed'
  timestamp: number
  blockNumber?: number
}

const EMP_KEY = 'arcpay_employees'
const TX_KEY  = 'arcpay_transactions'

export function getEmployees(): Employee[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(EMP_KEY) || '[]') } catch { return [] }
}

export function saveEmployee(emp: Employee) {
  const list = getEmployees()
  const idx = list.findIndex(e => e.id === emp.id)
  if (idx >= 0) list[idx] = emp
  else list.push(emp)
  localStorage.setItem(EMP_KEY, JSON.stringify(list))
}

export function deleteEmployee(id: string) {
  const list = getEmployees().filter(e => e.id !== id)
  localStorage.setItem(EMP_KEY, JSON.stringify(list))
}

export function getTxRecords(): TxRecord[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(TX_KEY) || '[]') } catch { return [] }
}

export function saveTxRecord(tx: TxRecord) {
  const list = getTxRecords()
  list.unshift(tx)
  // keep last 200
  localStorage.setItem(TX_KEY, JSON.stringify(list.slice(0, 200)))
}
