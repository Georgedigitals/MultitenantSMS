'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ConversationSummary, RecipientOption, ThreadMessage } from '@/lib/messages';
import { TenantUserRole } from '@prisma/client';

interface MessagesClientProps {
  slug: string;
  currentUserId: string;
  currentUserRole: TenantUserRole;
  initialConversations: ConversationSummary[];
  recipients: RecipientOption[];
  preselectedRecipientId: string | null;
  preselectedConversationId: string | null;
}

export default function MessagesClient({
  slug,
  currentUserId,
  currentUserRole,
  initialConversations,
  recipients,
  preselectedRecipientId,
  preselectedConversationId,
}: MessagesClientProps) {
  const [conversations, setConversations] = useState<ConversationSummary[]>(initialConversations);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(
    preselectedConversationId || (initialConversations[0]?.id ?? null)
  );
  const [activeThread, setActiveThread] = useState<{
    conversation: { id: string; type: string; title: string | null };
    otherUser: { id: string; name: string; role: TenantUserRole; roleLabel: string } | null;
    messages: ThreadMessage[];
  } | null>(null);

  const [loadingThread, setLoadingThread] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [sending, setSending] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [showNewModal, setShowNewModal] = useState(Boolean(preselectedRecipientId));
  const [newRecipientSearch, setNewRecipientSearch] = useState('');
  const [selectedRecipientRoleFilter, setSelectedRecipientRoleFilter] = useState<string>('all');
  const [modalSelectedRecipient, setModalSelectedRecipient] = useState<RecipientOption | null>(
    preselectedRecipientId
      ? recipients.find((r) => r.id === preselectedRecipientId) || null
      : null
  );
  const [modalInitialMessage, setModalInitialMessage] = useState('');
  const [modalSending, setModalSending] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom of active message thread
  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  // Load conversation thread when selection changes
  const fetchThread = async (convId: string, markRead = true) => {
    try {
      if (!activeThread || activeThread.conversation.id !== convId) {
        setLoadingThread(true);
      }
      const res = await fetch(`/api/tenant/messages/${convId}`);
      if (res.ok) {
        const data = await res.json();
        setActiveThread(data);

        // Update local unread counter in conversations list
        if (markRead) {
          setConversations((prev) =>
            prev.map((c) => (c.id === convId ? { ...c, unreadCount: 0 } : c))
          );
        }
      }
    } catch (err) {
      console.error('Failed to load thread:', err);
    } finally {
      setLoadingThread(false);
    }
  };

  // Initial load or when selectedConversationId changes
  useEffect(() => {
    if (selectedConversationId) {
      fetchThread(selectedConversationId);
    } else {
      setActiveThread(null);
    }
  }, [selectedConversationId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom(false);
  }, [activeThread?.messages]);

  // Polling for live updates every 5 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      if (document.hidden) return;

      // 1. Refresh conversation list
      try {
        const convRes = await fetch('/api/tenant/messages');
        if (convRes.ok) {
          const { conversations: updated } = await convRes.json();
          setConversations(updated);
        }
      } catch (_) {}

      // 2. Refresh active thread
      if (selectedConversationId) {
        try {
          const threadRes = await fetch(`/api/tenant/messages/${selectedConversationId}`);
          if (threadRes.ok) {
            const data = await threadRes.json();
            setActiveThread(data);
          }
        } catch (_) {}
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [selectedConversationId]);

  // Send message in existing thread
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!messageInput.trim() || !selectedConversationId || sending) return;

    const content = messageInput.trim();
    setMessageInput('');
    setSending(true);
    setErrorBanner(null);

    try {
      const res = await fetch(`/api/tenant/messages/${selectedConversationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to send message');
      }

      const { message } = await res.json();

      // Append locally
      setActiveThread((prev) =>
        prev
          ? {
              ...prev,
              messages: [...prev.messages, message],
            }
          : null
      );

      // Update conversations list snippet
      setConversations((prev) =>
        prev.map((c) =>
          c.id === selectedConversationId
            ? {
                ...c,
                updatedAt: new Date().toISOString(),
                lastMessage: {
                  id: message.id,
                  content: message.content,
                  senderId: currentUserId,
                  senderName: 'You',
                  createdAt: message.createdAt,
                },
              }
            : c
        )
      );

      scrollToBottom(true);
    } catch (err: any) {
      setErrorBanner(err.message || 'Error sending message');
      setMessageInput(content); // restore input
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  };

  // Start new conversation from modal
  const handleStartNewConversation = async (recipient: RecipientOption, messageText: string) => {
    if (!messageText.trim() || modalSending) return;

    setModalSending(true);
    setErrorBanner(null);

    try {
      const res = await fetch('/api/tenant/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientId: recipient.id,
          content: messageText.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to initiate conversation');
      }

      setShowNewModal(false);
      setModalSelectedRecipient(null);
      setModalInitialMessage('');

      // Refresh conversations and select the new one
      const convRes = await fetch('/api/tenant/messages');
      if (convRes.ok) {
        const { conversations: updated } = await convRes.json();
        setConversations(updated);
      }

      setSelectedConversationId(data.conversationId);
    } catch (err: any) {
      setErrorBanner(err.message || 'Failed to start conversation');
    } finally {
      setModalSending(false);
    }
  };

  // Keyboard shortcut: Enter to send, Shift+Enter for newline
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Filter conversations
  const filteredConversations = useMemo(() => {
    const q = searchFilter.toLowerCase().trim();
    if (!q) return conversations;
    return conversations.filter(
      (c) =>
        c.otherParticipant?.name.toLowerCase().includes(q) ||
        c.otherParticipant?.roleLabel.toLowerCase().includes(q) ||
        c.lastMessage?.content.toLowerCase().includes(q)
    );
  }, [conversations, searchFilter]);

  // Filter modal recipients
  const filteredRecipients = useMemo(() => {
    const q = newRecipientSearch.toLowerCase().trim();
    return recipients.filter((r) => {
      const matchesSearch =
        !q ||
        r.name.toLowerCase().includes(q) ||
        r.roleLabel.toLowerCase().includes(q) ||
        (r.subtitle && r.subtitle.toLowerCase().includes(q));

      const matchesRole =
        selectedRecipientRoleFilter === 'all' ||
        r.role === selectedRecipientRoleFilter;

      return matchesSearch && matchesRole;
    });
  }, [recipients, newRecipientSearch, selectedRecipientRoleFilter]);

  // Total unread count across all conversations
  const totalUnread = useMemo(() => {
    return conversations.reduce((acc, curr) => acc + (curr.unreadCount || 0), 0);
  }, [conversations]);

  // Format timestamp helper
  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const isToday = date.toDateString() === now.toDateString();
      if (isToday) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch (_) {
      return '';
    }
  };

  const getRoleBadgeColor = (role: TenantUserRole) => {
    switch (role) {
      case 'school_admin':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'teacher':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'parent':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'student':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] max-w-7xl mx-auto p-4 md:p-6">
      {/* Top Banner / Breadcrumb */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            In-App Messaging
            {totalUnread > 0 && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-600 text-white shadow-xs">
                {totalUnread} unread
              </span>
            )}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Internal communication portal with school safeguarding boundaries.
          </p>
        </div>

        <button
          onClick={() => {
            setModalSelectedRecipient(null);
            setModalInitialMessage('');
            setShowNewModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Message
        </button>
      </div>

      {errorBanner && (
        <div className="mb-3 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center justify-between">
          <span>{errorBanner}</span>
          <button
            onClick={() => setErrorBanner(null)}
            className="text-red-500 hover:text-red-700 text-xs font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Container Card */}
      <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden flex flex-col md:flex-row">
        {/* ─── LEFT PANEL: Conversations Sidebar ─── */}
        <div
          className={`w-full md:w-80 lg:w-96 border-r border-slate-200 flex flex-col bg-slate-50/50 ${
            selectedConversationId && activeThread ? 'hidden md:flex' : 'flex'
          }`}
        >
          {/* Search Box */}
          <div className="p-3 border-b border-slate-200 bg-white">
            <div className="relative">
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-slate-800 placeholder-slate-400"
              />
              <svg
                className="w-4 h-4 text-slate-400 absolute left-3 top-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <svg
                  className="w-12 h-12 mx-auto text-slate-300 mb-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
                <p className="text-sm font-medium text-slate-600">No conversations found</p>
                <p className="text-xs text-slate-400 mt-1">
                  Start a new conversation with the button above.
                </p>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isSelected = conv.id === selectedConversationId;
                const other = conv.otherParticipant;
                const initials = other?.name
                  ? other.name
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()
                  : '??';

                return (
                  <button
                    key={conv.id}
                    onClick={() => setSelectedConversationId(conv.id)}
                    className={`w-full text-left p-3.5 flex items-start gap-3 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50/80 border-l-4 border-blue-600 pl-2.5'
                        : 'hover:bg-slate-100/70'
                    }`}
                  >
                    {/* Avatar */}
                    <div className="relative shrink-0">
                      <div className="w-11 h-11 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center font-bold text-slate-700 text-sm">
                        {initials}
                      </div>
                      {conv.unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>

                    {/* Meta */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between mb-1">
                        <h2 className="text-sm font-semibold text-slate-900 truncate">
                          {other?.name || 'Direct Conversation'}
                        </h2>
                        <span className="text-[11px] text-slate-400 shrink-0 ml-2">
                          {formatTime(conv.updatedAt)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 mb-1.5">
                        {other && (
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border ${getRoleBadgeColor(
                              other.role
                            )}`}
                          >
                            {other.roleLabel}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-500 truncate">
                        {conv.lastMessage ? (
                          <>
                            <span className="font-medium text-slate-600">
                              {conv.lastMessage.senderId === currentUserId ? 'You: ' : ''}
                            </span>
                            {conv.lastMessage.content}
                          </>
                        ) : (
                          <span className="italic text-slate-400">No messages yet</span>
                        )}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ─── RIGHT PANEL: Active Message Thread ─── */}
        <div
          className={`flex-1 flex flex-col bg-white ${
            !selectedConversationId ? 'hidden md:flex' : 'flex'
          }`}
        >
          {selectedConversationId && activeThread ? (
            <>
              {/* Thread Header */}
              <div className="px-4 py-3 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  {/* Mobile Back Button */}
                  <button
                    onClick={() => setSelectedConversationId(null)}
                    className="md:hidden p-1.5 -ml-1 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100"
                    title="Back to conversation list"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 19l-7-7 7-7"
                      />
                    </svg>
                  </button>

                  <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 border border-blue-200 flex items-center justify-center font-bold text-sm">
                    {activeThread.otherUser?.name
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase() || '??'}
                  </div>

                  <div>
                    <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      {activeThread.otherUser?.name || 'Conversation'}
                      {activeThread.otherUser && (
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getRoleBadgeColor(
                            activeThread.otherUser.role
                          )}`}
                        >
                          {activeThread.otherUser.roleLabel}
                        </span>
                      )}
                    </h2>
                    <p className="text-xs text-slate-400">Direct School Thread</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => fetchThread(selectedConversationId)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                    title="Refresh messages"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Messages Body */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-slate-50/30">
                {loadingThread ? (
                  <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                    <svg
                      className="animate-spin w-5 h-5 mr-2 text-blue-600"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v8H4z"
                      />
                    </svg>
                    Loading messages...
                  </div>
                ) : activeThread.messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center text-slate-400">
                    <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-2">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                        />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-slate-700">No messages yet</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-xs">
                      Send your first message below to start this conversation.
                    </p>
                  </div>
                ) : (
                  activeThread.messages.map((msg) => {
                    const isMe = msg.isMe;

                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                      >
                        <div className="flex items-center gap-1.5 mb-1 px-1">
                          <span className="text-[11px] font-semibold text-slate-500">
                            {isMe ? 'You' : msg.senderName}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {formatTime(msg.createdAt)}
                          </span>
                        </div>

                        <div
                          className={`max-w-[85%] md:max-w-[70%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                            isMe
                              ? 'bg-blue-600 text-white rounded-br-xs shadow-xs'
                              : 'bg-white border border-slate-200 text-slate-900 rounded-bl-xs shadow-xs'
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Composer */}
              <form
                onSubmit={handleSendMessage}
                className="p-3 border-t border-slate-200 bg-white flex items-end gap-2"
              >
                <div className="flex-1 relative">
                  <textarea
                    ref={textareaRef}
                    rows={2}
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white resize-none transition-all placeholder-slate-400"
                    disabled={sending}
                  />
                </div>

                <button
                  type="submit"
                  disabled={!messageInput.trim() || sending}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-all shadow-xs flex items-center gap-1.5 h-10.5 cursor-pointer shrink-0"
                >
                  {sending ? (
                    <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v8H4z"
                      />
                    </svg>
                  ) : (
                    <>
                      <span>Send</span>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                        />
                      </svg>
                    </>
                  )}
                </button>
              </form>
            </>
          ) : (
            /* Empty State */
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50/50">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4 shadow-xs">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </div>
              <h2 className="text-base font-bold text-slate-800">Select a Conversation</h2>
              <p className="text-sm text-slate-500 mt-1 max-w-sm">
                Choose an existing message thread on the left or initiate a new message with
                teachers, parents, or school staff.
              </p>
              <button
                onClick={() => {
                  setModalSelectedRecipient(null);
                  setModalInitialMessage('');
                  setShowNewModal(true);
                }}
                className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
              >
                Start New Message
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ─── NEW MESSAGE MODAL ─── */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <h2 className="text-base font-bold text-slate-900">New Message</h2>
              <button
                onClick={() => setShowNewModal(false)}
                className="text-slate-400 hover:text-slate-600 rounded-lg p-1 hover:bg-slate-200/50"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 flex-1 overflow-y-auto space-y-4">
              {!modalSelectedRecipient ? (
                <>
                  {/* Role filter pills */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    {[
                      { id: 'all', label: 'All Contacts' },
                      { id: 'school_admin', label: 'Admin' },
                      { id: 'teacher', label: 'Teachers' },
                      { id: 'parent', label: 'Parents' },
                      { id: 'student', label: 'Students' },
                    ].map((f) => (
                      <button
                        key={f.id}
                        onClick={() => setSelectedRecipientRoleFilter(f.id)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer shrink-0 ${
                          selectedRecipientRoleFilter === f.id
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  {/* Recipient Search */}
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search recipient by name or role..."
                      value={newRecipientSearch}
                      onChange={(e) => setNewRecipientSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                      autoFocus
                    />
                    <svg
                      className="w-4 h-4 text-slate-400 absolute left-3 top-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                  </div>

                  {/* Recipient List */}
                  <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg">
                    {filteredRecipients.length === 0 ? (
                      <p className="p-4 text-center text-xs text-slate-400">
                        No eligible recipients found matching criteria.
                      </p>
                    ) : (
                      filteredRecipients.map((rec) => (
                        <button
                          key={rec.id}
                          onClick={() => setModalSelectedRecipient(rec)}
                          className="w-full text-left p-3 hover:bg-blue-50/70 transition-colors flex items-center justify-between cursor-pointer"
                        >
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{rec.name}</p>
                            <p className="text-xs text-slate-500">{rec.subtitle || rec.roleLabel}</p>
                          </div>
                          <span
                            className={`text-[10px] font-medium px-2 py-0.5 rounded border ${getRoleBadgeColor(
                              rec.role
                            )}`}
                          >
                            {rec.roleLabel}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </>
              ) : (
                /* Selected Recipient & Compose View */
                <div className="space-y-3">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-500">Messaging:</p>
                      <p className="text-sm font-bold text-slate-900">
                        {modalSelectedRecipient.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {modalSelectedRecipient.subtitle || modalSelectedRecipient.roleLabel}
                      </p>
                    </div>
                    <button
                      onClick={() => setModalSelectedRecipient(null)}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Change
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Message
                    </label>
                    <textarea
                      rows={4}
                      value={modalInitialMessage}
                      onChange={(e) => setModalInitialMessage(e.target.value)}
                      placeholder="Type your introductory message..."
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white resize-none"
                      autoFocus
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            {modalSelectedRecipient && (
              <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/50 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 text-sm font-semibold rounded-lg hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!modalInitialMessage.trim() || modalSending}
                  onClick={() =>
                    handleStartNewConversation(modalSelectedRecipient, modalInitialMessage)
                  }
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  {modalSending ? 'Sending...' : 'Send Message'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
