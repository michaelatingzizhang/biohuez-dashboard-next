import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, DollarSign, Target, MousePointer, BarChart3, Filter, Download, Zap } from "lucide-react";

const adMetrics = [
  { title: "Total Spend", value: "$2,847", change: "+15.2%", trend: "up" },
  { title: "Sales", value: "$15,420", change: "+22.8%", trend: "up" },
  { title: "ROAS", value: "5.4x", change: "+6.5%", trend: "up" },
  { title: "ACOS", value: "18.4%", change: "-3.2%", trend: "down" },
  { title: "Clicks", value: "8,942", change: "+18.7%", trend: "up" },
  { title: "Impressions", value: "142,850", change: "+12.4%", trend: "up" },
];

const campaignPerformance = [
  { name: "Black - Auto", spend: "$842", sales: "$4,850", roas: "5.8x", acos: "17.4%", status: "Active" },
  { name: "Chocolate - Manual", spend: "$756", sales: "$3,920", roas: "5.2x", acos: "19.3%", status: "Active" },
  { name: "Blonde - Auto", spend: "$425", sales: "$2,180", roas: "5.1x", acos: "19.5%", status: "Active" },
  { name: "Red - Manual", spend: "$285", sales: "$1,320", roas: "4.6x", acos: "21.6%", status: "Paused" },
  { name: "Brand - Exact", spend: "$539", sales: "$3,150", roas: "5.8x", acos: "17.1%", status: "Active" },
];

const adTypePerformance = [
  { type: "Sponsored Products", spend: "$1,850", sales: "$9,820", roas: "5.3x", acos: "18.8%" },
  { type: "Sponsored Brands", spend: "$642", sales: "$3,850", roas: "6.0x", acos: "16.7%" },
  { type: "Sponsored Display", spend: "$355", sales: "$1,750", roas: "4.9x", acos: "20.3%" },
];

const topKeywords = [
  { keyword: "hair color", spend: "$285", sales: "$1,620", roas: "5.7x", acos: "17.6%" },
  { keyword: "natural hair dye", spend: "$198", sales: "$1,150", roas: "5.8x", acos: "17.2%" },
  { keyword: "black hair color", spend: "$165", sales: "$920", roas: "5.6x", acos: "17.9%" },
  { keyword: "chocolate brown hair", spend: "$142", sales: "$780", roas: "5.5x", acos: "18.2%" },
  { keyword: "blonde hair dye", spend: "$128", sales: "$650", roas: "5.1x", acos: "19.7%" },
];

const dailyTrends = [
  { date: "Apr 1", spend: 85, sales: 460, roas: 5.4 },
  { date: "Apr 8", spend: 92, sales: 510, roas: 5.5 },
  { date: "Apr 15", spend: 95, sales: 520, roas: 5.5 },
  { date: "Apr 22", spend: 102, sales: 560, roas: 5.5 },
  { date: "Apr 29", spend: 110, sales: 610, roas: 5.5 },
];

