import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, UserPlus, Repeat, DollarSign, MapPin, Star, Download, Filter } from "lucide-react";

const customerMetrics = [
  { title: "Total Customers", value: "892", change: "+8.5%", trend: "up", icon: Users },
  { title: "New Customers", value: "245", change: "+12.3%", trend: "up", icon: UserPlus },
  { title: "Repeat Rate", value: "32.5%", change: "+2.1%", trend: "up", icon: Repeat },
  { title: "Avg Order Value", value: "$34.72", change: "+2.8%", trend: "up", icon: DollarSign },
  { title: "Avg Orders/Customer", value: "1.38", change: "+0.05", trend: "up", icon: Users },
  { title: "Customer Lifetime Value", value: "$47.91", change: "+5.2%", trend: "up", icon: DollarSign },
];

const topCustomers = [
  { name: "Alex Johnson", orders: 8, totalSpent: "$425.60", lastOrder: "Apr 5, 2026", status: "Active" },
  { name: "Maria Garcia", orders: 6, totalSpent: "$389.94", lastOrder: "Apr 4, 2026", status: "Active" },
  { name: "David Chen", orders: 5, totalSpent: "$337.50", lastOrder: "Apr 4, 2026", status: "Active" },
  { name: "Sarah Williams", orders: 4, totalSpent: "$719.88", lastOrder: "Apr 3, 2026", status: "Active" },
  { name: "James Wilson", orders: 3, totalSpent: "$135.00", lastOrder: "Apr 3, 2026", status: "Active" },
];

const customerSegments = [
  { segment: "New Customers (1 order)", count: 245, percentage: 27.5, color: "bg-blue-500" },
  { segment: "Repeat (2-3 orders)", count: 312, percentage: 35.0, color: "bg-green-500" },
  { segment: "Loyal (4+ orders)", count: 178, percentage: 20.0, color: "bg-purple-500" },
  { segment: "At Risk (no order in 60d)", count: 157, percentage: 17.5, color: "bg-amber-500" },
];

const geographicDistribution = [
  { state: "California", customers: 142, percentage: 15.9, color: "bg-blue-500" },
  { state: "Texas", customers: 98, percentage: 11.0, color: "bg-green-500" },
  { state: "New York", customers: 85, percentage: 9.5, color: "bg-purple-500" },
  { state: "Florida", customers: 72, percentage: 8.1, color: "bg-amber-500" },
  { state: "Illinois", customers: 64, percentage: 7.2, color: "bg-red-500" },
  { state: "Other States", customers: 431, percentage: 48.3, color: "bg-gray-500" },
];

