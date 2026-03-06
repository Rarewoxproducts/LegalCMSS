'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { supabase, CaseDocument } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FileText, Search, Upload, Download, Trash2, Tag, FolderOpen, Calendar, X } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';

interface DocumentWithCase extends CaseDocument {
  case_title?: string;
  case_number?: string;
}

interface Case { id: string; title: string; case_number: string; }

export default function DocumentsPage() {
  const { profile } = useAuth();
  const [documents, setDocuments] = useState<DocumentWithCase[]>([]);
  const [filteredDocuments, setFilteredDocuments] = useState<DocumentWithCase[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [caseFilter, setCaseFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCaseId, setUploadCaseId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [docToDelete, setDocToDelete] = useState<string | null>(null);

  useEffect(() => {
    fetchDocuments();
    fetchCases();
  }, [profile]);

  useEffect(() => {
    let filtered = documents;

    if (caseFilter !== 'all') filtered = filtered.filter(d => d.case_id === caseFilter);
    if (typeFilter !== 'all') {
      filtered = filtered.filter(d => {
        const ext = d.file_name.split('.').pop()?.toLowerCase() || '';
        const typeMap: Record<string, string[]> = {
          pdf: ['pdf'],
          image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'],
          document: ['doc', 'docx', 'txt', 'rtf', 'odt'],
          spreadsheet: ['xls', 'xlsx', 'csv', 'ods'],
          other: [],
        };
        if (typeFilter === 'other') {
          const known = Object.values(typeMap).flat();
          return !known.includes(ext);
        }
        return typeMap[typeFilter]?.includes(ext);
      });
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(d =>
        d.file_name.toLowerCase().includes(q) ||
        d.case_title?.toLowerCase().includes(q) ||
        d.case_number?.toLowerCase().includes(q) ||
        (d.tags && d.tags.some(tag => tag.toLowerCase().includes(q)))
      );
    }
    if (dateFrom) filtered = filtered.filter(d => new Date(d.created_at) >= new Date(dateFrom));
    if (dateTo) filtered = filtered.filter(d => new Date(d.created_at) <= new Date(dateTo));

    setFilteredDocuments(filtered);
  }, [documents, searchQuery, caseFilter, typeFilter, dateFrom, dateTo]);

  const fetchDocuments = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      let caseIds: string[] | null = null;

      if (profile.role !== 'admin') {
        const { data: assignments } = await supabase
          .from('case_assignments').select('case_id').eq('user_id', profile.id);
        caseIds = assignments?.map(a => a.case_id) || [];
        if (caseIds.length === 0) {
          setDocuments([]);
          setLoading(false);
          return;
        }
      }

      let query = supabase
        .from('case_documents')
        .select('*, cases:case_id(title, case_number)')
        .order('created_at', { ascending: false });

      if (caseIds) query = query.in('case_id', caseIds);

      const { data, error } = await query;
      if (error) throw error;

      const docs = (data || []).map((d: any) => ({
        ...d,
        case_title: d.cases?.title,
        case_number: d.cases?.case_number,
      }));
      setDocuments(docs);
    } catch (err) {
      console.error('Error fetching documents:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCases = async () => {
    if (!profile) return;
    try {
      let query = supabase.from('cases').select('id, title, case_number').order('title');
      if (profile.role !== 'admin') {
        const { data: assignments } = await supabase
          .from('case_assignments').select('case_id').eq('user_id', profile.id);
        const ids = assignments?.map(a => a.case_id) || [];
        if (ids.length === 0) return;
        query = query.in('id', ids);
      }
      const { data } = await query;
      setCases(data || []);
    } catch (err) {
      console.error('Error fetching cases:', err);
    }
  };

  const handleUpload = async () => {
    if (!uploadFile || !uploadCaseId || !profile) return;
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        const { error } = await supabase.from('case_documents').insert({
          case_id: uploadCaseId,
          file_name: uploadFile.name,
          file_url: base64,
          file_size: uploadFile.size,
          file_type: uploadFile.type,
          uploaded_by: profile.id,
        });
        if (error) throw error;
        setUploadDialogOpen(false);
        setUploadFile(null);
        setUploadCaseId('');
        fetchDocuments();
        setUploading(false);
      };
      reader.readAsDataURL(uploadFile);
    } catch (err) {
      console.error(err);
      setUploading(false);
    }
  };

  const handleDownload = (doc: DocumentWithCase) => {
    const link = document.createElement('a');
    link.href = doc.file_url;
    link.download = doc.file_name;
    link.click();
  };

  const handleDelete = async () => {
    if (!docToDelete) return;
    try {
      const { error } = await supabase.from('case_documents').delete().eq('id', docToDelete);
      if (error) throw error;
      setDocuments(prev => prev.filter(d => d.id !== docToDelete));
      setDeleteDialogOpen(false);
      setDocToDelete(null);
    } catch (err) {
      console.error(err);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    const colorMap: Record<string, string> = {
      pdf: 'text-red-500',
      doc: 'text-blue-600', docx: 'text-blue-600',
      xls: 'text-green-600', xlsx: 'text-green-600', csv: 'text-green-600',
      jpg: 'text-amber-500', jpeg: 'text-amber-500', png: 'text-amber-500',
      gif: 'text-amber-500', webp: 'text-amber-500',
      txt: 'text-slate-500', rtf: 'text-slate-500',
    };
    return colorMap[ext] || 'text-slate-400';
  };

  const getFileBg = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    const bgMap: Record<string, string> = {
      pdf: 'bg-red-50',
      doc: 'bg-blue-50', docx: 'bg-blue-50',
      xls: 'bg-green-50', xlsx: 'bg-green-50', csv: 'bg-green-50',
      jpg: 'bg-amber-50', jpeg: 'bg-amber-50', png: 'bg-amber-50',
    };
    return bgMap[ext] || 'bg-slate-50';
  };

  const clearFilters = () => {
    setSearchQuery('');
    setCaseFilter('all');
    setTypeFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  const hasFilters = searchQuery || caseFilter !== 'all' || typeFilter !== 'all' || dateFrom || dateTo;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div><Skeleton className="h-7 w-32 mb-1.5" /><Skeleton className="h-4 w-56" /></div>
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-5 space-y-3">
          <Skeleton className="h-10 w-full" />
          <div className="grid grid-cols-4 gap-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-10" />)}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-100">
          {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-16 m-4 rounded-lg" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Documents</h2>
          <p className="text-sm text-slate-500 mt-0.5">Browse and manage all case documents</p>
        </div>
        {(profile?.role === 'admin' || profile?.role === 'lawyer') && (
          <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-slate-900 hover:bg-slate-800 text-sm">
                <Upload className="w-4 h-4 mr-2" />
                Upload Document
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload Document</DialogTitle>
                <DialogDescription>Attach a file to a case</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600">Select Case *</Label>
                  <Select value={uploadCaseId} onValueChange={setUploadCaseId}>
                    <SelectTrigger><SelectValue placeholder="Choose a case..." /></SelectTrigger>
                    <SelectContent>
                      {cases.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          <span className="font-mono text-xs text-slate-400 mr-2">{c.case_number}</span>
                          {c.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600">File *</Label>
                  <input
                    type="file"
                    onChange={e => setUploadFile(e.target.files?.[0] || null)}
                    className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-slate-900 file:text-white hover:file:bg-slate-800 cursor-pointer"
                  />
                  {uploadFile && (
                    <p className="text-xs text-slate-500 mt-1">
                      {uploadFile.name} — {formatFileSize(uploadFile.size)}
                    </p>
                  )}
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => { setUploadDialogOpen(false); setUploadFile(null); setUploadCaseId(''); }}>Cancel</Button>
                  <Button onClick={handleUpload} disabled={!uploadFile || !uploadCaseId || uploading} className="bg-slate-900 hover:bg-slate-800">
                    {uploading ? 'Uploading...' : 'Upload'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-100 p-5 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <Input
            placeholder="Search by file name, case, or tag..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10 bg-slate-50 border-slate-200 focus:bg-white text-sm"
          />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Case</Label>
            <Select value={caseFilter} onValueChange={setCaseFilter}>
              <SelectTrigger className="h-9 text-sm border-slate-200 bg-slate-50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cases</SelectItem>
                {cases.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">File Type</Label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-9 text-sm border-slate-200 bg-slate-50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="pdf">PDF</SelectItem>
                <SelectItem value="document">Document</SelectItem>
                <SelectItem value="spreadsheet">Spreadsheet</SelectItem>
                <SelectItem value="image">Image</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">From Date</Label>
            <div className="relative">
              <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="pl-8 h-9 text-sm border-slate-200 bg-slate-50" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">To Date</Label>
            <div className="relative">
              <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="pl-8 h-9 text-sm border-slate-200 bg-slate-50" />
            </div>
          </div>
        </div>
        {hasFilters && (
          <button onClick={clearFilters} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors">
            <X className="w-3.5 h-3.5" />
            Clear filters
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
          <h3 className="text-sm font-semibold text-slate-800">
            All Documents
            <span className="ml-2 text-xs font-normal text-slate-400">({filteredDocuments.length})</span>
          </h3>
        </div>

        {filteredDocuments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <FolderOpen className="w-10 h-10 mb-3 text-slate-300" />
            <p className="text-sm">No documents found</p>
            {hasFilters && (
              <button onClick={clearFilters} className="mt-2 text-xs text-blue-500 hover:text-blue-600">
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400 bg-slate-50/50">
                  <th className="px-5 py-3 font-semibold">File</th>
                  <th className="px-5 py-3 font-semibold hidden sm:table-cell">Case</th>
                  <th className="px-5 py-3 font-semibold hidden md:table-cell">Size</th>
                  <th className="px-5 py-3 font-semibold hidden lg:table-cell">Uploaded</th>
                  <th className="px-5 py-3 font-semibold hidden lg:table-cell">Tags</th>
                  <th className="px-5 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredDocuments.map(doc => (
                  <tr key={doc.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${getFileBg(doc.file_name)}`}>
                          <FileText className={`w-4 h-4 ${getFileIcon(doc.file_name)}`} />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-800 max-w-[200px] truncate">{doc.file_name}</p>
                          <p className="text-[11px] text-slate-400 uppercase">{doc.file_name.split('.').pop()}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 hidden sm:table-cell">
                      {doc.case_title ? (
                        <Link href={`/dashboard/cases/${doc.case_id}`} className="group/link">
                          <p className="text-sm text-slate-700 group-hover/link:text-blue-600 transition-colors">{doc.case_title}</p>
                          <p className="text-[11px] text-slate-400 font-mono">{doc.case_number}</p>
                        </Link>
                      ) : (
                        <p className="text-sm text-slate-400">—</p>
                      )}
                    </td>
                    <td className="px-5 py-4 hidden md:table-cell">
                      <p className="text-sm text-slate-500">{formatFileSize(doc.file_size)}</p>
                    </td>
                    <td className="px-5 py-4 hidden lg:table-cell">
                      <p className="text-sm text-slate-500">{format(new Date(doc.created_at), 'dd MMM yyyy')}</p>
                    </td>
                    <td className="px-5 py-4 hidden lg:table-cell">
                      {doc.tags && doc.tags.length > 0 ? (
                        <div className="flex gap-1 flex-wrap">
                          {doc.tags.map((tag, idx) => (
                            <span key={idx} className="inline-flex items-center gap-0.5 text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium">
                              <Tag className="w-2.5 h-2.5" />{tag}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-300">—</p>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownload(doc)}
                          className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700"
                          title="Download"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                        {profile?.role === 'admin' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setDocToDelete(doc.id); setDeleteDialogOpen(true); }}
                            className="h-7 w-7 p-0 text-red-300 hover:text-red-600 hover:bg-red-50"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Document</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this document? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => { setDeleteDialogOpen(false); setDocToDelete(null); }}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
