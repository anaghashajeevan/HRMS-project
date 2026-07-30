import { useEffect, useState, useRef } from 'react';
import {
  Loader2, MessageCircle, CheckCircle2, XCircle, Send,
  QrCode, Smartphone, RefreshCw, Unplug, Power, Zap,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import api from '../../api/axios';

type SessionKey = 'primary' | 'fallback';

interface SessionStatus {
  active: boolean;
  connected: boolean;
  phone: string;
  state: string;
  qrDataUrl: string | null;
  lastError: string | null;
}

interface GatewayStatus {
  gateway_online: boolean;
  active_session: SessionKey;
  primary: SessionStatus;
  fallback: SessionStatus;
  connected: boolean;
  phone: string;
  error?: string;
}

export default function WhatsAppSettingsPage() {
  const [status, setStatus] = useState<GatewayStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [testPhone, setTestPhone] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [actionSession, setActionSession] = useState<SessionKey | null>(null);
  const pollRef = useRef<any>(null);

  // Load status on mount + poll every 3 seconds
  useEffect(() => {
    loadStatus();
    pollRef.current = setInterval(loadStatus, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const loadStatus = async () => {
    try {
      const { data } = await api.get('/leave/whatsapp/status/');
      setStatus(data);
    } catch (error: any) {
      setStatus({
        gateway_online: false,
        error: 'Gateway not reachable',
      } as any);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (sessionKey: SessionKey) => {
    setActionSession(sessionKey);
    try {
      const { data } = await api.post(`/leave/whatsapp/session/${sessionKey}/connect/`);
      toast.success(data.message || `Starting ${sessionKey}...`);
      loadStatus();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to connect');
    } finally {
      setActionSession(null);
    }
  };

  const handleDisconnect = async (sessionKey: SessionKey) => {
    if (!window.confirm(`Disconnect ${sessionKey} session? You'll need to scan QR again to reconnect.`)) {
      return;
    }
    setActionSession(sessionKey);
    try {
      const { data } = await api.post(`/leave/whatsapp/session/${sessionKey}/disconnect/`);
      toast.success(data.message || `Disconnected ${sessionKey}`);
      loadStatus();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to disconnect');
    } finally {
      setActionSession(null);
    }
  };

  const handleSwitch = async (sessionKey: SessionKey) => {
    setActionSession(sessionKey);
    try {
      await api.post('/leave/whatsapp/session/switch/', { session: sessionKey });
      toast.success(`Active session switched to ${sessionKey}`);
      loadStatus();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to switch');
    } finally {
      setActionSession(null);
    }
  };

  const handleTest = async () => {
    if (!testPhone) {
      toast.error('Enter a phone number');
      return;
    }
    setTestLoading(true);
    setTestResult(null);
    try {
      const { data } = await api.post('/leave/whatsapp/test/', { phone: testPhone });
      setTestResult(data);
      if (data.ok) toast.success(data.message);
      else toast.error(data.message);
    } catch (error: any) {
      const msg = error?.response?.data?.message || 'Test failed';
      toast.error(msg);
      setTestResult({ ok: false, message: msg });
    } finally {
      setTestLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Topbar />
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-green-600" />
          </div>
        </div>
      </div>
    );
  }

  const gatewayOffline = !status?.gateway_online;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          {/* Header */}
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-600 text-white">
              <MessageCircle className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">WhatsApp Integration</h1>
              <p className="text-sm text-gray-500">
                Connect and manage WhatsApp sessions for leave notifications
              </p>
            </div>
          </div>

          {/* Gateway Offline Warning */}
          {gatewayOffline && (
            <div className="mb-6 rounded-xl border-2 border-red-300 bg-red-50 p-5">
              <div className="flex items-start gap-3">
                <XCircle className="h-6 w-6 text-red-700 shrink-0" />
                <div>
                  <h3 className="font-bold text-red-900">Gateway Offline</h3>
                  <p className="mt-1 text-sm text-red-800">
                    The WhatsApp gateway server is not running. Start it with:
                  </p>
                  <code className="mt-2 block rounded bg-red-100 px-3 py-2 font-mono text-xs text-red-900">
                    cd whatsapp-gateway && node server.js
                  </code>
                </div>
              </div>
            </div>
          )}

          {/* Active Session Indicator */}
          {status?.gateway_online && status.connected && (
            <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                  <Zap className="h-5 w-5 text-green-700" />
                </div>
                <div>
                  <p className="text-sm font-bold text-green-900">
                    Active Session: {status.active_session === 'primary' ? '🥇 Primary' : '🔄 Fallback'}
                  </p>
                  <p className="text-xs text-green-800">
                    Currently sending via: <strong>+{status.phone}</strong>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Two Session Cards */}
          <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <SessionCard
              title="Primary Number"
              subtitle="Main WhatsApp account for notifications"
              sessionKey="primary"
              status={status?.primary}
              isActive={status?.active_session === 'primary'}
              gatewayOnline={status?.gateway_online || false}
              actionLoading={actionSession === 'primary'}
              onConnect={() => handleConnect('primary')}
              onDisconnect={() => handleDisconnect('primary')}
              onSwitch={() => handleSwitch('primary')}
              onRefresh={loadStatus}
            />
            <SessionCard
              title="Fallback Number"
              subtitle="Backup — auto-used if primary fails"
              sessionKey="fallback"
              status={status?.fallback}
              isActive={status?.active_session === 'fallback'}
              gatewayOnline={status?.gateway_online || false}
              actionLoading={actionSession === 'fallback'}
              onConnect={() => handleConnect('fallback')}
              onDisconnect={() => handleDisconnect('fallback')}
              onSwitch={() => handleSwitch('fallback')}
              onRefresh={loadStatus}
              isBackup
            />
          </div>

          {/* Test Message Section */}
          <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
            <div className="mb-4 flex items-center gap-2">
              <Send className="h-4 w-4 text-blue-600" />
              <h2 className="text-sm font-semibold uppercase text-gray-900">
                Send Test Message
              </h2>
            </div>
            <p className="mb-4 text-sm text-gray-500">
              Send a test WhatsApp using the active session ({status?.active_session}).
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="9876543210 or +919876543210"
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
              />
              <button
                onClick={handleTest}
                disabled={testLoading || !status?.connected}
                className="flex items-center justify-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
              >
                {testLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send Test
              </button>
            </div>

            {testResult && (
              <div className={`mt-4 rounded-lg border p-3 ${
                testResult.ok
                  ? 'border-green-200 bg-green-50'
                  : 'border-red-200 bg-red-50'
              }`}>
                <div className="flex items-start gap-2">
                  {testResult.ok ? (
                    <CheckCircle2 className="h-5 w-5 text-green-700 shrink-0" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-700 shrink-0" />
                  )}
                  <div className="text-sm">
                    <p className={testResult.ok ? 'font-semibold text-green-900' : 'font-semibold text-red-900'}>
                      {testResult.message}
                    </p>
                    {testResult.sent_via && (
                      <p className="mt-1 text-xs text-gray-600">
                        Sent via: {testResult.sent_via} session
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {!status?.connected && (
              <p className="mt-3 text-xs text-amber-600">
                ⚠️ No session connected. Connect a WhatsApp session above first.
              </p>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

// ============================================================================
// SESSION CARD COMPONENT
// ============================================================================

interface SessionCardProps {
  title: string;
  subtitle: string;
  sessionKey: SessionKey;
  status?: SessionStatus;
  isActive: boolean;
  isBackup?: boolean;
  gatewayOnline: boolean;
  actionLoading: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onSwitch: () => void;
  onRefresh: () => void;
}

function SessionCard({
  title,
  subtitle,
  sessionKey,
  status,
  isActive,
  isBackup,
  gatewayOnline,
  actionLoading,
  onConnect,
  onDisconnect,
  onSwitch,
  onRefresh,
}: SessionCardProps) {
  const [qrData, setQrData] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);

  // Poll for QR when in "waiting_for_scan" state
  useEffect(() => {
    if (status?.state !== 'waiting_for_scan') {
      setQrData(null);
      return;
    }

    const fetchQR = async () => {
      setQrLoading(true);
      try {
        const { data } = await api.get(`/leave/whatsapp/session/${sessionKey}/qr/`);
        if (data.qr) setQrData(data.qr);
      } catch {
        // silent
      } finally {
        setQrLoading(false);
      }
    };

    fetchQR();
    const interval = setInterval(fetchQR, 3000);
    return () => clearInterval(interval);
  }, [status?.state, sessionKey]);

  const state = status?.state || 'idle';
  const isConnected = status?.connected || false;
  const isConnecting = state === 'connecting';
  const needsScan = state === 'waiting_for_scan';

  const cardBorder = isConnected
    ? isActive ? 'border-green-300 shadow-green-100' : 'border-gray-200'
    : 'border-gray-200';

  return (
    <div className={`rounded-xl border-2 bg-white p-5 shadow-sm ${cardBorder}`}>
      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${
            isConnected
              ? isActive ? 'bg-green-600' : 'bg-gray-500'
              : 'bg-gray-300'
          } text-white`}>
            {isBackup ? <RefreshCw className="h-5 w-5" /> : <Smartphone className="h-5 w-5" />}
          </div>
          <div>
            <h3 className="font-bold text-gray-900">{title}</h3>
            <p className="text-xs text-gray-500">{subtitle}</p>
          </div>
        </div>
        {isActive && isConnected && (
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700">
            ACTIVE
          </span>
        )}
      </div>

      {/* Status Display */}
      <div className={`rounded-lg border p-3 mb-4 ${
        isConnected ? 'border-green-200 bg-green-50' :
        needsScan ? 'border-amber-200 bg-amber-50' :
        isConnecting ? 'border-blue-200 bg-blue-50' :
        'border-gray-200 bg-gray-50'
      }`}>
        <div className="flex items-center gap-2">
          {isConnected ? (
            <CheckCircle2 className="h-4 w-4 text-green-700" />
          ) : isConnecting ? (
            <Loader2 className="h-4 w-4 animate-spin text-blue-700" />
          ) : needsScan ? (
            <QrCode className="h-4 w-4 text-amber-700" />
          ) : (
            <XCircle className="h-4 w-4 text-gray-500" />
          )}
          <span className={`text-sm font-semibold ${
            isConnected ? 'text-green-900' :
            needsScan ? 'text-amber-900' :
            isConnecting ? 'text-blue-900' :
            'text-gray-700'
          }`}>
            {isConnected ? `Connected • +${status?.phone}` :
             needsScan ? 'Waiting for QR scan' :
             isConnecting ? 'Connecting...' :
             state === 'disconnected' ? 'Disconnected' :
             state === 'logged_out' ? 'Logged out' :
             state === 'error' ? 'Error' :
             'Not connected'}
          </span>
        </div>
        {status?.lastError && (
          <p className="mt-1 text-xs text-red-600">{status.lastError}</p>
        )}
      </div>

      {/* QR Code Display */}
      {needsScan && (
        <div className="mb-4 rounded-lg border-2 border-dashed border-amber-300 bg-amber-50 p-4 text-center">
          <p className="mb-3 text-sm font-semibold text-amber-900">
            📱 Scan with WhatsApp
          </p>
          <p className="mb-3 text-xs text-amber-800">
            Open WhatsApp → Settings → Linked Devices → Link a Device
          </p>
          <div className="mx-auto flex h-64 w-64 items-center justify-center rounded-lg bg-white">
            {qrData ? (
              <img src={qrData} alt="QR Code" className="h-full w-full" />
            ) : qrLoading ? (
              <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
            ) : (
              <div className="text-xs text-gray-400">Loading QR...</div>
            )}
          </div>
          <p className="mt-3 text-xs text-amber-700">
            QR expires every 20 seconds — page auto-refreshes
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        {!isConnected ? (
          <button
            onClick={onConnect}
            disabled={!gatewayOnline || actionLoading || isConnecting || needsScan}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
          >
            {actionLoading || isConnecting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Power className="h-4 w-4" />
            )}
            {isConnecting ? 'Connecting...' : needsScan ? 'Scan QR above' : 'Connect'}
          </button>
        ) : (
          <>
            {!isActive && (
              <button
                onClick={onSwitch}
                disabled={actionLoading}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <Zap className="h-4 w-4" />
                Make Active
              </button>
            )}
            <button
              onClick={onDisconnect}
              disabled={actionLoading}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              {actionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Unplug className="h-4 w-4" />
              )}
              Disconnect
            </button>
          </>
        )}
      </div>
    </div>
  );
}