export default function CustomersPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Customer Analytics</h2>
          <p className="text-gray-500">Customer segments, retention, and lifetime value analysis</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="gap-2">
            <Filter size={16} />
            Segment
          </Button>
          <Button className="gap-2">
            <Download size={16} />
            Export List
          </Button>
        </div>
      </div>

      {/* Customer KPI Ribbon */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-6">
        {customerMetrics.map((metric) => (
          <Card key={metric.title}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="rounded-lg p-2 bg-primary/10 text-primary">
                  <metric.icon className="h-5 w-5" />
                </div>
                <div className="text-sm text-green-600">
                  {metric.change}
                </div>
              </div>
              <div className="mt-4">
                <p className="text-sm text-gray-500">{metric.title}</p>
                <h3 className="text-2xl font-bold">{metric.value}</h3>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Top Customers */}
      <Card>
        <CardHeader>
          <CardTitle>Top Customers by Lifetime Value</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {topCustomers.map((customer) => (
              <div key={customer.name} className="flex items-center justify-between rounded-lg border p-4">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-medium">{customer.name}</h4>
                    <div className="mt-1 flex items-center gap-4 text-sm text-gray-500">
                      <span>{customer.orders} orders</span>
                      <span>•</span>
                      <span>Last order: {customer.lastOrder}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className="text-lg font-bold">{customer.totalSpent}</div>
                    <div className="text-sm text-gray-500">Total spent</div>
                  </div>
                  <div className="text-right">
                    <div className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium bg-green-100 text-green-800">
                      {customer.status}
                    </div>
                  </div>
                  <Button size="sm" variant="ghost">View</Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Customer Segments & Geographic Distribution */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Customer Segments */}
        <Card>
          <CardHeader>
            <CardTitle>Customer Segments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {customerSegments.map((segment) => (
                <div key={segment.segment} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`h-3 w-3 rounded ${segment.color}`}></div>
                    <span className="text-sm">{segment.segment}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-32">
                      <div className="h-2 w-full rounded-full bg-gray-200">
                        <div 
                          className={`h-full rounded-full ${segment.color}`}
                          style={{ width: `${segment.percentage}%` }}
                        ></div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{segment.count}</div>
                      <div className="text-sm text-gray-500">{segment.percentage}%</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-6 pt-6 border-t">
              <div className="text-sm text-gray-500 mb-2">Segment Health</div>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border p-4">
                  <div className="text-sm text-gray-500">Loyalty Rate</div>
                  <div className="mt-1 text-2xl font-bold text-green-600">55.0%</div>
                  <div className="mt-1 text-xs text-gray-500">Repeat + Loyal customers</div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="text-sm text-gray-500">Churn Risk</div>
                  <div className="mt-1 text-2xl font-bold text-amber-600">17.5%</div>
                  <div className="mt-1 text-xs text-gray-500">At-risk customers</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Geographic Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Customer Geographic Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {geographicDistribution.map((location) => (
                <div key={location.state} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MapPin className="h-4 w-4 text-gray-400" />
                    <span className="text-sm">{location.state}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-32">
                      <div className="h-2 w-full rounded-full bg-gray-200">
                        <div 
                          className={`h-full rounded-full ${location.color}`}
                          style={{ width: `${location.percentage}%` }}
                        ></div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{location.customers}</div>
                      <div className="text-sm text-gray-500">{location.percentage}%</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-6 pt-6 border-t">
              <div className="h-32 rounded-lg bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                  <MapPin className="h-10 w-10 mx-auto text-gray-300" />
                  <p className="mt-2 text-gray-400">Customer map will appear here</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Customer Retention & Lifetime Value */}
      <Card>
        <CardHeader>
          <CardTitle>Customer Retention & Lifetime Value</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <h4 className="mb-4 font-medium">Retention Rate by Cohort</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Month 1</span>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-32 rounded-full bg-gray-200">
                      <div className="h-full w-full rounded-full bg-green-500"></div>
                    </div>
                    <span className="text-sm font-medium">100%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Month 2</span>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-32 rounded-full bg-gray-200">
                      <div className="h-full w-3/4 rounded-full bg-green-500"></div>
                    </div>
                    <span className="text-sm font-medium">45%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Month 3</span>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-32 rounded-full bg-gray-200">
                      <div className="h-full w-1/2 rounded-full bg-amber-500"></div>
                    </div>
                    <span className="text-sm font-medium">32%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Month 6</span>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-32 rounded-full bg-gray-200">
                      <div className="h-full w-1/4 rounded-full bg-red-500"></div>
                    </div>
                    <span className="text-sm font-medium">18%</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="mb-4 font-medium">Lifetime Value by Segment</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">New Customers</span>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-32 rounded-full bg-gray-200">
                      <div className="h-full w-1/4 rounded-full bg-blue-500"></div>
                    </div>
                    <span className="text-sm font-medium">$34.72</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Repeat Customers</span>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-32 rounded-full bg-gray-200">
                      <div className="h-full w-1/2 rounded-full bg-green-500"></div>
                    </div>
                    <span className="text-sm font-medium">$68.45</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Loyal Customers</span>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-32 rounded-full bg-gray-200">
                      <div className="h-full w-3/4 rounded-full bg-purple-500"></div>
                    </div>
                    <span className="text-sm font-medium">$142.80</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">At-risk Customers</span>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-32 rounded-full bg-gray-200">
                      <div className="h-full w-1/5 rounded-full bg-amber-500"></div>
                    </div>
                    <span className="text-sm font-medium">$28.15</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Customer Satisfaction */}
      <Card>
        <CardHeader>
          <CardTitle>Customer Satisfaction</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-6 w-6 text-yellow-500 fill-yellow-500" />
                ))}
              </div>
              <div className="mt-2 text-3xl font-bold">4.8/5</div>
              <div className="mt-1 text-sm text-gray-500">Average Rating</div>
              <div className="mt-1 text-sm text-green-600">+0.2 from last month</div>
            </div>
            
            <div className="text-center">
              <div className="text-3xl font-bold">96.8%</div>
              <div className="mt-1 text-sm text-gray-500">Positive Reviews</div>
              <div className="mt-1 text-sm text-green-600">+1.2% from last month</div>
              <div className="mt-3 text-xs text-gray-500">4-5 stars: 96.8%</div>
              <div className="text-xs text-gray-500">3 stars: 2.1%</div>
              <div className="text-xs text-gray-500">1-2 stars: 1.1%</div>
            </div>
            
            <div className="text-center">
              <div className="text-3xl font-bold">2.4%</div>
              <div className="mt-1 text-sm text-gray-500">Return Rate</div>
              <div className="mt-1 text-sm text-green-600">-0.3% from last month</div>
              <div className="mt-3 text-xs text-gray-500">Industry average: 3.8%</div>
              <div className="text-xs text-gray-500">Better than 85% of competitors</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}