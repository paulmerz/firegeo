'use client';

import { useState, useEffect } from 'react';
import { useSession } from '@/lib/auth-client';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCustomer } from '@/hooks/useAutumnCustomer';
import { Button } from '@/components/ui/button';
import { Send, Menu, X, MessageSquare, Plus, Trash2 } from 'lucide-react';
import { useConversations, useConversation, useDeleteConversation } from '@/hooks/useConversations';
import { useSendMessage } from '@/hooks/useMessages';
import { format } from 'date-fns';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import type { Session } from '@/lib/auth';

// Separate component that uses Autumn hooks
function ChatContent({ session }: { session: Session }) {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const t = useTranslations();
  const { allowed, customer, refetch } = useCustomer();
  const [input, setInput] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedConversationId, setSelectedConversationId] = useState<string | undefined>(undefined);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<string | undefined>(undefined);
  
  // Queries and mutations
  const { data: conversations, isLoading: conversationsLoading } = useConversations();
  const { data: currentConversation } = useConversation(selectedConversationId ?? null);
  const sendMessage = useSendMessage();
  const deleteConversation = useDeleteConversation();
  
  // Get message usage data
  const messageUsage = customer?.features?.messages;
  const remainingMessages = messageUsage ? (messageUsage.balance || 0) : 0;
  const hasMessages = remainingMessages > 0;
  const isCustomerLoading = !customer && !session; // Still loading customer data

  // Removed auto-scroll functionality

  const handleSendMessage = async () => {
    if (!input.trim() || sendMessage.isPending) return;

    // Check if user has messages available
    if (!allowed({ featureId: 'messages' })) {
      return;
    }

    try {
      const response = await sendMessage.mutateAsync({
        conversationId: selectedConversationId,
        message: input,
      });
      
      setInput('');
      
      // If this created a new conversation, select it
      if (!selectedConversationId && response.conversationId) {
        setSelectedConversationId(response.conversationId);
      }
      
      // Refetch customer data to update credits in navbar
      await refetch();
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };
  
  const handleNewConversation = () => {
    setSelectedConversationId(undefined);
  };
  
  const handleDeleteConversation = async (conversationId: string) => {
    setConversationToDelete(conversationId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (conversationToDelete) {
      await deleteConversation.mutateAsync(conversationToDelete);
      if (selectedConversationId === conversationToDelete) {
        setSelectedConversationId(undefined);
      }
      setConversationToDelete(undefined);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-0'} bg-white border-r overflow-hidden flex flex-col transition-all duration-200`}>
        <div className="p-4 border-b">
          <Button
            onClick={handleNewConversation}
            className="w-full btn-firecrawl-orange"
          >
            <Plus className="w-4 h-4 mr-2" />
            {t('chat.newChat')}
          </Button>
        </div>
        
        <div className="overflow-y-auto flex-1">
          {conversationsLoading ? (
            <div className="p-4 text-center text-gray-500">{t('chat.loadingConversations')}</div>
          ) : conversations?.length === 0 ? (
            <div className="p-4 text-center text-gray-500">{t('chat.noConversations')}</div>
          ) : (
            <div className="space-y-1 p-2">
              {conversations?.map((conversation) => (
                <div
                  key={conversation.id}
                  className={`p-3 rounded-lg cursor-pointer hover:bg-gray-100 ${
                    selectedConversationId === conversation.id ? 'bg-gray-100' : ''
                  }`}
                  onClick={() => setSelectedConversationId(conversation.id)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                                                  {conversation.title || t('chat.untitledConversation')}
                      </p>
                      <p className="text-xs text-gray-500">
                        {conversation.lastMessageAt ? format(new Date(conversation.lastMessageAt as unknown as string | number), 'MMM d, h:mm a') : ''}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteConversation(conversation.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="p-4 border-t bg-gray-50">
          <div className="text-sm text-gray-600">
            <p>{t('chat.messagesRemaining')}</p>
            <p className="text-2xl font-bold text-orange-600">{remainingMessages}</p>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
            <h1 className="font-semibold">
              {currentConversation?.title || t('chat.newConversation')}
            </h1>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4">
          {isCustomerLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
                <p className="text-gray-600">{t('chat.loadingAccountData')}</p>
              </div>
            </div>
          ) : !hasMessages ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-md">
                <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h2 className="text-xl font-semibold mb-2">{t('chat.creditBasedMessaging')}</h2>
                <p className="text-gray-600 mb-4">
                  {t('chat.creditBasedDesc')}
                </p>
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-orange-800">
                    {t('chat.youCurrentlyHave')} <span className="font-bold">{remainingMessages}</span> {t('chat.messageCreditsAvailable')}
                  </p>
                </div>
                <Button
                  onClick={() => router.push(`/${locale}/plans`)}
                  className="btn-firecrawl-orange"
                >
                  {t('chat.getMoreCredits')}
                </Button>
              </div>
            </div>
          ) : currentConversation?.messages && currentConversation.messages.length > 0 ? (
            <div className="space-y-4 mb-20">
              {currentConversation.messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[70%] rounded-lg px-4 py-2 ${
                      message.role === 'user'
                        ? 'bg-orange-500 text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                    <p className={`text-xs mt-1 ${
                      message.role === 'user' ? 'text-orange-100' : 'text-gray-500'
                    }`}>
                      {message.createdAt ? format(new Date(message.createdAt as unknown as string | number), 'h:mm a') : ''}
                    </p>
                  </div>
                </div>
              ))}
              {sendMessage.isPending && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 text-gray-900 rounded-lg px-4 py-2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h2 className="text-xl font-semibold mb-2">{t('chat.startConversation')}</h2>
                <p className="text-gray-600">
                  {t('chat.sendMessageToBegin')}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t bg-white p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={hasMessages ? t('chat.typeMessage') : t('chat.noMessagesAvailable')}
              disabled={!hasMessages || sendMessage.isPending}
              className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:bg-gray-100 disabled:text-gray-500"
            />
            <Button
              type="submit"
              disabled={!hasMessages || !input.trim() || sendMessage.isPending}
              className="btn-firecrawl-orange"
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </div>
      
      <ConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={t('chat.deleteConversation')}
        description={t('chat.deleteConversationDesc')}
        confirmText={t('chat.delete')}
        cancelText={t('common.cancel')}
        onConfirm={confirmDelete}
        isLoading={deleteConversation.isPending}
      />
    </div>
  );
}

export default function ChatPage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!isPending && !session) {
      router.push('/login');
    }
  }, [session, isPending, router]);

  if (isPending || !session) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return <ChatContent session={session} />;
}