'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAccount, useConnect, useDisconnect, useSwitchChain, useBalance } from 'wagmi'
import { arcTestnet, EXPLORER_URL, FAUCET_URL } from '../lib/arc'
import { getEmployees, saveEmployee, deleteEmployee, getTxRecords, saveTxRecord, Employee, TxRecord } from '../lib/store'
import { isAddress } from 'viem'

const COLORS = ['#00D4FF','#00FF88','#FFB800','#FF88AA','#AA88FF','#88FFCC']
const AVATARS = ['🧑‍💻','👩‍💻','🧑‍🎨','👨‍🔬','👩‍🚀','🧑‍💼']

function shortAddr(addr: string) { return addr.slice(0,6)+'...'+addr.slice(-4) }
function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit'})
}

export default function Home() {
  const { address, isConnected, chain } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChain } = useSwitchChain()
  const { data: balanceData } = useBalance({ address, query: { enabled: isConnected } })

  const [employees, setEmployees] = useState<Employee[]>([])
  const [txRecords, setTxRecords] = useState<TxRecord[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [agentInfo, setAgentInfo] = useState<any>(null)
  const [toast, setToast] = useState<{msg:string,type:string}|null>(null)

  // Form state
  const [form, setForm] = useState({ name:'', address:'', salary:'', role:'', schedule:'monthly' as Employee['schedule'] })

  // Load from localStorage
  useEffect(() => {
    setEmployees(getEmployees())
    setTxRecords(getTxRecords())
  }, [])

  // Fetch agent wallet info
  useEffect(() => {
    fetch('/api/payroll').then(r=>r.json()).then(setAgentInfo).catch(()=>{})
  }, [])

  function showToast(msg: string, type='info') {
    setToast({msg, type})
    setTimeout(()=>setToast(null), 3500)
  }

  function addEmployee() {
    if (!form.name || !form.address || !form.salary) { showToast('Fill in all fields','error'); return }
    if (!isAddress(form.address)) { showToast('Invalid wallet address','error'); return }
    const salary = parseFloat(form.salary)
    if (isNaN(salary) || salary <= 0) { showToast('Invalid salary amount','error'); return }

    const emp: Employee = {
      id: Date.now().toString(),
      name: form.name,
      address: form.address as `0x${string}`,
      salary,
      role: form.role || 'Team Member',
      schedule: form.schedule,
      active: true,
      addedAt: Date.now(),
    }
    saveEmployee(emp)
    setEmployees(getEmployees())
    setForm({ name:'', address:'', salary:'', role:'', schedule:'monthly' })
    showToast(`${emp.name} added to payroll`, 'success')
  }

  function removeEmployee(id: string) {
    const emp = employees.find(e=>e.id===id)
    deleteEmployee(id)
    setEmployees(getEmployees())
    if (emp) showToast(`${emp.name} removed`, 'info')
  }

  async function runPayroll() {
    const active = employees.filter(e=>e.active)
    if (active.length === 0) { showToast('No active employees','error'); return }
    if (!agentInfo?.configured) { showToast('Agent wallet not configured. Add AGENT_PRIVATE_KEY env var.','error'); return }

    setIsRunning(true)
    showToast(`Sending ${active.length} payment${active.length>1?'s':''}...`, 'info')

    try {
      const res = await fetch('/api/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employees: active.map(e=>({name:e.name,address:e.address,salary:e.salary})), trigger:'manual' }),
      })
      const data = await res.json()

      if (!res.ok) {
        showToast(data.error || 'Payroll failed', 'error')
        return
      }

      // Save tx records
      for (const r of data.results) {
        const tx: TxRecord = {
          id: Date.now().toString() + Math.random(),
          employeeId: employees.find(e=>e.address===r.address)?.id || '',
          employeeName: r.employeeName,
          toAddress: r.address,
          amount: r.amount,
          txHash: r.txHash || 'failed',
          status: r.status,
          timestamp: Date.now(),
          blockNumber: r.blockNumber,
        }
        saveTxRecord(tx)
      }
      setTxRecords(getTxRecords())
      showToast(data.summary, 'success')
    } catch(err: any) {
      showToast(err.message, 'error')
    } finally {
      setIsRunning(false)
    }
  }

  const onWrongChain = isConnected && chain?.id !== arcTestnet.id
  const totalPayroll = employees.filter(e=>e.active).reduce((s,e)=>s+e.salary,0)
  const paidTotal = txRecords.filter(t=>t.status==='success').reduce((s,t)=>s+t.amount,0)

  return (
    <div style={{position:'relative',zIndex:1,minHeight:'100vh',display:'flex',flexDirection:'column'}}>

      {/* HEADER */}
      <header style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'18px 32px',borderBottom:'1px solid #1E2530',background:'rgba(8,11,16,0.85)',backdropFilter:'blur(12px)',position:'sticky',top:0,zIndex:100}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{width:36,height:36,background:'linear-gradient(135deg,#00D4FF,#0099CC)',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,color:'#080B10',fontSize:16}}>A</div>
          <span style={{fontSize:18,fontWeight:700}}>Arc<span style={{color:'#00D4FF'}}>Pay</span></span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{display:'flex',alignItems:'center',gap:6,padding:'5px 12px',background:'rgba(0,212,255,0.08)',border:'1px solid rgba(0,212,255,0.2)',borderRadius:20,fontFamily:'JetBrains Mono',fontSize:11,color:'#00D4FF'}}>
            <div style={{width:6,height:6,background:'#00FF88',borderRadius:'50%',animation:'pulse 2s infinite'}}></div>
            ARC TESTNET
          </div>
          {isConnected ? (
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              {onWrongChain && (
                <button onClick={()=>switchChain?.({chainId:arcTestnet.id})} style={{padding:'6px 14px',background:'rgba(255,184,0,0.15)',border:'1px solid rgba(255,184,0,0.4)',borderRadius:8,color:'#FFB800',fontFamily:'Syne,sans-serif',fontSize:12,fontWeight:600,cursor:'pointer'}}>
                  Switch to Arc
                </button>
              )}
              {balanceData && (
                <span style={{fontFamily:'JetBrains Mono',fontSize:11,color:'#8896AA'}}>
                  {parseFloat(balanceData.formatted).toFixed(4)} USDC
                </span>
              )}
              <button onClick={()=>disconnect()} style={{padding:'7px 16px',background:'rgba(0,255,136,0.08)',border:'1px solid rgba(0,255,136,0.25)',borderRadius:8,color:'#00FF88',fontFamily:'JetBrains Mono',fontSize:11,cursor:'pointer'}}>
                {shortAddr(address!)}
              </button>
            </div>
          ) : (
            <button onClick={()=>connect({connector:connectors[0]})} style={{padding:'8px 20px',background:'#00D4FF',color:'#080B10',border:'none',borderRadius:8,fontFamily:'Syne,sans-serif',fontSize:13,fontWeight:600,cursor:'pointer'}}>
              Connect Wallet
            </button>
          )}
        </div>
      </header>

      <main style={{flex:1,padding:'28px 32px',maxWidth:1200,margin:'0 auto',width:'100%'}}>

        {/* AGENT WALLET BANNER */}
        {agentInfo && !agentInfo.configured && (
          <div style={{padding:'14px 20px',background:'rgba(255,184,0,0.08)',border:'1px solid rgba(255,184,0,0.25)',borderRadius:10,marginBottom:24,display:'flex',alignItems:'center',justifyContent:'space-between',fontSize:13}}>
            <span>⚠️ <strong>Agent wallet not configured.</strong> Add <code style={{background:'rgba(255,255,255,0.08)',padding:'2px 6px',borderRadius:4,fontFamily:'JetBrains Mono',fontSize:11}}>AGENT_PRIVATE_KEY</code> to Vercel env vars to enable auto payroll.</span>
            <a href="https://vercel.com/docs/projects/environment-variables" target="_blank" style={{color:'#FFB800',fontSize:12,textDecoration:'none'}}>Learn more →</a>
          </div>
        )}
        {agentInfo?.configured && (
          <div style={{padding:'14px 20px',background:'rgba(0,255,136,0.06)',border:'1px solid rgba(0,255,136,0.2)',borderRadius:10,marginBottom:24,display:'flex',alignItems:'center',justifyContent:'space-between',fontSize:13}}>
            <span>🤖 Agent wallet active: <span style={{fontFamily:'JetBrains Mono',fontSize:11,color:'#00FF88'}}>{agentInfo.agentAddress}</span> — Balance: <strong style={{color:'#00FF88'}}>{parseFloat(agentInfo.balance).toFixed(4)} USDC</strong></span>
            <a href={FAUCET_URL} target="_blank" style={{color:'#00D4FF',fontSize:12,textDecoration:'none'}}>Get testnet USDC →</a>
          </div>
        )}

        {/* STATS */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16,marginBottom:28}}>
          {[
            {label:'Total Payroll/Mo', value:totalPayroll.toLocaleString(), unit:'USDC', accent:'#00D4FF'},
            {label:'Total Paid', value:paidTotal.toLocaleString(), unit:'USDC', accent:'#00FF88'},
            {label:'Employees', value:employees.filter(e=>e.active).length, unit:'Active', accent:'#FFB800'},
            {label:'Transactions', value:txRecords.length, unit:'On Arc', accent:'#AA88FF'},
          ].map((s,i)=>(
            <div key={i} style={{background:'#0E1219',border:'1px solid #1E2530',borderRadius:12,padding:'18px 22px',position:'relative',overflow:'hidden'}}>
              <div style={{position:'absolute',top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,${s.accent},transparent)`}}></div>
              <div style={{fontFamily:'JetBrains Mono',fontSize:10,color:'#5A6478',textTransform:'uppercase',letterSpacing:1,marginBottom:8}}>{s.label}</div>
              <div style={{fontSize:28,fontWeight:700,color:s.accent,letterSpacing:-1}}>{s.value}</div>
              <div style={{fontFamily:'JetBrains Mono',fontSize:10,color:'#8896AA',marginTop:2}}>{s.unit}</div>
            </div>
          ))}
        </div>

        {/* GRID */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 360px',gap:22,marginBottom:22}}>

          {/* EMPLOYEE TABLE */}
          <Panel title="Payroll List" icon="👥">
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 22px',borderBottom:'1px solid #1E2530'}}>
              <span style={{fontFamily:'JetBrains Mono',fontSize:10,color:'#5A6478',textTransform:'uppercase',letterSpacing:1}}>{employees.length} employees</span>
              <button
                onClick={runPayroll}
                disabled={isRunning || employees.length===0}
                style={{padding:'8px 18px',background:isRunning?'rgba(0,212,255,0.05)':'linear-gradient(135deg,#00D4FF,#0099CC)',border:isRunning?'1px solid #252D3A':'none',borderRadius:8,color:isRunning?'#5A6478':'#080B10',fontFamily:'Syne,sans-serif',fontSize:12,fontWeight:700,cursor:isRunning||employees.length===0?'not-allowed':'pointer',opacity:employees.length===0?0.4:1,transition:'all 0.2s'}}
              >
                {isRunning ? '⏳ Sending...' : '⚡ Run Payroll Now'}
              </button>
            </div>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead>
                  <tr style={{borderBottom:'1px solid #1E2530'}}>
                    {['Employee','Wallet','Salary','Schedule',''].map(h=>(
                      <th key={h} style={{padding:'10px 20px',textAlign:'left',fontFamily:'JetBrains Mono',fontSize:10,color:'#5A6478',textTransform:'uppercase',letterSpacing:1,fontWeight:400}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {employees.length === 0 ? (
                    <tr><td colSpan={5} style={{padding:'48px',textAlign:'center',color:'#5A6478',fontSize:13}}>
                      No employees yet — add one →
                    </td></tr>
                  ) : employees.map((emp,i)=>(
                    <tr key={emp.id} style={{borderBottom:'1px solid #1E2530'}}>
                      <td style={{padding:'13px 20px'}}>
                        <div style={{display:'flex',alignItems:'center',gap:10}}>
                          <div style={{width:32,height:32,borderRadius:8,background:`${COLORS[i%COLORS.length]}18`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16}}>{AVATARS[i%AVATARS.length]}</div>
                          <div>
                            <div style={{fontWeight:600,fontSize:14}}>{emp.name}</div>
                            <div style={{fontFamily:'JetBrains Mono',fontSize:10,color:'#8896AA'}}>{emp.role}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{padding:'13px 20px',fontFamily:'JetBrains Mono',fontSize:11,color:'#8896AA'}}>{shortAddr(emp.address)}</td>
                      <td style={{padding:'13px 20px'}}>
                        <div style={{fontWeight:600}}>{emp.salary.toLocaleString()}</div>
                        <div style={{fontFamily:'JetBrains Mono',fontSize:10,color:'#5A6478'}}>USDC/{emp.schedule}</div>
                      </td>
                      <td style={{padding:'13px 20px',fontFamily:'JetBrains Mono',fontSize:11,color:'#8896AA'}}>{emp.schedule}</td>
                      <td style={{padding:'13px 20px'}}>
                        <button onClick={()=>removeEmployee(emp.id)} style={{padding:'5px 11px',background:'transparent',border:'1px solid #252D3A',borderRadius:6,color:'#8896AA',fontSize:11,fontFamily:'JetBrains Mono',cursor:'pointer'}}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          {/* RIGHT SIDE */}
          <div style={{display:'flex',flexDirection:'column',gap:16}}>

            {/* ADD EMPLOYEE */}
            <Panel title="Add Employee" icon="➕">
              <div style={{padding:'18px 20px',display:'flex',flexDirection:'column',gap:14}}>
                <Field label="Full Name">
                  <Inp value={form.name} onChange={v=>setForm(f=>({...f,name:v}))} placeholder="Alice Nguyen" />
                </Field>
                <Field label="Wallet Address">
                  <Inp value={form.address} onChange={v=>setForm(f=>({...f,address:v}))} placeholder="0x..." mono />
                </Field>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                  <Field label="Salary (USDC)">
                    <Inp value={form.salary} onChange={v=>setForm(f=>({...f,salary:v}))} placeholder="1000" type="number" />
                  </Field>
                  <Field label="Schedule">
                    <select value={form.schedule} onChange={e=>setForm(f=>({...f,schedule:e.target.value as Employee['schedule']}))}
                      style={{width:'100%',background:'#141820',border:'1px solid #252D3A',borderRadius:8,padding:'9px 12px',color:'#E8EDF5',fontFamily:'JetBrains Mono',fontSize:12,outline:'none'}}>
                      <option value="weekly">Weekly</option>
                      <option value="biweekly">Bi-weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </Field>
                </div>
                <Field label="Role">
                  <Inp value={form.role} onChange={v=>setForm(f=>({...f,role:v}))} placeholder="Frontend Dev" />
                </Field>
                <button onClick={addEmployee}
                  style={{padding:'11px',background:'linear-gradient(135deg,#00D4FF,#0099CC)',border:'none',borderRadius:8,color:'#080B10',fontFamily:'Syne,sans-serif',fontSize:13,fontWeight:700,cursor:'pointer',marginTop:4}}>
                  Add to Payroll
                </button>
              </div>
            </Panel>

            {/* CRON INFO */}
            <Panel title="Auto Schedule" icon="⏰">
              <div style={{padding:'18px 20px',display:'flex',flexDirection:'column',gap:12}}>
                <div style={{padding:'14px',background:'#141820',borderRadius:10,border:'1px solid #252D3A'}}>
                  <div style={{fontFamily:'JetBrains Mono',fontSize:10,color:'#5A6478',marginBottom:6,textTransform:'uppercase',letterSpacing:1}}>Cron Schedule</div>
                  <code style={{fontFamily:'JetBrains Mono',fontSize:13,color:'#00D4FF'}}>0 9 * * 1</code>
                  <div style={{fontFamily:'JetBrains Mono',fontSize:10,color:'#8896AA',marginTop:4}}>Every Monday at 09:00 UTC</div>
                </div>
                <div style={{fontSize:12,color:'#8896AA',lineHeight:1.6}}>
                  Vercel Cron automatically triggers <code style={{fontFamily:'JetBrains Mono',fontSize:11,color:'#00D4FF',background:'rgba(0,212,255,0.08)',padding:'1px 5px',borderRadius:4}}>/api/cron</code> on schedule. Agent wallet sends USDC to all active employees.
                </div>
                <div style={{fontSize:11,color:'#5A6478',fontFamily:'JetBrains Mono'}}>
                  Edit schedule in <code>vercel.json</code>
                </div>
              </div>
            </Panel>
          </div>
        </div>

        {/* TX LOG */}
        <Panel title="Transaction Log" icon="📡">
          <div style={{padding:'10px 20px',borderBottom:'1px solid #1E2530',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <span style={{fontFamily:'JetBrains Mono',fontSize:10,color:'#5A6478',textTransform:'uppercase',letterSpacing:1}}>{txRecords.length} transactions</span>
            {txRecords.length > 0 && (
              <a href={`${EXPLORER_URL}`} target="_blank" style={{fontFamily:'JetBrains Mono',fontSize:11,color:'#00D4FF',textDecoration:'none'}}>
                View on ArcScan →
              </a>
            )}
          </div>
          <div style={{maxHeight:300,overflowY:'auto'}}>
            {txRecords.length === 0 ? (
              <div style={{padding:'48px',textAlign:'center',color:'#5A6478',fontSize:13}}>No transactions yet — run payroll to get started.</div>
            ) : txRecords.map(tx=>(
              <div key={tx.id} style={{display:'flex',alignItems:'center',gap:12,padding:'13px 20px',borderBottom:'1px solid #1E2530'}}>
                <div style={{width:32,height:32,borderRadius:8,background:tx.status==='success'?'rgba(0,255,136,0.1)':'rgba(255,68,102,0.1)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,flexShrink:0}}>
                  {tx.status==='success'?'✅':'❌'}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:500,marginBottom:3}}>→ {tx.employeeName} ({shortAddr(tx.toAddress)})</div>
                  <a href={`${EXPLORER_URL}/tx/${tx.txHash}`} target="_blank"
                    style={{fontFamily:'JetBrains Mono',fontSize:10,color:'#00D4FF',textDecoration:'none'}}>
                    {tx.txHash !== 'failed' ? `${tx.txHash.slice(0,20)}...` : 'Transaction failed'}
                  </a>
                </div>
                <div style={{textAlign:'right',flexShrink:0}}>
                  <div style={{fontFamily:'JetBrains Mono',fontSize:12,color:tx.status==='success'?'#00FF88':'#FF4466',fontWeight:500}}>
                    {tx.status==='success'?'+':''}{tx.amount.toLocaleString()} USDC
                  </div>
                  <div style={{fontFamily:'JetBrains Mono',fontSize:10,color:'#5A6478',marginTop:2}}>{formatTime(tx.timestamp)}</div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </main>

      {/* TOAST */}
      {toast && (
        <div style={{position:'fixed',bottom:24,right:24,padding:'13px 18px',background:'#141820',border:`1px solid ${toast.type==='success'?'rgba(0,255,136,0.3)':toast.type==='error'?'rgba(255,68,102,0.3)':'rgba(0,212,255,0.3)'}`,borderLeft:`3px solid ${toast.type==='success'?'#00FF88':toast.type==='error'?'#FF4466':'#00D4FF'}`,borderRadius:10,fontSize:13,minWidth:280,boxShadow:'0 8px 32px rgba(0,0,0,0.4)',zIndex:999,animation:'slideIn 0.3s ease'}}>
          {toast.type==='success'?'✅':toast.type==='error'?'❌':'ℹ️'} {toast.msg}
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes slideIn { from{opacity:0;transform:translateX(20px)} to{opacity:1;transform:translateX(0)} }
        button:hover:not(:disabled) { opacity: 0.88; }
      `}</style>
    </div>
  )
}

// ── Small helpers ──────────────────────────────────────────────────────────────
function Panel({title,icon,children}:{title:string,icon:string,children:React.ReactNode}) {
  return (
    <div style={{background:'#0E1219',border:'1px solid #1E2530',borderRadius:12,overflow:'hidden'}}>
      <div style={{display:'flex',alignItems:'center',gap:8,padding:'16px 20px',borderBottom:'1px solid #1E2530'}}>
        <div style={{width:28,height:28,borderRadius:6,background:'rgba(0,212,255,0.1)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14}}>{icon}</div>
        <span style={{fontSize:14,fontWeight:600}}>{title}</span>
      </div>
      {children}
    </div>
  )
}

function Field({label,children}:{label:string,children:React.ReactNode}) {
  return (
    <div>
      <div style={{fontFamily:'JetBrains Mono',fontSize:10,color:'#8896AA',textTransform:'uppercase',letterSpacing:1,marginBottom:5}}>{label}</div>
      {children}
    </div>
  )
}

function Inp({value,onChange,placeholder,type='text',mono=false}:{value:string,onChange:(v:string)=>void,placeholder:string,type?:string,mono?:boolean}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e=>onChange(e.target.value)}
      placeholder={placeholder}
      style={{width:'100%',background:'#141820',border:'1px solid #252D3A',borderRadius:8,padding:'9px 12px',color:'#E8EDF5',fontFamily:mono?'JetBrains Mono,monospace':'Syne,sans-serif',fontSize:mono?11:13,outline:'none'}}
    />
  )
}
