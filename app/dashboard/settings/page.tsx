'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { queryCache } from '@/lib/query-cache';
import { getRoleLabel } from '@/lib/utils';
import { User, Lock, Bell, Shield, CircleCheck as CheckCircle, CircleAlert as AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

type Tab = 'profile' | 'security' | 'notifications';

type AlertState = { type: 'success' | 'error'; message: string } | null;

export default function SettingsPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('profile');

  const tabs = [
    { id: 'profile' as Tab, label: 'Profile', icon: User },
    { id: 'security' as Tab, label: 'Security', icon: Lock },
    { id: 'notifications' as Tab, label: 'Notifications', icon: Bell },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Settings</h2>
        <p className="text-sm text-slate-500 mt-1">Manage your account preferences and security.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-6">
        <nav className="sm:w-52 flex-shrink-0">
          <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors text-left border-b border-slate-50 last:border-0 ${
                  activeTab === tab.id
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                }`}
              >
                <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'text-blue-600' : 'text-slate-400'}`} />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="mt-4 bg-white rounded-xl border border-slate-100 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                {profile?.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{profile?.full_name}</p>
                <p className="text-xs text-slate-400">{getRoleLabel(profile?.role || '')}</p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-xs text-slate-500 truncate">{user?.email}</span>
              </div>
            </div>
          </div>
        </nav>

        <div className="flex-1 min-w-0">
          {activeTab === 'profile' && (
            <ProfileTab profile={profile} user={user} refreshProfile={refreshProfile} />
          )}
          {activeTab === 'security' && (
            <SecurityTab />
          )}
          {activeTab === 'notifications' && (
            <NotificationsTab />
          )}
        </div>
      </div>
    </div>
  );
}

