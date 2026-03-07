'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useRouter, useParams } from 'next/navigation';
import { supabase, Case, Profile, CaseDocument } from '@/lib/supabase';
import { queryCache } from '@/lib/query-cache';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ArrowLeft, User, Calendar, FileText, MessageSquare, UserPlus, Upload, Download, Trash2, Search, Tag } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { getRoleLabel } from '@/lib/utils';

export default function CaseDetailPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const params = useParams();
  const caseId = params.id as string;

  const [caseData, setCaseData] = useState<Case | null>(null);
  const [assignedUsers, setAssignedUsers] = useState<Profile[]>([]);
  const [allUsers, setAllUsers] = useState<Profile[]>([]);
  const [documents, setDocuments] = useState<CaseDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteDocDialogOpen, setDeleteDocDialogOpen] = useState(false);
  const [docToDelete, setDocToDelete] = useState<string | null>(null);
  const [documentSearch, setDocumentSearch] = useState('');
  const [filteredDocuments, setFilteredDocuments] = useState<CaseDocument[]>([]);

  useEffect(() => { fetchCaseData(); }, [caseId, profile]);

  useEffect(() => {
    let filtered = documents;
    if (documentSearch) {
      const q = documentSearch.toLowerCase();
      filtered = filtered.filter(doc =>
        doc.file_name.toLowerCase().includes(q) ||
        (doc.indexed_content && doc.indexed_content.toLowerCase().includes(q)) ||
        (doc.tags && doc.tags.some(tag => tag.toLowerCase().includes(q)))
      );
    }
    setFilteredDocuments(filtered);
  }, [documents, documentSearch]);

  const fetchCaseData = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const queries: any[] = [
        supabase.from('cases').select('*').eq('id', caseId).maybeSingle(),
        supabase.from('case_assignments').select('user_id').eq('case_id', caseId),
        supabase.from('case_documents').select('*').eq('case_id', caseId).order('created_at', { ascending: false }),
      ];
      if (profile.role === 'admin') queries.push(supabase.from('profiles').select('*').order('full_name'));

      const results = await Promise.all(queries);
      const { data: caseInfo, error: caseError } = results[0];
      const { data: assignments } = results[1];
      const { data: docs } = results[2];
      const allUsersData = profile.role === 'admin' ? results[3] : null;

      if (caseError) throw caseError;
      if (!caseInfo) { router.push('/dashboard/cases'); return; }

      setCaseData(caseInfo);
      setDocuments(docs || []);
      if (profile.role === 'admin' && allUsersData) setAllUsers(allUsersData.data || []);

      if (assignments && assignments.length > 0) {
        const userIds = assignments.map((a: any) => a.user_id);
        const { data: users } = await supabase.from('profiles').select('*').in('id', userIds);
        setAssignedUsers(users || []);
      }
    } catch (err) {
      console.error('Error fetching case:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (newStatus: string) => {
    if (!caseData) return;
    setUpdating(true);
    try {
      const { error } = await supabase.from('cases').update({ status: newStatus }).eq('id', caseId);
      if (error) throw error;
      setCaseData({ ...caseData, status: newStatus as any });
      queryCache.invalidatePattern('cases');
      queryCache.invalidatePattern('dashboard');
    } catch (err) { console.error(err); } finally { setUpdating(false); }
  };

  const handleAddNote = async () => {
    if (!caseData || !newNote.trim() || !profile) return;
    setAddingNote(true);
    try {
      const notes = caseData.notes || [];
      const updatedNotes = [...notes, { id: crypto.randomUUID(), text: newNote, created_by: profile.full_name, created_at: new Date().toISOString() }];
      const { error } = await supabase.from('cases').update({ notes: updatedNotes }).eq('id', caseId);
      if (error) throw error;
      setCaseData({ ...caseData, notes: updatedNotes });
      setNewNote('');
      queryCache.invalidatePattern('cases');
    } catch (err) { console.error(err); } finally { setAddingNote(false); }
  };

  const handleAssignUser = async () => {
    if (!selectedUserId || !profile) return;
    setAssigning(true);
    try {
      const { error } = await supabase.from('case_assignments').insert({ case_id: caseId, user_id: selectedUserId });
      if (error) throw error;
      queryCache.invalidatePattern('cases');
      await fetchCaseData();
      setAssignDialogOpen(false);
      setSelectedUserId('');
    } catch (err) { console.error(err); } finally { setAssigning(false); }
  };

  const handleRemoveUser = async (userId: string) => {
    if (!profile || profile.role !== 'admin') return;
    try {
      const { error } = await supabase.from('case_assignments').delete().eq('case_id', caseId).eq('user_id', userId);
      if (error) throw error;
      setAssignedUsers(assignedUsers.filter(u => u.id !== userId));
      queryCache.invalidatePattern('cases');
    } catch (err) { console.error(err); }
  };

  const handleFileUpload = async () => {
    if (!uploadedFile || !profile) return;
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        const { error } = await supabase.from('case_documents').insert({
          case_id: caseId, file_name: uploadedFile.name, file_url: base64,
          file_size: uploadedFile.size, file_type: uploadedFile.type, uploaded_by: profile.id,
        });
        if (error) throw error;
        await fetchCaseData();
        setUploadDialogOpen(false);
        setUploadedFile(null);
      };
      reader.readAsDataURL(uploadedFile);
    } catch (err) { console.error(err); } finally { setUploading(false); }
  };

  const handleDownloadFile = (doc: CaseDocument) => {
    const link = document.createElement('a');
    link.href = doc.file_url;
    link.download = doc.file_name;
    link.click();
  };

  const handleDeleteDocument = async () => {
    if (!profile || profile.role !== 'admin' || !docToDelete) return;
    try {
      const { error } = await supabase.from('case_documents').delete().eq('id', docToDelete);
      if (error) throw error;
      setDocuments(documents.filter(d => d.id !== docToDelete));
      setDeleteDocDialogOpen(false);
      setDocToDelete(null);
    } catch (err) { console.error(err); }
  };

  const handleDeleteCase = async () => {
    if (!profile || profile.role !== 'admin') return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('cases').delete().eq('id', caseId);
      if (error) throw error;
      queryCache.invalidatePattern('cases');
      queryCache.invalidatePattern('dashboard');
      router.push('/dashboard/cases');
    } catch (err) { console.error(err); } finally { setDeleting(false); }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getStatusStyle = (status: string) => {
    const styles: Record<string, string> = {
      open: 'bg-amber-50 text-amber-700 border-amber-200',
      in_progress: 'bg-blue-50 text-blue-700 border-blue-200',
      closed: 'bg-slate-50 text-slate-600 border-slate-200',
    };
    return styles[status] || styles.open;
  };

  const formatStatus = (status: string) =>
    status === 'in_progress' ? 'In Progress' : status.charAt(0).toUpperCase() + status.slice(1);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-48 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-40 rounded-xl" />
            <Skeleton className="h-40 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-slate-500">Case not found</p>
      </div>
    );
  }

  const canUpdateStatus = profile?.role === 'admin' || profile?.role === 'lawyer';
  const canAddNotes = profile?.role === 'admin' || profile?.role === 'lawyer';
  const isAdmin = profile?.role === 'admin';
  const unassignedUsers = allUsers.filter(u => !assignedUsers.some(a => a.id === u.id));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/cases">
          <button className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors mb-5">
            <ArrowLeft className="w-4 h-4" />
            Back to Cases
          </button>
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="font-mono text-sm font-medium text-slate-400">{caseData.case_number}</span>
              <span className={`inline-flex items-center px-2.5 py-1 text-[11px] font-semibold rounded-full border ${getStatusStyle(caseData.status)}`}>
                {formatStatus(caseData.status)}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">{caseData.title}</h1>
            <p className="text-sm text-slate-500 mt-1">{caseData.case_type} Case</p>
          </div>
          {isAdmin && (
            <Button variant="outline" onClick={() => setDeleteDialogOpen(true)} className="text-red-600 border-red-200 hover:bg-red-50 text-sm">
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-50">
              <h3 className="text-sm font-semibold text-slate-800">Case Information</h3>
            </div>
            <div className="p-5 space-y-5">
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Client</p>
                  <p className="text-sm text-slate-800 font-medium">{caseData.client_name}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Case Type</p>
                  <p className="text-sm text-slate-800">{caseData.case_type}</p>
                </div>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Description</p>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{caseData.description}</p>
              </div>
              <div className="grid grid-cols-2 gap-5 pt-4 border-t border-slate-50">
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Created
                  </p>
                  <p className="text-sm text-slate-600">{format(new Date(caseData.created_at), 'dd MMM yyyy')}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Last Updated
                  </p>
                  <p className="text-sm text-slate-600">{format(new Date(caseData.updated_at), 'dd MMM yyyy')}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-50">
              <MessageSquare className="w-4 h-4 text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-800">Case Notes</h3>
            </div>
            <div className="p-5 space-y-4">
              {canAddNotes && (
                <div className="space-y-2">
                  <Textarea
                    placeholder="Add a note..."
                    value={newNote}
                    onChange={e => setNewNote(e.target.value)}
                    rows={3}
                    disabled={addingNote}
                    className="text-sm resize-none bg-slate-50 border-slate-200 focus:bg-white"
                  />
                  <Button
                    onClick={handleAddNote}
                    disabled={!newNote.trim() || addingNote}
                    size="sm"
                    className="bg-slate-900 hover:bg-slate-800 text-xs"
                  >
                    {addingNote ? 'Adding...' : 'Add Note'}
                  </Button>
                </div>
              )}
              <div className="space-y-3">
                {(!caseData.notes || caseData.notes.length === 0) ? (
                  <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                    <MessageSquare className="w-8 h-8 mb-2 text-slate-300" />
                    <p className="text-sm">No notes yet</p>
                  </div>
                ) : (
                  caseData.notes.map(note => (
                    <div key={note.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{note.text}</p>
                      <div className="flex items-center gap-1.5 mt-2 text-[11px] text-slate-400">
                        <User className="w-3 h-3" />
                        <span>{note.created_by}</span>
                        <span>·</span>
                        <span>{format(new Date(note.created_at), 'dd MMM yyyy, h:mm a')}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-50">
              <h3 className="text-sm font-semibold text-slate-800">Status</h3>
            </div>
            <div className="p-5">
              {canUpdateStatus ? (
                <Select value={caseData.status} onValueChange={handleStatusUpdate} disabled={updating}>
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <span className={`inline-flex items-center px-2.5 py-1.5 text-sm font-medium rounded-lg border ${getStatusStyle(caseData.status)}`}>
                  {formatStatus(caseData.status)}
                </span>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-slate-400" />
                <h3 className="text-sm font-semibold text-slate-800">Assigned To</h3>
              </div>
              {isAdmin && (
                <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-slate-500 hover:text-blue-600">
                      <UserPlus className="w-3.5 h-3.5 mr-1" /> Assign
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Assign User to Case</DialogTitle>
                      <DialogDescription>Select a user to assign to this case</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                        <SelectTrigger><SelectValue placeholder="Select a user" /></SelectTrigger>
                        <SelectContent>
                          {unassignedUsers.map(u => (
                            <SelectItem key={u.id} value={u.id}>{u.full_name} ({getRoleLabel(u.role)})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setAssignDialogOpen(false)} disabled={assigning}>Cancel</Button>
                        <Button onClick={handleAssignUser} disabled={!selectedUserId || assigning} className="bg-slate-900 hover:bg-slate-800">
                          {assigning ? 'Assigning...' : 'Assign User'}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
            <div className="p-5">
              {assignedUsers.length === 0 ? (
                <p className="text-sm text-slate-400">No assignments</p>
              ) : (
                <div className="space-y-2">
                  {assignedUsers.map(user => (
                    <div key={user.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-sm font-semibold text-slate-700">
                          {user.full_name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-800">{user.full_name}</p>
                          <p className="text-[11px] text-slate-400">{getRoleLabel(user.role)}</p>
                        </div>
                      </div>
                      {isAdmin && (
                        <Button size="sm" variant="ghost" onClick={() => handleRemoveUser(user.id)} className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-400" />
                <h3 className="text-sm font-semibold text-slate-800">Documents</h3>
              </div>
              {isAdmin && (
                <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-slate-500 hover:text-blue-600">
                      <Upload className="w-3.5 h-3.5 mr-1" /> Upload
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Upload Document</DialogTitle>
                      <DialogDescription>Upload a file to attach to this case</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label className="text-xs text-slate-600">Select File</Label>
                        <input type="file" onChange={e => setUploadedFile(e.target.files?.[0] || null)} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-slate-900 file:text-white hover:file:bg-slate-800" />
                        {uploadedFile && <p className="text-xs text-slate-500">Selected: {uploadedFile.name} ({formatFileSize(uploadedFile.size)})</p>}
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => { setUploadDialogOpen(false); setUploadedFile(null); }} disabled={uploading}>Cancel</Button>
                        <Button onClick={handleFileUpload} disabled={!uploadedFile || uploading} className="bg-slate-900 hover:bg-slate-800">
                          {uploading ? 'Uploading...' : 'Upload File'}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
            <div className="p-5 space-y-3">
              {documents.length > 0 && (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
                  <Input placeholder="Search documents..." value={documentSearch} onChange={e => setDocumentSearch(e.target.value)} className="pl-9 h-8 text-xs bg-slate-50 border-slate-200" />
                </div>
              )}
              {documents.length === 0 ? (
                <p className="text-sm text-slate-400 py-2">No documents</p>
              ) : filteredDocuments.length === 0 ? (
                <p className="text-sm text-slate-400 py-2">No documents match your search</p>
              ) : (
                <div className="space-y-2">
                  {filteredDocuments.map(doc => (
                    <div key={doc.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100 group">
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <div className="w-8 h-8 bg-white rounded-lg border border-slate-200 flex items-center justify-center flex-shrink-0">
                          <FileText className="w-4 h-4 text-slate-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-slate-800 truncate">{doc.file_name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-slate-400">{formatFileSize(doc.file_size)}</span>
                            {doc.current_version && doc.current_version > 1 && (
                              <Badge variant="outline" className="text-[10px] h-4 px-1">v{doc.current_version}</Badge>
                            )}
                          </div>
                          {doc.tags && doc.tags.length > 0 && (
                            <div className="flex gap-1 mt-1 flex-wrap">
                              {doc.tags.map((tag, idx) => (
                                <span key={idx} className="inline-flex items-center gap-0.5 text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">
                                  <Tag className="w-2 h-2" />{tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button size="sm" variant="ghost" onClick={() => handleDownloadFile(doc)} className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700">
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                        {isAdmin && (
                          <Button size="sm" variant="ghost" onClick={() => { setDocToDelete(doc.id); setDeleteDocDialogOpen(true); }} className="h-7 w-7 p-0 text-red-300 hover:text-red-600 hover:bg-red-50">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Case</DialogTitle>
            <DialogDescription>Are you sure you want to delete this case? This action cannot be undone. All associated documents and assignments will also be deleted.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteCase} disabled={deleting}>{deleting ? 'Deleting...' : 'Delete Case'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDocDialogOpen} onOpenChange={setDeleteDocDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Document</DialogTitle>
            <DialogDescription>Are you sure you want to delete this document? This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => { setDeleteDocDialogOpen(false); setDocToDelete(null); }}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteDocument}>Delete Document</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
