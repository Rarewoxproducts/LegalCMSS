'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { supabase, Profile } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Users, Search, Pencil, ShieldAlert, UserCog } from 'lucide-react';
import { format } from 'date-fns';
import { getRoleLabel } from '@/lib/utils';

interface UserWithEmail extends Profile {
  email?: string;
}

export default function UsersPage() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserWithEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithEmail | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [formData, setFormData] = useState({ email: '', full_name: '', role: 'lawyer', password: '', is_external: false, access_expires_at: '' });
  const [editFormData, setEditFormData] = useState({ role: 'lawyer', is_external: false, access_expires_at: '' });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { if (profile?.role === 'admin') fetchUsers(); }, [profile]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_users_with_emails');
      if (error) throw error;
      const profileMap = new Map();
      const { data: profiles } = await supabase.from('profiles').select('*');
      (profiles || []).forEach(p => profileMap.set(p.id, p));
      const merged = (data || []).map((u: any) => ({ ...profileMap.get(u.id), ...u }));
      setUsers(merged);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCreating(true);
    try {
      const response = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email, password: formData.password, full_name: formData.full_name, role: formData.role, is_external: formData.is_external, access_expires_at: formData.is_external && formData.access_expires_at ? formData.access_expires_at : null }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to create user');
      setDialogOpen(false);
      setFormData({ email: '', full_name: '', role: 'lawyer', password: '', is_external: false, access_expires_at: '' });
      fetchUsers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      const { error } = await supabase.from('profiles').update({ role: editFormData.role, is_external: editFormData.is_external, access_expires_at: editFormData.is_external && editFormData.access_expires_at ? editFormData.access_expires_at : null }).eq('id', editingUser.id);
      if (error) throw error;
      setEditDialogOpen(false);
      fetchUsers();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const openEditDialog = (user: UserWithEmail) => {
    setEditingUser(user);
    setEditFormData({ role: user.role || 'lawyer', is_external: user.is_external || false, access_expires_at: user.access_expires_at || '' });
    setEditDialogOpen(true);
  };

  const isAccessExpired = (expires: string | null | undefined): boolean => {
    if (!expires) return false;
    return new Date(expires) < new Date();
  };

  const filteredUsers = users.filter(u => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!(u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q))) return false;
    }
    return true;
  });

  const getRoleStyle = (role: string) => {
    const styles: Record<string, string> = {
      admin: 'bg-slate-900 text-white',
      lawyer: 'bg-blue-50 text-blue-700 border border-blue-200',
      viewer: 'bg-slate-50 text-slate-600 border border-slate-200',
    };
    return styles[role] || styles.viewer;
  };

  if (profile?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-500">You don&apos;t have permission to access this page.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div><div className="h-7 w-20 bg-slate-100 animate-pulse rounded mb-1.5" /><div className="h-4 w-48 bg-slate-100 animate-pulse rounded" /></div>
          <div className="h-9 w-28 bg-slate-100 animate-pulse rounded" />
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-5 space-y-3">
          <div className="h-10 bg-slate-100 animate-pulse rounded" />
          <div className="h-10 w-40 bg-slate-100 animate-pulse rounded" />
        </div>
        <div className="bg-white rounded-xl border border-slate-100">
          {[1,2,3,4,5].map(i => <div key={i} className="h-16 bg-slate-50 animate-pulse m-4 rounded-lg" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Users</h2>
          <p className="text-sm text-slate-500 mt-0.5">Manage user accounts, roles, and access</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="bg-slate-900 hover:bg-slate-800 text-sm">
          <Plus className="w-4 h-4 mr-2" />
          New User
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 p-5 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <Input placeholder="Search by name or email..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10 bg-slate-50 border-slate-200 focus:bg-white text-sm" />
        </div>
        <div className="w-48 space-y-1">
          <Label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Role</Label>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="h-9 text-sm border-slate-200 bg-slate-50"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="admin">Head Legal</SelectItem>
              <SelectItem value="lawyer">Counsel</SelectItem>
              <SelectItem value="viewer">External Counsel</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
          <h3 className="text-sm font-semibold text-slate-800">
            All Users
            <span className="ml-2 text-xs font-normal text-slate-400">({filteredUsers.length})</span>
          </h3>
        </div>
        {filteredUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Users className="w-10 h-10 mb-3 text-slate-300" />
            <p className="text-sm">No users found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400 bg-slate-50/50">
                  <th className="px-5 py-3 font-semibold">User</th>
                  <th className="px-5 py-3 font-semibold">Role</th>
                  <th className="px-5 py-3 font-semibold hidden md:table-cell">Access</th>
                  <th className="px-5 py-3 font-semibold hidden lg:table-cell">Created</th>
                  <th className="px-5 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredUsers.map(user => {
                  const expired = isAccessExpired(user.access_expires_at);
                  return (
                    <tr key={user.id} className={`hover:bg-slate-50/50 transition-colors ${expired ? 'bg-red-50/30' : ''}`}>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 ${expired ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'}`}>
                            {user.full_name?.charAt(0) || '?'}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-slate-800">{user.full_name}</p>
                              {user.is_external && (
                                <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full font-semibold">External</span>
                              )}
                              {expired && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] bg-red-50 text-red-700 border border-red-200 px-1.5 py-0.5 rounded-full font-semibold">
                                  <ShieldAlert className="w-2.5 h-2.5" />Expired
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 text-[11px] font-semibold rounded-full ${getRoleStyle(user.role || '')}`}>
                          {getRoleLabel(user.role || '')}
                        </span>
                      </td>
                      <td className="px-5 py-4 hidden md:table-cell">
                        {user.access_expires_at ? (
                          <div>
                            <p className={`text-xs font-medium ${expired ? 'text-red-600' : 'text-slate-600'}`}>
                              {expired ? 'Expired' : 'Expires'}
                            </p>
                            <p className={`text-xs ${expired ? 'text-red-500' : 'text-slate-400'}`}>
                              {format(new Date(user.access_expires_at), 'dd MMM yyyy')}
                            </p>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400">Permanent</p>
                        )}
                      </td>
                      <td className="px-5 py-4 hidden lg:table-cell">
                        <p className="text-xs text-slate-500">{format(new Date(user.created_at), 'dd MMM yyyy')}</p>
                      </td>
                      <td className="px-5 py-4">
                        <Button variant="ghost" size="sm" onClick={() => openEditDialog(user)} className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700">
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>Add a new user to the system</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateUser} className="space-y-4 mt-2">
            {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm border border-red-100">{error}</div>}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Full Name *</Label>
              <Input value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} required placeholder="Jane Smith" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Email Address *</Label>
              <Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required placeholder="jane@example.com" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Password *</Label>
              <Input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required placeholder="Minimum 6 characters" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Role *</Label>
              <Select value={formData.role} onValueChange={v => setFormData({...formData, role: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Head Legal</SelectItem>
                  <SelectItem value="lawyer">Counsel</SelectItem>
                  <SelectItem value="viewer">External Counsel</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
              <Switch id="is_external" checked={formData.is_external} onCheckedChange={checked => setFormData({...formData, is_external: checked, access_expires_at: checked ? formData.access_expires_at : ''})} />
              <div>
                <Label htmlFor="is_external" className="text-sm font-medium text-slate-700 cursor-pointer">External User</Label>
                <p className="text-xs text-slate-400">Grant temporary access to external counsel</p>
              </div>
            </div>
            {formData.is_external && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">Access Expires At</Label>
                <Input type="datetime-local" value={formData.access_expires_at} onChange={e => setFormData({...formData, access_expires_at: e.target.value})} className="text-sm" />
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); setError(''); }}>Cancel</Button>
              <Button type="submit" disabled={creating} className="bg-slate-900 hover:bg-slate-800">{creating ? 'Creating...' : 'Create User'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="w-4 h-4" />
              Edit User — {editingUser?.full_name}
            </DialogTitle>
            <DialogDescription>Update role and access settings</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditUser} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Role</Label>
              <Select value={editFormData.role} onValueChange={v => setEditFormData({...editFormData, role: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Head Legal</SelectItem>
                  <SelectItem value="lawyer">Counsel</SelectItem>
                  <SelectItem value="viewer">External Counsel</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
              <Switch id="edit_external" checked={editFormData.is_external} onCheckedChange={checked => setEditFormData({...editFormData, is_external: checked, access_expires_at: checked ? editFormData.access_expires_at : ''})} />
              <div>
                <Label htmlFor="edit_external" className="text-sm font-medium text-slate-700 cursor-pointer">External User</Label>
                <p className="text-xs text-slate-400">Temporary access for external counsel</p>
              </div>
            </div>
            {editFormData.is_external && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">Access Expires At</Label>
                <Input type="datetime-local" value={editFormData.access_expires_at} onChange={e => setEditFormData({...editFormData, access_expires_at: e.target.value})} className="text-sm" />
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-slate-900 hover:bg-slate-800">Save Changes</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
