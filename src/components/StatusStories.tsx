import React, { useState, useEffect, useRef } from 'react';
import { Story, User } from '../types';
import { chatStore } from '../services/chatService';
import { uploadMediaFile } from '../services/storageService';
import { Plus, X, Eye, ChevronRight, Image as ImageIcon, Loader2, Send, Trash2 } from 'lucide-react';

interface StatusStoriesProps {
  currentUser: User | null;
  onOpenStoryChat: (userId: string) => void;
}

const TEXT_BG_OPTIONS = [
  { id: 'from-emerald-600 to-emerald-900', label: 'Emerald', swatch: 'bg-emerald-600' },
  { id: 'from-teal-600 to-cyan-900', label: 'Teal', swatch: 'bg-teal-600' },
  { id: 'from-indigo-600 to-slate-900', label: 'Indigo', swatch: 'bg-indigo-600' },
  { id: 'from-rose-600 to-rose-900', label: 'Rose', swatch: 'bg-rose-600' },
  { id: 'from-amber-600 to-orange-900', label: 'Amber', swatch: 'bg-amber-600' },
];

export const StatusStories: React.FC<StatusStoriesProps> = ({ currentUser, onOpenStoryChat }) => {
  const [stories, setStories] = useState<Story[]>(chatStore.getStories());
  const [activeStory, setActiveStory] = useState<Story | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCaption, setNewCaption] = useState('');
  const [bgGradient, setBgGradient] = useState(TEXT_BG_OPTIONS[0].id);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [replyText, setReplyText] = useState('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const sync = () => {
      setStories(chatStore.getStories());
    };
    sync();
    return chatStore.subscribe(sync);
  }, []);

  const myStories = currentUser ? stories.filter((s) => s.userId === currentUser.id) : [];
  const otherStories = currentUser ? stories.filter((s) => s.userId !== currentUser.id) : stories;

  const handleOpenStory = (story: Story) => {
    setActiveStory(story);
    setReplyText('');
    if (currentUser && story.userId !== currentUser.id && !story.viewers.includes(currentUser.id)) {
      chatStore.markStoryViewed(story.id);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleCreateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCaption.trim() && !selectedFile) return;

    setIsSubmitting(true);
    try {
      let mediaUrl = '';
      if (selectedFile) {
        mediaUrl = await uploadMediaFile(
          `stories/${currentUser?.id || 'user'}_${Date.now()}_${selectedFile.name}`,
          selectedFile,
          { isImage: true }
        );
      }
      await chatStore.addStory(mediaUrl, newCaption.trim(), mediaUrl ? undefined : bgGradient);
      setNewCaption('');
      setSelectedFile(null);
      setPreviewUrl('');
      setShowCreateModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendStoryReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStory || !currentUser || activeStory.userId === currentUser.id) return;
    const targetUserId = activeStory.userId;
    const text = replyText.trim();
    if (text) {
      const chat = await chatStore.createOrGetPrivateChat(targetUserId);
      await chatStore.sendMessage({
        chatId: chat.id,
        text: `Status reply: "${activeStory.caption || 'Photo status'}"\n${text}`,
        type: 'text',
      });
    }
    setActiveStory(null);
    onOpenStoryChat(targetUserId);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F4F6F8] dark:bg-[#181A1D] text-slate-900 dark:text-zinc-100 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6 select-none transition-colors">
      <div className="max-w-2xl mx-auto w-full">
        <div className="flex items-center justify-between mb-6 gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-zinc-100 font-['Outfit']">
              Status Updates
            </h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Live 24-hour status updates from registered DOST users
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="min-h-[40px] py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Status</span>
          </button>
        </div>

        {/* My Status Card */}
        <div className="bg-white dark:bg-[#22252B] rounded-3xl p-4 shadow-xs border border-slate-200/80 dark:border-white/[0.08] mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img
                src={currentUser?.photoUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser?.id || 'user'}`}
                alt={currentUser?.displayName || 'My Profile'}
                referrerPolicy="no-referrer"
                className="w-14 h-14 rounded-full object-cover border-2 border-emerald-500 p-0.5"
              />
              <button
                onClick={() => setShowCreateModal(true)}
                className="absolute bottom-0 right-0 w-5 h-5 bg-emerald-600 text-white rounded-full flex items-center justify-center border-2 border-white dark:border-[#22252B] cursor-pointer"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100">My Status</h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                {myStories.length > 0
                  ? `${myStories.length} active updates · ${myStories[0].viewers.length} views`
                  : 'Tap + to post a status update'}
              </p>
            </div>
          </div>
          {myStories.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleOpenStory(myStories[0])}
                className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-xs font-semibold rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-500/25 cursor-pointer"
              >
                View Mine
              </button>
              <button
                onClick={() => chatStore.deleteStory(myStories[0].id)}
                className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/15 rounded-lg cursor-pointer"
                title="Delete latest status"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Recent Updates */}
        <h2 className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-3 px-1">
          Recent Contact Stories ({otherStories.length})
        </h2>

        {otherStories.length === 0 ? (
          <div className="bg-white dark:bg-[#22252B] rounded-2xl p-8 text-center text-xs text-slate-500 dark:text-zinc-400 border border-slate-200/70 dark:border-white/[0.08]">
            No status updates from other users in the last 24 hours.
          </div>
        ) : (
          <div className="space-y-3">
            {otherStories.map((story) => (
              <div
                key={story.id}
                onClick={() => handleOpenStory(story)}
                className="bg-white dark:bg-[#22252B] rounded-2xl p-3.5 shadow-xs border border-slate-200/70 dark:border-white/[0.08] hover:border-emerald-400 transition-all flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative p-0.5 rounded-full ring-2 ring-emerald-500 shrink-0">
                    <img
                      src={story.userPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${story.userId}`}
                      alt={story.userName}
                      referrerPolicy="no-referrer"
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-100 truncate">
                      {story.userName}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 truncate max-w-xs">
                      {story.caption || 'Shared a photo'}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 dark:text-zinc-500 shrink-0" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fullscreen Story Viewer Modal */}
      {activeStory && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
          <div className="relative w-full max-w-md bg-[#1D2025] rounded-3xl overflow-hidden shadow-2xl h-[560px] flex flex-col justify-between p-4 border border-white/10">
            <div className="flex items-center justify-between text-white z-10">
              <div className="flex items-center gap-2.5">
                <img
                  src={activeStory.userPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${activeStory.userId}`}
                  alt={activeStory.userName}
                  referrerPolicy="no-referrer"
                  className="w-9 h-9 rounded-full object-cover border border-white/40"
                />
                <div>
                  <p className="text-xs font-bold">{activeStory.userName}</p>
                  <p className="text-[10px] text-white/70 font-mono">
                    {new Date(activeStory.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 text-[11px] text-white/70 font-mono tabular-nums">
                  <Eye className="w-3.5 h-3.5" />
                  {activeStory.viewers.length}
                </span>
                {currentUser && activeStory.userId === currentUser.id && (
                  <button
                    onClick={async () => {
                      const idToDelete = activeStory.id;
                      setActiveStory(null);
                      await chatStore.deleteStory(idToDelete);
                    }}
                    className="p-1 text-rose-300 hover:text-rose-200 cursor-pointer"
                    title="Delete Status"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => setActiveStory(null)}
                  className="p-1 text-white/80 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="my-auto text-center flex flex-col items-center">
              {activeStory.mediaUrl ? (
                <>
                  <img
                    src={activeStory.mediaUrl}
                    alt="Story"
                    referrerPolicy="no-referrer"
                    className="max-h-72 w-auto object-contain rounded-2xl shadow-lg border border-white/10"
                  />
                  {activeStory.caption && (
                    <p className="text-white text-sm font-medium mt-4 px-4 bg-black/40 py-2 rounded-xl backdrop-blur-xs">
                      {activeStory.caption}
                    </p>
                  )}
                </>
              ) : (
                <div
                  className={`w-full py-16 px-6 rounded-2xl bg-gradient-to-br ${
                    activeStory.backgroundColor || 'from-emerald-600 to-emerald-900'
                  } text-white text-lg font-bold shadow-inner`}
                >
                  {activeStory.caption}
                </div>
              )}
            </div>

            {currentUser && activeStory.userId !== currentUser.id ? (
              <form onSubmit={handleSendStoryReply} className="flex items-center gap-2 pt-2 border-t border-white/10 z-10">
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Reply to status..."
                  className="flex-1 py-2.5 px-3 bg-white/10 rounded-xl text-xs text-white placeholder-white/50 focus:outline-none focus:bg-white/20"
                />
                <button
                  type="submit"
                  className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Reply</span>
                </button>
              </form>
            ) : (
              <div className="text-center text-xs text-white/75 py-2 border-t border-white/10">
                {activeStory.viewers.length === 0 ? (
                  <span>No viewers yet</span>
                ) : (
                  <div className="flex flex-wrap items-center justify-center gap-1.5">
                    <span className="text-white/50">Viewed by:</span>
                    {activeStory.viewers.map((vid) => {
                      const viewer = chatStore.getUser(vid);
                      return (
                        <span
                          key={vid}
                          className="px-2 py-0.5 bg-white/10 rounded-full text-[11px] font-medium text-white"
                        >
                          {viewer?.displayName || 'User'}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create New Status Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#25282F] rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-slate-100 dark:border-white/10 text-slate-900 dark:text-zinc-100">
            <h3 className="text-lg font-bold mb-1 font-['Outfit']">Post Status Update</h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mb-4">
              Visible to registered DOST users for 24 hours.
            </p>
            <form onSubmit={handleCreateStatus} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Status Text / Caption</label>
                <textarea
                  value={newCaption}
                  onChange={(e) => setNewCaption(e.target.value)}
                  placeholder="Share a quick update..."
                  className="w-full p-2.5 text-xs rounded-xl bg-slate-50 dark:bg-[#1E2126] border border-slate-200 dark:border-white/10 focus:outline-none focus:border-emerald-500 h-24"
                />
              </div>

              {!selectedFile && (
                <div>
                  <label className="block text-xs font-semibold mb-1.5">Text Status Background</label>
                  <div className="flex items-center gap-2">
                    {TEXT_BG_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setBgGradient(opt.id)}
                        className={`w-7 h-7 rounded-full ${opt.swatch} cursor-pointer transition-transform ${
                          bgGradient === opt.id ? 'ring-2 ring-offset-2 ring-emerald-500 scale-110' : 'opacity-75'
                        }`}
                        title={opt.label}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2.5 px-3 border border-dashed border-emerald-400/70 bg-emerald-50/50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 hover:bg-emerald-50 dark:hover:bg-emerald-500/20 cursor-pointer"
                >
                  <ImageIcon className="w-4 h-4" />
                  <span>{selectedFile ? selectedFile.name : 'Attach Photo (Optional)'}</span>
                </button>
                {previewUrl && (
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="mt-2 max-h-32 w-full object-cover rounded-xl border border-slate-200 dark:border-white/10"
                  />
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setSelectedFile(null);
                    setPreviewUrl('');
                  }}
                  className="flex-1 py-2.5 text-xs font-semibold text-slate-600 dark:text-zinc-300 bg-slate-100 dark:bg-[#31353E] rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || (!newCaption.trim() && !selectedFile)}
                  className="flex-1 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isSubmitting ? 'Posting...' : 'Post Status'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
