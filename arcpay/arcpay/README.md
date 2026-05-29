# ArcPay — Autonomous Payroll Agent

Tự động gửi USDC theo lịch cho team của bạn trên **Arc Testnet**.

## Tech Stack
- **Next.js 14** (App Router)
- **wagmi v2 + viem** — wallet connect & transactions
- **Vercel Cron Jobs** — tự động chạy định kỳ
- **Arc Testnet** — Chain ID 5042002, gas token USDC

---

## Deploy lên Vercel (5 bước)

### 1. Clone & push lên GitHub
```bash
git init
git add .
git commit -m "init arcpay"
gh repo create arcpay --public --push
```

### 2. Import vào Vercel
- Vào https://vercel.com/new
- Chọn repo vừa tạo → Import

### 3. Thêm Environment Variables
Trong Vercel dashboard → Settings → Environment Variables:

| Key | Value |
|-----|-------|
| `AGENT_PRIVATE_KEY` | Private key của agent wallet (0x...) |
| `CRON_SECRET` | Random string (openssl rand -hex 32) |
| `NEXT_PUBLIC_APP_URL` | URL Vercel tự gen (vd: https://arcpay.vercel.app) |

### 4. Fund Agent Wallet
- Lấy address từ private key trên
- Vào https://faucet.arc.network → claim testnet USDC
- Agent wallet cần đủ USDC để trả lương

### 5. Deploy
Vercel tự build & deploy. Cron job chạy mỗi thứ Hai 9:00 UTC.

---

## Cách dùng

1. **Connect MetaMask** → Switch sang Arc Testnet (Chain ID: 5042002)
2. **Add employees** — nhập tên, wallet address, lương USDC
3. **Run Payroll Now** — gửi ngay, hoặc để cron tự chạy
4. **Transaction log** — click tx hash để xem trên ArcScan

---

## Arc Testnet Config (MetaMask manual)
```
Network Name: Arc Testnet
RPC URL:      https://rpc.testnet.arc.network
Chain ID:     5042002
Symbol:       USDC
Explorer:     https://testnet.arcscan.app
```

## Thay đổi lịch cron
Sửa `vercel.json`:
```json
"schedule": "0 9 * * 1"   // Thứ Hai 9:00 UTC
"schedule": "0 9 1 * *"   // Ngày 1 mỗi tháng
"schedule": "0 9 * * 1,3,5" // Thứ 2, 4, 6
```

---

## Faucet & Resources
- Testnet Faucet: https://faucet.arc.network
- Explorer: https://testnet.arcscan.app
- Arc Docs: https://docs.arc.io