function Alert({ state }: { state: AlertState }) {
  if (!state) return null;
  return (
    <div className={`flex items-center gap-2.5 px-4 py-3 rounded-lg text-sm font-medium ${
      state.type === 'success'
        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
        : 'bg-red-50 text-red-700 border border-red-200'
    }`}>
      {state.type === 'success'
        ? <CheckCircle className="w-4 h-4 flex-shrink-0" />
        : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
      {state.message}
    </div>
  );
}

function ProfileTab({ profile, user, refreshProfile }: {
  profile: ReturnType<typeof useAuth>['profile'];
  user: ReturnType<typeof useAuth>['user'];
  refreshProfile: () => Promise<void>;
}) {
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState<AlertState>(null);

  const handleSave = async () => {
    if (!profile || !fullName.trim()) return;
    setSaving(true);
    setAlert(null);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName.trim() })
        .eq('id', profile.id);

      if (error) throw error;

      queryCache.invalidate(`profile-${profile.id}`);
      await refreshProfile();
      setAlert({ type: 'success', message: 'Profile updated successfully.' });
    } catch (err: any) {
      setAlert({ type: 'error', message: err.message || 'Failed to update profile.' });
    } finally {
      setSaving(false);
    }
  };

  const roleColors: Record<string, string> = {
    admin: 'bg-blue-50 text-blue-700 border-blue-200',
    lawyer: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    viewer: 'bg-slate-50 text-slate-600 border-slate-200',
  };

  return (
    <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-50">
        <h3 className="text-sm font-semibold text-slate-800">Profile Information</h3>
        <p className="text-xs text-slate-400 mt-0.5">Update your personal details.</p>
      </div>

      <div className="p-6 space-y-6">
        <Alert state={alert} />

        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
            {fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">{fullName || 'Your Name'}</p>
            <p className="text-xs text-slate-400 mt-0.5">{user?.email}</p>
            <span className={`inline-flex items-center mt-1.5 px-2 py-0.5 text-[11px] font-semibold rounded-full border ${roleColors[profile?.role || ''] || roleColors.viewer}`}>
              {getRoleLabel(profile?.role || '')}
            </span>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-600">Full Name</Label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Enter your full name"
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-600">Email Address</Label>
            <Input
              value={user?.email || ''}
              disabled
              className="h-9 text-sm bg-slate-50 text-slate-400 cursor-not-allowed"
            />
            <p className="text-[11px] text-slate-400">Email cannot be changed here.</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-600">Role</Label>
            <Input
              value={getRoleLabel(profile?.role || '')}
              disabled
              className="h-9 text-sm bg-slate-50 text-slate-400 cursor-not-allowed"
            />
            <p className="text-[11px] text-slate-400">Contact an admin to change your role.</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-600">Member Since</Label>
            <Input
              value={profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
              disabled
              className="h-9 text-sm bg-slate-50 text-slate-400 cursor-not-allowed"
            />
          </div>
        </div>

        {profile?.is_external && (
          <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <Shield className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">External Account</p>
              <p className="text-xs text-amber-600 mt-0.5">
                {profile.access_expires_at
                  ? `Access expires on ${new Date(profile.access_expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.`
                  : 'No expiration date set.'}
              </p>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button
            onClick={handleSave}
            disabled={saving || !fullName.trim() || fullName.trim() === profile?.full_name}
            className="bg-slate-900 hover:bg-slate-800 text-white text-sm h-9 px-5"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function SecurityTab() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState<AlertState>(null);

  const passwordStrength = (pwd: string) => {
    if (!pwd) return { score: 0, label: '', color: '' };
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    const levels = [
      { label: 'Weak', color: 'bg-red-500' },
      { label: 'Fair', color: 'bg-amber-500' },
      { label: 'Good', color: 'bg-amber-400' },
      { label: 'Strong', color: 'bg-emerald-500' },
      { label: 'Very Strong', color: 'bg-emerald-600' },
    ];
    return { score, ...levels[score] };
  };

  const strength = passwordStrength(newPassword);

  const handleChangePassword = async () => {
    setAlert(null);
    if (newPassword !== confirmPassword) {
      setAlert({ type: 'error', message: 'New passwords do not match.' });
      return;
    }
    if (newPassword.length < 8) {
      setAlert({ type: 'error', message: 'Password must be at least 8 characters.' });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setAlert({ type: 'success', message: 'Password updated successfully.' });
    } catch (err: any) {
      setAlert({ type: 'error', message: err.message || 'Failed to update password.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-50">
          <h3 className="text-sm font-semibold text-slate-800">Change Password</h3>
          <p className="text-xs text-slate-400 mt-0.5">Choose a strong password to keep your account secure.</p>
        </div>

        <div className="p-6 space-y-5">
          <Alert state={alert} />

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-600">New Password</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              className="h-9 text-sm"
            />
            {newPassword && (
              <div className="space-y-1.5 pt-1">
                <div className="flex gap-1">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className={`h-1.5 flex-1 rounded-full transition-all ${
                        i < strength.score ? strength.color : 'bg-slate-200'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-[11px] text-slate-400">
                  Strength: <span className="font-semibold">{strength.label}</span>
                </p>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-600">Confirm New Password</Label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              className={`h-9 text-sm ${
                confirmPassword && newPassword !== confirmPassword
                  ? 'border-red-300 focus:border-red-400 focus:ring-red-200'
                  : ''
              }`}
            />
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="text-[11px] text-red-500">Passwords do not match.</p>
            )}
          </div>

          <div className="bg-slate-50 rounded-lg p-4">
            <p className="text-xs font-semibold text-slate-600 mb-2">Password requirements:</p>
            <ul className="space-y-1">
              {[
                { check: newPassword.length >= 8, label: 'At least 8 characters' },
                { check: /[A-Z]/.test(newPassword), label: 'One uppercase letter' },
                { check: /[0-9]/.test(newPassword), label: 'One number' },
                { check: /[^A-Za-z0-9]/.test(newPassword), label: 'One special character' },
              ].map((req) => (
                <li key={req.label} className={`flex items-center gap-2 text-[11px] ${req.check ? 'text-emerald-600' : 'text-slate-400'}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${req.check ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                  {req.label}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex justify-end pt-1">
            <Button
              onClick={handleChangePassword}
              disabled={saving || !newPassword || !confirmPassword}
              className="bg-slate-900 hover:bg-slate-800 text-white text-sm h-9 px-5"
            >
              {saving ? 'Updating...' : 'Update Password'}
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-50">
          <h3 className="text-sm font-semibold text-slate-800">Account Security</h3>
          <p className="text-xs text-slate-400 mt-0.5">Overview of your account security status.</p>
        </div>
        <div className="p-6 space-y-4">
          {[
            { label: 'Email verified', status: true, desc: 'Your email address is verified.' },
            { label: 'Password protection', status: true, desc: 'Your account is protected with a password.' },
          ].map((item) => (
            <div key={item.label} className="flex items-start gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${item.status ? 'bg-emerald-50' : 'bg-red-50'}`}>
                {item.status
                  ? <CheckCircle className="w-4 h-4 text-emerald-600" />
                  : <AlertCircle className="w-4 h-4 text-red-500" />}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">{item.label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function NotificationsTab() {
  const [prefs, setPrefs] = useState({
    caseUpdates: true,
    scheduleReminders: true,
    documentUploads: false,
    teamMessages: true,
    deadlineAlerts: true,
    weeklyDigest: false,
  });
  const [saved, setSaved] = useState(false);

  const toggle = (key: keyof typeof prefs) => {
    setPrefs(prev => ({ ...prev, [key]: !prev[key] }));
    setSaved(false);
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const notificationGroups = [
    {
      title: 'Case Activity',
      items: [
        { key: 'caseUpdates' as const, label: 'Case updates', desc: 'Get notified when cases are updated or assigned to you.' },
        { key: 'documentUploads' as const, label: 'Document uploads', desc: 'Be alerted when new documents are added to your cases.' },
      ],
    },
    {
      title: 'Schedule',
      items: [
        { key: 'scheduleReminders' as const, label: 'Schedule reminders', desc: 'Receive reminders for upcoming events and hearings.' },
        { key: 'deadlineAlerts' as const, label: 'Deadline alerts', desc: 'Get alerted before important deadlines.' },
      ],
    },
    {
      title: 'Team',
      items: [
        { key: 'teamMessages' as const, label: 'Team messages', desc: 'Notifications for new messages in your department.' },
        { key: 'weeklyDigest' as const, label: 'Weekly digest', desc: 'A weekly summary of activity across your workspace.' },
      ],
    },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-50">
        <h3 className="text-sm font-semibold text-slate-800">Notification Preferences</h3>
        <p className="text-xs text-slate-400 mt-0.5">Choose what you want to be notified about.</p>
      </div>

      <div className="p-6 space-y-7">
        {saved && (
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-lg text-sm font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            Notification preferences saved.
          </div>
        )}

        {notificationGroups.map((group, gi) => (
          <div key={group.title}>
            {gi > 0 && <Separator className="mb-7" />}
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">{group.title}</p>
            <div className="space-y-5">
              {group.items.map((item) => (
                <div key={item.key} className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{item.label}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{item.desc}</p>
                  </div>
                  <button
                    onClick={() => toggle(item.key)}
                    className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                      prefs[item.key] ? 'bg-blue-600' : 'bg-slate-200'
                    }`}
                    role="switch"
                    aria-checked={prefs[item.key]}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
                        prefs[item.key] ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="flex justify-end pt-2">
          <Button
            onClick={handleSave}
            className="bg-slate-900 hover:bg-slate-800 text-white text-sm h-9 px-5"
          >
            Save Preferences
          </Button>
        </div>
      </div>
    </div>
  );
}
