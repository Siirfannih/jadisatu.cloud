export default function Settings() {
  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Configure your Dashboard OS.</p>
      </div>
      <div className="bg-card border border-border rounded-xl p-6 space-y-4">
        <h3 className="font-semibold">Integrations</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg border border-border/50">
            <div><p className="font-medium text-sm">Supabase</p><p className="text-xs text-muted-foreground">Database connected</p></div>
            <span className="text-xs bg-green-500/10 text-green-400 px-2 py-1 rounded">Connected</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg border border-border/50">
            <div><p className="font-medium text-sm">OpenClaw</p><p className="text-xs text-muted-foreground">Agent platform</p></div>
            <span className="text-xs bg-green-500/10 text-green-400 px-2 py-1 rounded">Connected</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg border border-border/50">
            <div><p className="font-medium text-sm">Google Calendar</p><p className="text-xs text-muted-foreground">Schedule sync</p></div>
            <span className="text-xs bg-yellow-500/10 text-yellow-400 px-2 py-1 rounded">Not configured</span>
          </div>
        </div>
      </div>
    </div>
  )
}
