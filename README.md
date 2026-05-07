# BioHuez Dashboard - Next.js + shadcn/ui

A modern, polished Amazon analytics dashboard built with Next.js 15 and shadcn/ui components.

## Features

- **Modern UI**: Clean, professional dashboard with shadcn/ui components
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Dark/Light Mode**: Built-in theme support
- **Live Data Bridge**: Next.js API routes reuse the existing Python/MotherDuck data layer
- **Multi-page Navigation**: Sidebar with all dashboard sections
- **Interactive Components**: Charts, tables, metrics cards

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Run the development server

```bash
npm run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser.

### 3. Connect the Python data bridge

The Next.js API routes reuse the existing Streamlit dashboard data layer. By default, the app expects the legacy dashboard to be a sibling folder:

```bash
../biohuez-dashboard
```

If your folder layout is different, create `.env.local` from `.env.example` and set:

```bash
BIOHUEZ_LEGACY_DASHBOARD_DIR=/absolute/path/to/biohuez-dashboard
BIOHUEZ_PYTHON=/absolute/path/to/biohuez-dashboard/venv/bin/python3
```

For cloud data, also set `MOTHERDUCK_TOKEN` so the Python scripts can read MotherDuck instead of a local `biohuez.db`.

### 4. Run the faster FastAPI data service

For local development or deployment, prefer the persistent FastAPI service over spawning Python from every Next.js API route.

Terminal 1:

```bash
./venv/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

Terminal 2:

```bash
BIOHUEZ_API_BASE_URL=http://127.0.0.1:8000 npm run dev
```

The Next.js API routes will proxy to FastAPI when `BIOHUEZ_API_BASE_URL` is set. Without it, they fall back to the local Python script bridge.

## Project Structure

```
src/
├── app/                    # Next.js app router pages
│   ├── layout.tsx         # Root layout with dashboard sidebar
│   ├── page.tsx           # Dashboard overview page
│   └── globals.css        # Global styles
├── components/
│   ├── ui/                # shadcn/ui components
│   │   ├── button.tsx
│   │   └── card.tsx
│   └── dashboard-layout.tsx # Main dashboard layout
└── lib/
    └── utils.ts           # Utility functions
```

## Pages

The dashboard includes navigation for:

- **Overview** - Key metrics, sales trends, and inventory snapshot
- **Sales** - Revenue, traffic, BSR, ads, unit economics, and customer journey
- **Finance** - Settlement rollups, fees, net revenue, and margin trends
- **Geography** - Regional sales analysis
- **Returns** - FBA return rates, reasons, and SKU impact
- **Inventory** - Coverage, velocity, aging, FC distribution, and receipt events
- **Demographics** - Repeat purchase and customer mix analysis
- **Campaign** - Ad performance and latest-period search term analysis
- **Cohorts** - Retention proxy by cohort month
- **Competitor** - BSR comparison, scraped ratings, and Brand Analytics comparison sections
- **Seasonality** - Order patterns by day, week, month, and hour
- **Impact Analysis** - Before/after readout for marketing actions, search updates, and listing artwork

## Data Bridge

The dashboard reads Amazon analytics data through the legacy Python dashboard data layer. Next.js API routes can either call scripts in `scripts/get_*.py` directly or proxy to the persistent FastAPI service in `backend/main.py`.

Use `.env.local` to point the app at the legacy dashboard and Python executable when the default sibling-folder layout is not used.

Available API routes:
- `/api/summary`
- `/api/sales`
- `/api/finance`
- `/api/geography`
- `/api/returns`
- `/api/inventory`
- `/api/demographics`
- `/api/campaign`
- `/api/cohorts`
- `/api/competitor`
- `/api/seasonality`
- `/api/impact-analysis`
- `/api/system-status`

## Customization

### Colors
Edit `src/app/globals.css` to change the color scheme. The theme uses CSS variables for easy customization.

### Components
Add more shadcn/ui components:
```bash
npx shadcn@latest add [component-name]
```

### Charts
Install a charting library:
```bash
npm install recharts
# or
npm install @tremor/react
```

## Deployment

### Vercel (Recommended)
```bash
npm run build
vercel --prod
```

### Docker
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## Next Steps

1. **Route QA**: Smoke test each dashboard page against the deployed data source
2. **Authentication**: Add user login and tenant separation if this becomes customer-facing
3. **Exports**: Add CSV/PDF export for reports
4. **Alerts**: Add low-inventory, sales spike, and campaign efficiency notifications
5. **Automation**: Schedule data refreshes and surface last-refresh metadata on each page

## License

MIT
