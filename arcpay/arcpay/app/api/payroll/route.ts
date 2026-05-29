import { NextRequest, NextResponse } from 'next/server'
import { createWalletClient, createPublicClient, http, parseEther, formatEther } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { arcTestnet } from '../../../lib/arc'

export const runtime = 'nodejs'

// POST /api/payroll
// Body: { employees: [{address, salary, name}], trigger: 'manual'|'cron' }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { employees, trigger } = body

    // For cron, verify secret
    if (trigger === 'cron') {
      const secret = req.headers.get('x-cron-secret')
      if (secret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    // Agent wallet from env (server-side only, never exposed to client)
    const privateKey = process.env.AGENT_PRIVATE_KEY as `0x${string}`
    if (!privateKey) {
      return NextResponse.json(
        { error: 'AGENT_PRIVATE_KEY not configured. Add it in Vercel env vars.' },
        { status: 500 }
      )
    }

    const account = privateKeyToAccount(privateKey)

    const walletClient = createWalletClient({
      account,
      chain: arcTestnet,
      transport: http('https://rpc.testnet.arc.network'),
    })

    const publicClient = createPublicClient({
      chain: arcTestnet,
      transport: http('https://rpc.testnet.arc.network'),
    })

    // Check agent balance
    const balance = await publicClient.getBalance({ address: account.address })
    const balanceInUsdc = parseFloat(formatEther(balance))

    const totalNeeded = employees.reduce((s: number, e: any) => s + e.salary, 0)
    if (balanceInUsdc < totalNeeded) {
      return NextResponse.json({
        error: `Agent wallet balance too low. Has ${balanceInUsdc.toFixed(2)} USDC, needs ${totalNeeded} USDC.`,
        agentAddress: account.address,
      }, { status: 400 })
    }

    const results = []

    // Send to each employee
    for (const emp of employees) {
      try {
        const value = parseEther(emp.salary.toString())

        const hash = await walletClient.sendTransaction({
          to: emp.address as `0x${string}`,
          value,
        })

        // Wait for confirmation
        const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 30_000 })

        results.push({
          employeeName: emp.name,
          address: emp.address,
          amount: emp.salary,
          txHash: hash,
          status: receipt.status === 'success' ? 'success' : 'failed',
          blockNumber: receipt.blockNumber.toString(),
        })
      } catch (err: any) {
        results.push({
          employeeName: emp.name,
          address: emp.address,
          amount: emp.salary,
          txHash: null,
          status: 'failed',
          error: err.message,
        })
      }
    }

    const successCount = results.filter(r => r.status === 'success').length
    return NextResponse.json({
      success: true,
      trigger,
      agentAddress: account.address,
      results,
      summary: `${successCount}/${employees.length} payments sent`,
    })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// GET /api/payroll - agent wallet info
export async function GET() {
  const privateKey = process.env.AGENT_PRIVATE_KEY as `0x${string}`
  if (!privateKey) {
    return NextResponse.json({ configured: false })
  }

  try {
    const account = privateKeyToAccount(privateKey)
    const publicClient = createPublicClient({
      chain: arcTestnet,
      transport: http('https://rpc.testnet.arc.network'),
    })

    const balance = await publicClient.getBalance({ address: account.address })

    return NextResponse.json({
      configured: true,
      agentAddress: account.address,
      balance: formatEther(balance),
    })
  } catch (err: any) {
    return NextResponse.json({ configured: false, error: err.message })
  }
}
