'use client'

import { useEffect, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { QRCodeSVG } from 'qrcode.react'
import {
  Smartphone, Wifi, WifiOff, Loader2, QrCode,
  RefreshCw, Power, PowerOff, AlertCircle
} from 'lucide-react'

interface WASession {
  tenant_id: string
  status: 'disconnected' | 'qr_pending' | 'connecting' | 'connected' | 'logged_out'
  qr_code?: string | null
  phone_number?: string | null
  connected_at?: string | null
  disconnected_at?: string | null
  last_qr_at?: string | null
  error_message?: string | null
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Wifi }> = {
  connected: { label: 'Connected', color: 'text-green-500', icon: Wifi },
  qr_pending: { label: 'Scan QR Code', color: 'text-amber-500', icon: QrCode },
  connecting: { label: 'Connecting...', color: 'text-blue-500', icon: Loader2 },
  disconnected: { label: 'Disconnected', color: 'text-muted-foreground', icon: WifiOff },
  logged_out: { label: 'Logged Out', color: 'text-red-500', icon: PowerOff },
}

export default function CockpitWhatsApp() {
  const [session, setSession] = useState<WASession | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/mandala/whatsapp?tenant=mandala')
      if (!res.ok) {
        if (res.status === 403) return
        throw new Error('Failed to fetch status')
      }
      const data = await res.json()
      setSession(data)
      setError(null)
    } catch (err) {
      console.error('WhatsApp status fetch error:', err)
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    fetchStatus().finally(() => setLoading(false))

    // Poll: 3s during QR scan, 10s otherwise
    const interval = setInterval(() => {
      fetchStatus()
    }, session?.status === 'qr_pending' || session?.status === 'connecting' ? 3000 : 10000)

    return () => clearInterval(interval)
  }, [fetchStatus, session?.status])

  const handleAction = async (action: 'connect' | 'disconnect') => {
    setActionLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/mandala/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, tenant: 'mandala' }),
      })

      const data = await res.json()
      if (!data.success && data.error) {
        setError(data.error)
      }

      // Refresh status
      await fetchStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="bg-card border border-border rounded-xl p-8 animate-pulse h-48" />
      </div>
    )
  }

  const status = session?.status || 'disconnected'
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.disconnected
  const StatusIcon = config.icon

  return (
    <div className="space-y-4">
      {/* Status Card */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center",
              status === 'connected' ? 'bg-green-50' : 'bg-muted'
            )}>
              <Smartphone className={cn("w-5 h-5", config.color)} />
            </div>
            <div>
              <h3 className="font-semibold">WhatsApp Connection</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <StatusIcon className={cn(
                  "w-4 h-4",
                  config.color,
                  status === 'connecting' && "animate-spin"
                )} />
                <span className={cn("text-sm font-medium", config.color)}>
                  {config.label}
                </span>
                {session?.phone_number && status === 'connected' && (
                  <span className="text-xs text-muted-foreground ml-2">
                    +{session.phone_number}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchStatus()}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
              title="Refresh status"
            >
              <RefreshCw className="w-4 h-4 text-muted-foreground" />
            </button>

            {status === 'connected' ? (
              <button
                onClick={() => handleAction('disconnect')}
                disabled={actionLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors text-sm font-medium disabled:opacity-50"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <PowerOff className="w-4 h-4" />}
                Disconnect
              </button>
            ) : (
              <button
                onClick={() => handleAction('connect')}
                disabled={actionLoading || status === 'connecting' || status === 'qr_pending'}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors text-sm font-medium disabled:opacity-50"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
                Connect
              </button>
            )}
          </div>
        </div>

        {/* QR Code Display */}
        {status === 'qr_pending' && session?.qr_code && (
          <div className="flex flex-col items-center py-6 border-t border-border">
            <p className="text-sm text-muted-foreground mb-4">
              Scan this QR code with your WhatsApp app to connect
            </p>
            <div className="bg-white p-4 rounded-xl shadow-sm">
              <QRCodeSVG
                value={session.qr_code}
                size={256}
                level="M"
                includeMargin
              />
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              QR code refreshes automatically. Open WhatsApp &gt; Linked Devices &gt; Link a Device
            </p>
          </div>
        )}

        {/* Connected Info */}
        {status === 'connected' && (
          <div className="border-t border-border pt-4 space-y-2">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Phone</span>
                <p className="font-medium">+{session?.phone_number || '-'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Connected Since</span>
                <p className="font-medium">
                  {session?.connected_at
                    ? new Date(session.connected_at).toLocaleString('id-ID', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })
                    : '-'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {(error || session?.error_message) && (
          <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error || session?.error_message}</span>
          </div>
        )}

        {/* Connecting State */}
        {status === 'connecting' && (
          <div className="border-t border-border pt-4 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Establishing WhatsApp connection...</p>
          </div>
        )}

        {/* Logged Out State */}
        {status === 'logged_out' && (
          <div className="border-t border-border pt-4 text-center">
            <PowerOff className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground mb-3">
              Session was logged out. Click Connect to re-pair with QR code.
            </p>
          </div>
        )}
      </div>

      {/* Info Card */}
      <div className="bg-muted/30 border border-border rounded-xl p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground mb-1">About WhatsApp Connection</p>
        <ul className="space-y-1 list-disc list-inside">
          <li>Mandala uses your WhatsApp to send and receive messages on your behalf</li>
          <li>All conversations are processed by AI and shown in the Conversations tab</li>
          <li>You can disconnect at any time — existing conversations are preserved</li>
          <li>Only one WhatsApp number can be connected per tenant at a time</li>
        </ul>
      </div>
    </div>
  )
}
