# Shagun — wedding gift registry for India

Couples list products from any store, cash funds (honeymoon, new home, shagun) and gift cards. Guests open one link, reserve a gift or pay via UPI, and leave a blessing.

## Stack

| Part | Tech |
|---|---|
| Frontend | React 18 + TypeScript, Vite 5, React Router 6, `qrcode.react` |
| Backend | ASP.NET Core 8 minimal API, EF Core 8 + SQLite, cookie auth, ASP.NET Identity password hashing |

```
shagun/
├── backend/Shagun.Api/     .NET API (Program.cs = endpoints, Data.cs = models + DbContext, LinkPreview.cs)
├── frontend/               React app (src/pages, src/dashboard, src/guest, src/components)
└── prototype-node/         the first zero-dependency Node version (same API — handy as a mock)
```

## Prerequisites

- **.NET 8 SDK**: `brew install --cask dotnet-sdk`, or download it from https://dotnet.microsoft.com/download/dotnet/8.0
- **Node 18+**: already installed

## Run in development (two terminals)

```bash
cd backend/Shagun.Api && dotnet run          # API on http://localhost:5080 (creates shagun.db on first run)
```
```bash
cd frontend && npm install && npm run dev    # app on http://localhost:5173, /api proxied to :5080
```

No .NET yet? Point the React app at the Node mock, which has the same API:

```bash
node prototype-node/server.js                          # :3000
cd frontend && API_URL=http://localhost:3000 npm run dev
```

## Run as one app (production-style)

```bash
cd frontend && npm run build                 # writes into backend/Shagun.Api/wwwroot
cd ../backend/Shagun.Api && dotnet run       # serves app + API on http://localhost:5080
```

## API

| Method | Path | Who |
|---|---|---|
| POST | `/api/signup`, `/api/login`, `/api/logout` | couple |
| GET | `/api/me` (user + own registry with gifts) | couple |
| PUT | `/api/registry` (create/update) | couple |
| POST | `/api/preview` (fetch product details from a link) | couple |
| POST / PUT / DELETE | `/api/items`, `/api/items/{id}` | couple |
| PATCH | `/api/gifts/{id}` (received / thanked) | couple |
| GET | `/api/r/{slug}` (public; no address) | guest |
| POST | `/api/r/{slug}/gift` (reserve product or record UPI gift) | guest |

## Before a real launch

- **Database:** swap SQLite for Postgres (`Npgsql.EntityFrameworkCore.PostgreSQL`) and add EF migrations instead of `EnsureCreated`.
- **Hosting:** Azure App Service / Render for .NET. The React build is already served from `wwwroot`.
- **Login:** phone-number OTP (MSG91 / Firebase) is what Indian users expect.
- **Verified cash gifts:** guests self-report UPI payments today. Razorpay / Cashfree can verify payments, but then you hold funds (KYC + RBI payment-aggregator rules).
- **Revenue:** affiliate tags on product links (Amazon Associates, Flipkart, Cuelinks).
- **Security:** add antiforgery tokens and rate limiting (`Microsoft.AspNetCore.RateLimiting`) on login and guest endpoints.
- **Legal:** privacy policy and terms under the DPDP Act 2023, since you store guests' names and phone numbers.
