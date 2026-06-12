import { useState, useEffect } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { Save, AlertCircle, RefreshCw, Share2, ExternalLink, Code } from 'lucide-react';
import { motion } from 'framer-motion';

export default function FacebookIntegrationManager() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    pixelId: '',
    isWebhookActive: true
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await api.get('/settings/facebook');
      if (res.data) {
        setSettings({
          pixelId: res.data.pixelId || '',
          isWebhookActive: res.data.isWebhookActive !== false
        });
      }
    } catch (error) {
      toast.error('Failed to load Facebook settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.put('/settings/facebook', settings);
      toast.success('Facebook settings saved successfully!');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-app-text font-heading flex items-center gap-2">
          <Share2 className="text-[#1877F2]" /> Facebook Integration
        </h1>
        <p className="text-sm text-app-text-muted mt-1">Manage Facebook Pixel tracking and Webhook configuration.</p>
      </div>

      <div className="grid gap-6">
        {/* Pixel Configuration */}
        <div className="bg-app-card border border-app-border rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-bold text-app-text mb-4 flex items-center gap-2">
            <Code size={18} className="text-primary" /> Facebook Pixel Tracking
          </h2>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-app-text-muted uppercase tracking-wider block mb-1">
                Pixel ID
              </label>
              <input
                type="text"
                placeholder="e.g. 123456789012345"
                value={settings.pixelId}
                onChange={(e) => setSettings({ ...settings, pixelId: e.target.value })}
                className="w-full bg-app-bg border border-app-border rounded-lg px-4 py-2.5 text-sm text-app-text focus:outline-none focus:border-primary transition-colors"
              />
              <p className="text-xs text-app-text-muted mt-2">
                Find this in your <a href="https://business.facebook.com/events_manager" target="_blank" rel="noreferrer" className="text-primary hover:underline">Events Manager</a>. Leave empty to disable tracking.
              </p>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-black text-sm font-bold rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Pixel Settings
            </button>
          </div>
        </div>

        {/* Webhook Configuration Instructions */}
        <div className="bg-app-card border border-app-border rounded-xl p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-app-text flex items-center gap-2">
            <RefreshCw size={18} className="text-primary" /> Lead Ads Webhook Setup
          </h2>
          
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex gap-3 text-sm">
            <AlertCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="space-y-2 text-app-text">
              <p>
                To receive leads automatically from Facebook & Instagram Instant Forms, you need to configure the webhook in your Facebook Developer App.
              </p>
              <p><strong>Webhook URL:</strong> <code className="bg-app-bg px-2 py-1 rounded text-primary">https://api.vedhunt.in/api/leads/webhook/facebook</code></p>
            </div>
          </div>

          <div className="pt-4 border-t border-app-border">
            <a 
              href="https://developers.facebook.com/docs/graph-api/webhooks/getting-started" 
              target="_blank" 
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-bold text-[#1877F2] hover:underline"
            >
              View Facebook Webhook Documentation <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