export default function AdvertisingPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Advertising Analytics</h2>
          <p className="text-gray-500">Campaign performance, ROAS, ACOS, and optimization insights</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="gap-2">
            <Zap size={16} />
            Optimize Now
          </Button>
          <Button className="gap-2">
            <Download size={16} />
            Export Report
          </Button>
        </div>
      </div>

      {/* Advertising KPI Ribbon */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-6">
        {adMetrics.map((metric) => (
          <Card key={metric.title}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-500">{metric.title}</div>
                <div className={`flex items-center gap-1 text-sm ${metric.trend === "up" ? "text-green-600" : "text-red-600"}`}>
                  {metric.trend === "up" ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  {metric.change}
                </div>
              </div>
              <div className="mt-2 text-2xl font-bold">{metric.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Campaign Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Campaign Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Campaign</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Spend</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Sales</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">ROAS</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">ACOS</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {campaignPerformance.map((campaign) => (
                  <tr key={campaign.name} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{campaign.name}</td>
                    <td className="px-4 py-3">{campaign.spend}</td>
                    <td className="px-4 py-3">{campaign.sales}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-green-600">
                        <TrendingUp className="h-3 w-3" />
                        {campaign.roas}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className={`flex items-center gap-1 ${parseFloat(campaign.acos) < 20 ? "text-green-600" : "text-amber-600"}`}>
                        {parseFloat(campaign.acos) < 20 ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                        {campaign.acos}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                        campaign.status === "Active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                      }`}>
                        {campaign.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost">Edit</Button>
                        <Button size="sm" variant="ghost">
                          {campaign.status === "Active" ? "Pause" : "Resume"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Ad Type Performance & Daily Trends */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Ad Type Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Performance by Ad Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {adTypePerformance.map((adType) => (
                <div key={adType.type} className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">{adType.type}</h4>
                      <div className="mt-1 flex items-center gap-4 text-sm text-gray-500">
                        <span>Spend: {adType.spend}</span>
                        <span>•</span>
                        <span>Sales: {adType.sales}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="text-lg font-bold text-green-600">{adType.roas}</div>
                        <div className="text-sm text-gray-500">ROAS</div>
                      </div>
                      <div className="text-right">
                        <div className={`text-lg font-bold ${parseFloat(adType.acos) < 20 ? "text-green-600" : "text-amber-600"}`}>
                          {adType.acos}
                        </div>
                        <div className="text-sm text-gray-500">ACOS</div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <div className="text-sm text-gray-500">CTR</div>
                      <div className="text-lg font-bold">0.65%</div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm text-gray-500">CPC</div>
                      <div className="text-lg font-bold">$0.32</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Daily Trends */}
        <Card>
          <CardHeader>
            <CardTitle>Daily Advertising Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="h-48 rounded-lg bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                  <BarChart3 className="h-12 w-12 mx-auto text-gray-300" />
                  <p className="mt-2 text-gray-400">Daily spend & sales chart will appear here</p>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Date</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Spend</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Sales</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">ROAS</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">ACOS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyTrends.map((day) => (
                      <tr key={day.date} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-2 text-sm">{day.date}</td>
                        <td className="px-4 py-2 text-sm">${day.spend}</td>
                        <td className="px-4 py-2 text-sm">${day.sales}</td>
                        <td className="px-4 py-2 text-sm">{day.roas}x</td>
                        <td className="px-4 py-2 text-sm">{((day.spend / day.sales) * 100).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Keywords */}
      <Card>
        <CardHeader>
          <CardTitle>Top Performing Keywords</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {topKeywords.map((keyword) => (
              <div key={keyword.keyword} className="flex items-center justify-between rounded-lg border p-4">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Target className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-medium">{keyword.keyword}</h4>
                    <div className="mt-1 flex items-center gap-4 text-sm text-gray-500">
                      <span>Spend: {keyword.spend}</span>
                      <span>•</span>
                      <span>Sales: {keyword.sales}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className="text-lg font-bold text-green-600">{keyword.roas}</div>
                    <div className="text-sm text-gray-500">ROAS</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-green-600">{keyword.acos}</div>
                    <div className="text-sm text-gray-500">ACOS</div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline">Increase Bid</Button>
                    <Button size="sm" variant="ghost">View</Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Optimization Recommendations */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Optimization Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                <div className="flex items-start gap-3">
                  <Zap className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-green-800">Increase Budget: Black - Auto Campaign</h4>
                    <p className="mt-1 text-sm text-green-700">ROAS of 5.8x exceeds target. Recommend increasing daily budget from $30 to $45.</p>
                    <div className="mt-2">
                      <Button size="sm" variant="outline">Apply</Button>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-3">
                  <TrendingDown className="h-5 w-5 text-amber-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-amber-800">Reduce Bids: Red - Manual Campaign</h4>
                    <p className="mt-1 text-sm text-amber-700">ACOS of 21.6% exceeds target 20%. Recommend reducing bids by 15%.</p>
                    <div className="mt-2">
                      <Button size="sm" variant="outline">Apply</Button>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                <div className="flex items-start gap-3">
                  <MousePointer className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-blue-800">Add Negative Keywords</h4>
                    <p className="mt-1 text-sm text-blue-700">"cheap", "discount" driving unqualified traffic. Add as negative keywords.</p>
                    <div className="mt-2">
                      <Button size="sm" variant="outline">Add Now</Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Performance Benchmarks */}
        <Card>
          <CardHeader>
            <CardTitle>Performance Benchmarks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Your ROAS</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-green-600">5.4x</span>
                  <div className="h-2 w-32 rounded-full bg-gray-200">
                    <div className="h-full w-3/4 rounded-full bg-green-500"></div>
                  </div>
                  <span className="text-sm text-gray-500">Industry: 4.2x</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Your ACOS</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-green-600">18.4%</span>
                  <div className="h-2 w-32 rounded-full bg-gray-200">
                    <div className="h-full w-1/2 rounded-full bg-green-500"></div>
                  </div>
                  <span className="text-sm text-gray-500">Industry: 25.0%</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Your CTR</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold">0.65%</span>
                  <div className="h-2 w-32 rounded-full bg-gray-200">
                    <div className="h-full w-2/5 rounded-full bg-amber-500"></div>
                  </div>
                  <span className="text-sm text-gray-500">Industry: 0.55%</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Your CPC</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold">$0.32</span>
                  <div className="h-2 w-32 rounded-full bg-gray-200">
                    <div className="h-full w-1/3 rounded-full bg-green-500"></div>
                  </div>
                  <span className="text-sm text-gray-500">Industry: $0.45</span>
                </div>
              </div>
              <div className="pt-4 border-t">
                <div className="text-sm text-gray-500">Overall Performance</div>
                <div className="mt-1 text-2xl font-bold text-green-600">Above Average</div>
                <div className="mt-1 text-sm text-gray-500">Performing better than 75% of similar hair color brands</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}