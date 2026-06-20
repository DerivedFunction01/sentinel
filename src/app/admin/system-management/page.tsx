import { requireAdmin } from "@/lib/auth-helpers";
import { Settings, Shield, Database, Globe, Bell, Server } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/dashboard/dashboard-parts";

export default async function SystemManagementPage() {
  await requireAdmin();

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="System Management"
        description="Configure system settings and integrations. (Mock — settings are not persisted during beta.)"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Security */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4 text-blue-400" />
              Security
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <SettingRow label="Require 2FA for all admins" description="Force two-factor authentication for admin accounts." defaultChecked />
            <Separator />
            <SettingRow label="IP allowlist" description="Restrict admin access to specific IP ranges." />
            <Separator />
            <SettingRow label="Session timeout" description="Auto-logout after 30 minutes of inactivity." defaultChecked />
          </CardContent>
        </Card>

        {/* Data & Storage */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="h-4 w-4 text-blue-400" />
              Data & Storage
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <SettingRow label="Auto-delete scans after 90 days" description="Automatically remove old scan records." />
            <Separator />
            <SettingRow label="Encrypt scan data at rest" description="AES-256 encryption for stored scan data." defaultChecked />
            <Separator />
            <SettingRow label="Backup frequency" description="Daily encrypted backups to cloud storage." defaultChecked />
          </CardContent>
        </Card>

        {/* Integrations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="h-4 w-4 text-blue-400" />
              Integrations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <SettingRow label="OpenRouter API" description="Connected — using server-side API key." defaultChecked />
            <Separator />
            <SettingRow label="Slack notifications" description="Send scan results to a Slack channel." />
            <Separator />
            <SettingRow label="Webhook alerts" description="POST to a webhook on scan completion." />
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-4 w-4 text-blue-400" />
              Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <SettingRow label="Email on scan complete" description="Notify when a scan finishes." defaultChecked />
            <Separator />
            <SettingRow label="Email on breach detected" description="Alert when a scan finds breaches." defaultChecked />
            <Separator />
            <SettingRow label="Weekly summary" description="Send a weekly report of all scans." />
          </CardContent>
        </Card>
      </div>

      {/* System info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Server className="h-4 w-4 text-blue-400" />
            System Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <InfoItem label="Version" value="0.1.0-beta" />
            <InfoItem label="Database" value="SQLite" />
            <InfoItem label="Region" value="us-east-1" />
            <InfoItem label="Uptime" value="99.9%" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SettingRow({ label, description, defaultChecked }: { label: string; description: string; defaultChecked?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0 flex-1">
        <Label className="text-sm font-medium">{label}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch defaultChecked={defaultChecked} />
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium text-foreground">{value}</p>
    </div>
  );
}
