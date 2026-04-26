import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Package, Truck, CheckCircle, Clock, AlertCircle, Download, Filter } from "lucide-react";

const orderMetrics = [
  { title: "Total Orders", value: "1,234", change: "+5.7%", trend: "up", icon: ShoppingCart },
  { title: "Pending", value: "42", change: "-12.5%", trend: "down", icon: Clock },
  { title: "Shipped", value: "892", change: "+8.2%", trend: "up", icon: Truck },
  { title: "Delivered", value: "1,142", change: "+6.8%", trend: "up", icon: CheckCircle },
  { title: "Cancelled", value: "12", change: "-25.0%", trend: "down", icon: AlertCircle },
  { title: "Avg Delivery Time", value: "2.8 days", change: "-0.3", trend: "down", icon: Package },
];

const recentOrders = [
  { id: "#ORD-7842", customer: "Alex Johnson", amount: "$89.99", items: 2, status: "Delivered", date: "Apr 5, 2026" },
  { id: "#ORD-7841", customer: "Maria Garcia", amount: "$129.98", items: 3, status: "Shipped", date: "Apr 4, 2026" },
  { id: "#ORD-7840", customer: "David Chen", amount: "$67.50", items: 1, status: "Processing", date: "Apr 4, 2026" },
  { id: "#ORD-7839", customer: "Sarah Williams", amount: "$179.97", items: 4, status: "Delivered", date: "Apr 3, 2026" },
  { id: "#ORD-7838", customer: "James Wilson", amount: "$45.00", items: 1, status: "Delivered", date: "Apr 3, 2026" },
  { id: "#ORD-7837", customer: "Lisa Brown", amount: "$98.99", items: 2, status: "Shipped", date: "Apr 2, 2026" },
];

const orderStatusDistribution = [
  { status: "Delivered", count: 1142, percentage: 92.5, color: "bg-green-500" },
  { status: "Shipped", count: 892, percentage: 72.3, color: "bg-blue-500" },
  { status: "Processing", count: 42, percentage: 3.4, color: "bg-amber-500" },
  { status: "Cancelled", count: 12, percentage: 1.0, color: "bg-red-500" },
];

export default function OrdersPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Order Management</h2>
          <p className="text-gray-500">Track, manage, and analyze customer orders</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="gap-2">
            <Filter size={16} />
            Filter Orders
          </Button>
          <Button className="gap-2">
            <Download size={16} />
            Export Orders
          </Button>
        </div>
      </div>

      {/* Order KPI Ribbon */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-6">
        {orderMetrics.map((metric) => (
          <Card key={metric.title}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className={`rounded-lg p-2 ${metric.trend === "up" ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"}`}>
                  <metric.icon className="h-5 w-5" />
                </div>
                <div className={`text-sm ${metric.trend === "up" ? "text-green-600" : "text-red-600"}`}>
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

      {/* Recent Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Order ID</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Customer</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Amount</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Items</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Date</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{order.id}</td>
                    <td className="px-4 py-3">{order.customer}</td>
                    <td className="px-4 py-3 font-medium">{order.amount}</td>
                    <td className="px-4 py-3">{order.items}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                        order.status === "Delivered" ? "bg-green-100 text-green-800" :
                        order.status === "Shipped" ? "bg-blue-100 text-blue-800" :
                        "bg-amber-100 text-amber-800"
                      }`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{order.date}</td>
                    <td className="px-4 py-3">
                      <Button size="sm" variant="ghost">View</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button variant="ghost" className="mt-4 w-full">
            View All Orders
          </Button>
        </CardContent>
      </Card>

      {/* Order Status & Timeline */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Order Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Order Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {orderStatusDistribution.map((status) => (
                <div key={status.status} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`h-3 w-3 rounded ${status.color}`}></div>
                    <span className="text-sm">{status.status}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-32">
                      <div className="h-2 w-full rounded-full bg-gray-200">
                        <div 
                          className={`h-full rounded-full ${status.color}`}
                          style={{ width: `${status.percentage}%` }}
                        ></div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{status.count}</div>
                      <div className="text-sm text-gray-500">{status.percentage}%</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Order Timeline */}
        <Card>
          <CardHeader>
            <CardTitle>Order Fulfillment Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="h-48 rounded-lg bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                  <Clock className="h-12 w-12 mx-auto text-gray-300" />
                  <p className="mt-2 text-gray-400">Order timeline chart will appear here</p>
                  <p className="text-sm text-gray-400">Average time from order to delivery</p>
                </div>
              </div>
              
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-sm text-gray-500">Order to Ship</div>
                  <div className="text-lg font-bold">1.2 days</div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-500">Ship to Delivery</div>
                  <div className="text-lg font-bold">1.6 days</div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-500">Total Time</div>
                  <div className="text-lg font-bold">2.8 days</div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-500">On-time Rate</div>
                  <div className="text-lg font-bold text-green-600">96.8%</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Order Value Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Order Value Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="text-center">
              <div className="text-sm text-gray-500">Average Order Value</div>
              <div className="mt-1 text-3xl font-bold">$34.72</div>
              <div className="mt-1 text-sm text-green-600">+2.8% from last month</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-500">Median Order Value</div>
              <div className="mt-1 text-3xl font-bold">$28.50</div>
              <div className="mt-1 text-sm text-green-600">+1.5% from last month</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-500">Order Value Range</div>
              <div className="mt-1 text-3xl font-bold">$12 - $245</div>
              <div className="mt-1 text-sm text-gray-500">Most common: $25-50</div>
            </div>
          </div>
          
          <div className="mt-6">
            <div className="text-sm text-gray-500 mb-2">Order Value Distribution</div>
            <div className="h-2 w-full rounded-full bg-gray-200">
              <div className="h-full w-1/4 rounded-full bg-blue-500"></div>
              <div className="h-full w-1/2 rounded-full bg-green-500 ml-1/4"></div>
              <div className="h-full w-1/5 rounded-full bg-amber-500 ml-3/4"></div>
            </div>
            <div className="mt-2 flex justify-between text-xs text-gray-500">
              <span>$0-25 (24%)</span>
              <span>$25-50 (52%)</span>
              <span>$50+ (24%)</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}