import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings, User, Bell, Shield, Database, Globe, CreditCard, Download } from "lucide-react";

const settingsSections = [
  {
    title: "Account Settings",
    icon: User,
    items: [
      { label: "Profile Information", description: "Update your name, email, and contact details" },
      { label: "Password & Security", description: "Change password and manage security settings" },
      { label: "Notification Preferences", description: "Configure email and push notifications" },
    ]
  },
  {
    title: "Data & Integration",
    icon: Database,
    items: [
      { label: "Amazon SP-API Connection", description: "Manage Amazon Seller Central API credentials" },
      { label: "Data Sync Settings", description: "Configure automatic data sync frequency" },
      { label: "Export Settings", description: "Set up automated report exports" },
    ]
  },
  {
    title: "Billing & Subscription",
    icon: CreditCard,
    items: [
      { label: "Current Plan", description: "View plan details and usage limits" },
      { label: "Payment Method", description: "Update credit card and billing information" },
      { label: "Billing History", description: "View past invoices and payments" },
    ]
  },
  {
    title: "Preferences",
    icon: Settings,
    items: [
      { label: "Dashboard Preferences", description: "Customize dashboard layout and widgets" },
      { label: "Currency & Units", description: "Set default currency and measurement units" },
      { label: "Time Zone", description: "Configure time zone for reporting" },
    ]
  },
];

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Settings</h2>
          <p className="text-gray-500">Manage your account, preferences, and integrations</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="gap-2">
            <Download size={16} />
            Export Settings
          </Button>
          <Button>Save Changes</Button>
        </div>
      </div>

      {/* Account Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Account Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-4">
            <div>
              <div className="text-sm text-gray-500">Plan</div>
              <div className="mt-1 text-lg font-bold">Pro</div>
              <div className="mt-1 text-sm text-gray-500">$299/month</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Users</div>
              <div className="mt-1 text-lg font-bold">3/5</div>
              <div className="mt-1 text-sm text-gray-500">Active users</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Data Sync</div>
              <div className="mt-1 text-lg font-bold">Daily</div>
              <div className="mt-1 text-sm text-gray-500">Last sync: Today, 8:30 AM</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Next Billing</div>
              <div className="mt-1 text-lg font-bold">May 1, 2026</div>
              <div className="mt-1 text-sm text-gray-500">Auto-renewal enabled</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Settings Sections */}
      <div className="grid gap-6 lg:grid-cols-2">
        {settingsSections.map((section) => (
          <Card key={section.title}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-lg p-2 bg-primary/10">
                  <section.icon className="h-5 w-5 text-primary" />
                </div>
                <CardTitle>{section.title}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {section.items.map((item) => (
                  <div key={item.label} className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <h4 className="font-medium">{item.label}</h4>
                      <p className="mt-1 text-sm text-gray-500">{item.description}</p>
                    </div>
                    <Button size="sm" variant="outline">Configure</Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* API & Integration Status */}
      <Card>
        <CardHeader>
          <CardTitle>API & Integration Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <Database className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <h4 className="font-medium">Amazon SP-API</h4>
                  <p className="mt-1 text-sm text-gray-500">Connected to BioHuez Seller Account</p>
                  <div className="mt-1 text-xs text-gray-500">Last sync: Today, 8:30 AM • Next sync: 9:00 AM</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium bg-green-100 text-green-800">
                  Connected
                </div>
                <Button size="sm" variant="outline">Reconnect</Button>
              </div>
            </div>
            
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <Globe className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <h4 className="font-medium">Amazon Ads API</h4>
                  <p className="mt-1 text-sm text-gray-500">Connected for advertising data</p>
                  <div className="mt-1 text-xs text-gray-500">Campaigns, keywords, performance metrics</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium bg-green-100 text-green-800">
                  Connected
                </div>
                <Button size="sm" variant="outline">Configure</Button>
              </div>
            </div>
            
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <h4 className="font-medium">Stripe Billing</h4>
                  <p className="mt-1 text-sm text-gray-500">Payment processing integration</p>
                  <div className="mt-1 text-xs text-gray-500">Next invoice: May 1, 2026 • Card ending in 4242</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium bg-amber-100 text-amber-800">
                  Active
                </div>
                <Button size="sm" variant="outline">Update</Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card>
        <CardHeader>
          <CardTitle>Data Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="rounded-lg border p-4">
              <div className="text-sm text-gray-500">Data Retention</div>
              <div className="mt-1 text-lg font-bold">24 months</div>
              <p className="mt-1 text-sm text-gray-500">Historical data kept for analysis</p>
              <Button size="sm" variant="outline" className="mt-3">Adjust</Button>
            </div>
            
            <div className="rounded-lg border p-4">
              <div className="text-sm text-gray-500">Backup Frequency</div>
              <div className="mt-1 text-lg font-bold">Daily</div>
              <p className="mt-1 text-sm text-gray-500">Automatic backups to secure storage</p>
              <Button size="sm" variant="outline" className="mt-3">Backup Now</Button>
            </div>
            
            <div className="rounded-lg border p-4">
              <div className="text-sm text-gray-500">Data Export</div>
              <div className="mt-1 text-lg font-bold">CSV, Excel, PDF</div>
              <p className="mt-1 text-sm text-gray-500">Export formats available</p>
              <Button size="sm" variant="outline" className="mt-3">Export All</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}