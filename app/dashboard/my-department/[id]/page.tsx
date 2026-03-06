'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft,
  Building2,
  Send,
  Users,
  Trash2,
  Crown,
  Shield,
} from 'lucide-react';
import Link from 'next/link';
import { format, isToday, isYesterday } from 'date-fns';

interface Message {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
  sender_name?: string;
}

interface Member {
  user_id: string;
  role: string;
  full_name: string;
}

interface Department {
  id: string;
  name: string;
  description: string;
}

const roleIconMap: Record<string, React.ReactNode> = {
  manager: <Crown className="w-3 h-3 text-amber-500" />,
  lead: <Shield className="w-3 h-3 text-blue-400" />,
};

function formatMessageDate(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, 'HH:mm');
  if (isYesterday(d)) return `Yesterday ${format(d, 'HH:mm')}`;
  return format(d, 'dd MMM, HH:mm');
}

function groupMessagesByDate(messages: Message[]) {
  const groups: { label: string; messages: Message[] }[] = [];
  let currentLabel = '';
  for (const msg of messages) {
    const d = new Date(msg.created_at);
    const label = isToday(d) ? 'Today' : isYesterday(d) ? 'Yesterday' : format(d, 'MMMM d, yyyy');
    if (label !== currentLabel) {
      groups.push({ label, messages: [] });
      currentLabel = label;
    }
    groups[groups.length - 1].messages.push(msg);
  }
  return groups;
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

const avatarColors = [
  'from-blue-500 to-blue-700',
  'from-teal-500 to-teal-700',
  'from-amber-500 to-amber-700',
  'from-rose-500 to-rose-700',
  'from-emerald-500 to-emerald-700',
  'from-slate-600 to-slate-800',
];

function getAvatarColor(userId: string) {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

export default function DepartmentChatPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const [department, setDepartment] = useState<Department | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const subscriptionRef = useRef<any>(null);

  useEffect(() => {
    if (!profile || !id) return;
    initialize();
    return () => {
      subscriptionRef.current?.unsubscribe();
    };
  }, [profile, id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const initialize = async () => {
    setLoading(true);
    try {
      const isMember = await checkMembership();
      if (!isMember) { setAccessDenied(true); setLoading(false); return; }
      await Promise.all([fetchDepartment(), fetchMembers(), fetchMessages()]);
      subscribeToMessages();
    } finally {
      setLoading(false);
    }
  };

  const checkMembership = async () => {
    if (!profile) return false;
    if (profile.role === 'admin') return true;
    const { data } = await supabase
      .from('department_members')
      .select('id')
      .eq('department_id', id)
      .eq('user_id', profile.id)
      .maybeSingle();
    return !!data;
  };

  const fetchDepartment = async () => {
    const { data } = await supabase.from('departments').select('id, name, description').eq('id', id).maybeSingle();
    if (data) setDepartment(data);
  };

  const fetchMembers = async () => {
    const { data } = await supabase
      .from('department_members')
      .select('user_id, role, profiles:user_id(full_name)')
      .eq('department_id', id);
    const result: Member[] = (data || []).map((m: any) => ({
      user_id: m.user_id,
      role: m.role,
      full_name: m.profiles?.full_name || 'Unknown',
    }));
    setMembers(result);
  };

  const fetchMessages = async () => {
    const { data } = await supabase
      .from('department_messages')
      .select('id, content, user_id, created_at, profiles:user_id(full_name)')
      .eq('department_id', id)
      .order('created_at', { ascending: true })
      .limit(200);
    const msgs: Message[] = (data || []).map((m: any) => ({
      id: m.id,
      content: m.content,
      user_id: m.user_id,
      created_at: m.created_at,
      sender_name: m.profiles?.full_name || 'Unknown',
    }));
    setMessages(msgs);
  };

  const subscribeToMessages = useCallback(() => {
    subscriptionRef.current = supabase
      .channel(`dept-chat-${id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'department_messages',
        filter: `department_id=eq.${id}`,
      }, async (payload) => {
        const newMsg = payload.new as any;
        setMessages(prev => {
          if (prev.some(m => m.id === newMsg.id)) return prev;
          const tempIndex = prev.findIndex(
            m => m.id.startsWith('temp-') && m.user_id === newMsg.user_id && m.content === newMsg.content
          );
          if (tempIndex !== -1) {
            const updated = [...prev];
            updated[tempIndex] = {
              ...updated[tempIndex],
              id: newMsg.id,
              created_at: newMsg.created_at,
            };
            return updated;
          }
          (async () => {
            const { data: profileData } = await supabase
              .from('profiles').select('full_name').eq('id', newMsg.user_id).maybeSingle();
            setMessages(current => {
              if (current.some(m => m.id === newMsg.id)) return current;
              return [...current, {
                id: newMsg.id,
                content: newMsg.content,
                user_id: newMsg.user_id,
                created_at: newMsg.created_at,
                sender_name: profileData?.full_name || 'Unknown',
              }];
            });
          })();
          return prev;
        });
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'department_messages',
        filter: `department_id=eq.${id}`,
      }, (payload) => {
        setMessages(prev => prev.filter(m => m.id !== (payload.old as any).id));
      })
      .subscribe();
  }, [id]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !profile || sending) return;
    const content = newMessage.trim();
    setNewMessage('');
    setSending(true);

    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: Message = {
      id: tempId,
      content,
      user_id: profile.id,
      created_at: new Date().toISOString(),
      sender_name: profile.full_name || 'You',
    };
    setMessages(prev => [...prev, optimisticMsg]);

    try {
      const { data, error } = await supabase.from('department_messages').insert({
        department_id: id,
        user_id: profile.id,
        content,
      }).select('id, content, user_id, created_at').single();

      if (error) throw error;

      setMessages(prev =>
        prev.map(m => m.id === tempId
          ? { ...optimisticMsg, id: data.id, created_at: data.created_at }
          : m
        )
      );
    } catch (err) {
      console.error(err);
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setNewMessage(content);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const deleteMessage = async (msgId: string) => {
    await supabase.from('department_messages').delete().eq('id', msgId);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-[calc(100vh-8rem)] bg-white rounded-xl border border-slate-100 overflow-hidden">
        <div className="h-16 border-b border-slate-100 flex items-center px-5 gap-3">
          <Skeleton className="w-10 h-10 rounded-xl" />
          <div><Skeleton className="h-4 w-40 mb-1" /><Skeleton className="h-3 w-24" /></div>
        </div>
        <div className="flex-1 p-5 space-y-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className={`flex gap-3 ${i % 2 === 0 ? 'flex-row-reverse' : ''}`}>
              <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
              <Skeleton className={`h-12 rounded-xl ${i % 2 === 0 ? 'w-48' : 'w-64'}`} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)] text-center">
        <Building2 className="w-12 h-12 text-slate-300 mb-4" />
        <p className="text-lg font-semibold text-slate-700">Access Denied</p>
        <p className="text-sm text-slate-400 mt-1">You are not a member of this department.</p>
        <Link href="/dashboard/my-department" className="mt-4 text-sm text-blue-500 hover:text-blue-600">
          Back to My Departments
        </Link>
      </div>
    );
  }

  const messageGroups = groupMessagesByDate(messages);

  return (
    <div className="flex gap-0 h-[calc(100vh-8rem)] bg-white rounded-xl border border-slate-100 overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-16 border-b border-slate-100 flex items-center px-4 gap-3 flex-shrink-0 bg-white/80 backdrop-blur-sm">
          <Link
            href="/dashboard/my-department"
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 truncate">{department?.name}</p>
            <p className="text-[11px] text-slate-400">{members.length} {members.length === 1 ? 'member' : 'members'}</p>
          </div>
          <button
            onClick={() => setSidebarOpen(s => !s)}
            className="ml-auto p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            title="Toggle members list"
          >
            <Users className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6 scroll-smooth">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <MessageEmptyIcon />
              <p className="text-sm mt-3">No messages yet</p>
              <p className="text-xs mt-1">Be the first to say something!</p>
            </div>
          )}
          {messageGroups.map(group => (
            <div key={group.label}>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-slate-100" />
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{group.label}</span>
                <div className="flex-1 h-px bg-slate-100" />
              </div>
              <div className="space-y-1">
                {group.messages.map((msg, idx) => {
                  const isMine = msg.user_id === profile?.id;
                  const prevMsg = group.messages[idx - 1];
                  const showAvatar = !prevMsg || prevMsg.user_id !== msg.user_id;
                  return (
                    <div key={msg.id} className={`flex gap-2.5 ${isMine ? 'flex-row-reverse' : ''} items-end group/msg`}>
                      <div className="w-7 flex-shrink-0">
                        {showAvatar && (
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold bg-gradient-to-br ${getAvatarColor(msg.user_id)}`}>
                            {getInitials(msg.sender_name || '?')}
                          </div>
                        )}
                      </div>
                      <div className={`max-w-[70%] ${isMine ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                        {showAvatar && !isMine && (
                          <p className="text-[11px] font-semibold text-slate-500 ml-1">{msg.sender_name}</p>
                        )}
                        <div className={`relative rounded-2xl px-4 py-2.5 text-sm leading-relaxed break-words ${
                          isMine
                            ? 'bg-slate-900 text-white rounded-br-sm'
                            : 'bg-slate-100 text-slate-800 rounded-bl-sm'
                        }`}>
                          {msg.content}
                          <span className={`block text-[10px] mt-0.5 ${isMine ? 'text-slate-400' : 'text-slate-400'}`}>
                            {formatMessageDate(msg.created_at)}
                          </span>
                        </div>
                      </div>
                      {(isMine || profile?.role === 'admin') && (
                        <button
                          onClick={() => deleteMessage(msg.id)}
                          className="opacity-0 group-hover/msg:opacity-100 p-1 text-red-300 hover:text-red-500 transition-all"
                          title="Delete message"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="flex-shrink-0 px-4 py-3 border-t border-slate-100 bg-white">
          <div className="flex items-end gap-2.5">
            <textarea
              ref={inputRef}
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Message ${department?.name || 'the team'}...`}
              rows={1}
              className="flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 focus:bg-white transition-all max-h-32 overflow-y-auto"
              style={{ minHeight: '44px' }}
            />
            <Button
              onClick={sendMessage}
              disabled={!newMessage.trim() || sending}
              className="bg-slate-900 hover:bg-slate-800 rounded-xl h-11 w-11 p-0 flex items-center justify-center flex-shrink-0"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5 ml-1">Press Enter to send, Shift+Enter for new line</p>
        </div>
      </div>

      {sidebarOpen && (
        <div className="w-64 flex-shrink-0 border-l border-slate-100 flex flex-col overflow-hidden bg-slate-50/50">
          <div className="h-16 border-b border-slate-100 flex items-center px-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Members ({members.length})</p>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {members.map(member => (
              <div key={member.user_id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white transition-colors">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold bg-gradient-to-br ${getAvatarColor(member.user_id)} flex-shrink-0`}>
                  {getInitials(member.full_name)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <p className="text-xs font-semibold text-slate-700 truncate">
                      {member.full_name}
                      {member.user_id === profile?.id && (
                        <span className="ml-1 text-slate-400 font-normal">(you)</span>
                      )}
                    </p>
                    {roleIconMap[member.role]}
                  </div>
                  <p className="text-[10px] text-slate-400 capitalize">{member.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MessageEmptyIcon() {
  return (
    <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center">
      <svg className="w-6 h-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    </div>
  );
}
