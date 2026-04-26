# BioHuez Dashboard - Next.js + shadcn/ui

A modern, polished Amazon analytics dashboard built with Next.js 15 and shadcn/ui components.

## Features

- **Modern UI**: Clean, professional dashboard with shadcn/ui components
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Dark/Light Mode**: Built-in theme support
- **Real-time Data**: Placeholder for Amazon SP-API integration
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

Open [http://localhost:3000](http://localhost:3000) in your browser.

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

- **Overview** - Key metrics and charts
- **Sales** - Revenue and units analytics
- **Finance** - P&L, fees, margins
- **Inventory** - Stock levels and alerts
- **Orders** - Order management
- **Customers** - Customer analytics
- **Advertising** - Ad performance (ACOS, ROAS)
- **Settings** - Account and preferences

## Connecting to Amazon SP-API

This is a frontend template. To connect to your actual Amazon data:

1. **Backend API**: Create a FastAPI/Express backend that connects to your DuckDB/MotherDuck database
2. **API Routes**: Add Next.js API routes in `src/app/api/`
3. **Data Fetching**: Replace placeholder data with real API calls

Example API route structure:
- `/api/sales` - Get sales data
- `/api/inventory` - Get inventory levels
- `/api/orders` - Get recent orders
- `/api/metrics` - Get KPI metrics

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

1. **Connect to Backend**: Replace placeholder data with real API calls
2. **Add Authentication**: Implement user login and multi-tenant support
3. **Add Charts**: Integrate Recharts or Tremor for data visualization
4. **Add Real-time Updates**: Implement WebSocket or polling for live data
5. **Add Export Features**: CSV/PDF export for reports
6. **Add Notifications**: Alert system for low inventory, sales spikes, etc.

## License

MIT