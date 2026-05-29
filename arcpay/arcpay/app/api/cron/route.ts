import { NextRequest, NextResponse } from 'next/server'

// This runs on Vercel Cron — every Monday 9AM UTC (vercel.json)
// It calls the /api/payroll endpoint with a server-side private key
// In production: store AGENT_PRIVATE_KEY in Vercel env vars

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  // Verify this is coming from Vercel Cron
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/payroll`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': process.env.CRON_SECRET || '',
      },
      body: JSON.stringify({ trigger: 'cron', schedule: 'weekly' }),
    })

    const data = await res.json()
    console.log('[CRON] Payroll triggered:', data)
    return NextResponse.json({ success: true, ...data })
  } catch (err: any) {
    console.error('[CRON] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
