import React, { useState, useEffect, useRef } from 'react';
import { User, Chat } from '../types';
import { chatStore } from '../services/chatService';
import { uploadMediaFile } from '../services/storageService';
import {
  Users,
  X,
  Check,
  ShieldCheck,
  Shield,
  Loader2,
  Camera,
  Search,
  LogOut,
} from 'lucide-react';

interface GroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  existingChat?: Chat | null;
  onGroupCreated?: (newChat: Chat) => void;
  onGroupLeft?: () => void;
}

export const GroupModal: React.FC<GroupModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  existingChat,
  onGroupCreated,
  onGroupLeft,
}) => {
  const [name, setName] = useState(existingChat?.name || '');
  const [description, setDescription] = useState(existingChat?.description || '');
  const [photoUrl, setPhotoUrl] = useState(existingChat?.photoUrl || '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [memberSearch, setMemberSearch] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(
    existingChat ? existingChat.participants : [currentUser.id]
  );
  const [adminIds, setAdminIds] = useState<string[]>(
    existingChat?.adminIds || [currentUser.id]
  );
  const [onlyAdminsCanMessage, setOnlyAdminsCanMessage] = useState(
    Boolean(existingChat?.onlyAdminsCanMessage)
  );
  const [onlyAdminsCanEdit, setOnlyAdminsCanEdit] = useState(
    Boolean(existingChat?.onlyAdminsCanEdit)
  );
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName(existingChat?.name || '');
      setDescription(existingChat?.description || '');
      setPhotoUrl(existingChat?.photoUrl || '');
      setAvatarFile(null);
      setMemberSearch('');
      setConfirmLeave(false);
      setSelectedMemberIds(existingChat ? existingChat.participants : [currentUser.id]);
      setAdminIds(existingChat?.adminIds || [currentUser.id]);
      setOnlyAdminsCanMessage(Boolean(existingChat?.onlyAdminsCanMessage));
      setOnlyAdminsCanEdit(Boolean(existingChat?.onlyAdminsCanEdit));
    }
  }, [isOpen, existingChat, currentUser.id]);

  if (!isOpen) return null;

  const isEditing = !!existingChat;
  const amIGroupAdmin = !isEditing || adminIds.includes(currentUser.id);
  const allUsers = chatStore
    .getUsers()
    .filter((u) => u.id !== currentUser.id)
    .filter((u) => {
      if (!memberSearch.trim()) return true;
      const q = memberSearch.trim().toLowerCase();
      return (
        (u.displayName || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.phoneNumber || '').toLowerCase().includes(q)
      );
    });

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setPhotoUrl(URL.createObjectURL(file));
  };

  const toggleMember = (userId: string) => {
    if (!amIGroupAdmin) return;
    if (selectedMemberIds.includes(userId)) {
      setSelectedMemberIds(selectedMemberIds.filter((id) => id !== userId));
      setAdminIds(adminIds.filter((id) => id !== userId));
    } else {
      setSelectedMemberIds([...selectedMemberIds, userId]);
    }
  };

  const toggleAdminRole = (e: React.MouseEvent, userId: string) => {
    e.stopPropagation();
    if (!amIGroupAdmin || userId === currentUser.id) return;
    if (adminIds.includes(userId)) {
      setAdminIds(adminIds.filter((id) => id !== userId));
    } else {
      setAdminIds([...adminIds, userId]);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSaving(true);
    try {
      let uploadedPhotoUrl = existingChat?.photoUrl;
      if (avatarFile) {
        uploadedPhotoUrl = await uploadMediaFile(
          `groups/${existingChat?.id || Date.now()}_${avatarFile.name}`,
          avatarFile,
          { isImage: true }
        );
      }

      const finalParticipants = Array.from(new Set([currentUser.id, ...selectedMemberIds]));
      if (isEditing && existingChat) {
        if (amIGroupAdmin || !existingChat.onlyAdminsCanEdit) {
          await chatStore.updateGroup(existingChat.id, {
            name: name.trim(),
            description: description.trim(),
            participants: amIGroupAdmin ? finalParticipants : existingChat.participants,
            adminIds: amIGroupAdmin
              ? Array.from(new Set([currentUser.id, ...adminIds]))
              : existingChat.adminIds,
            onlyAdminsCanMessage: amIGroupAdmin
              ? onlyAdminsCanMessage
              : existingChat.onlyAdminsCanMessage,
            onlyAdminsCanEdit: amIGroupAdmin
              ? onlyAdminsCanEdit
              : existingChat.onlyAdminsCanEdit,
            ...(uploadedPhotoUrl ? { photoUrl: uploadedPhotoUrl } : {}),
          });
        }
        onClose();
      } else {
        const newChat = await chatStore.createGroup(
          name.trim(),
          description.trim(),
          finalParticipants,
          uploadedPhotoUrl
        );
        if (onGroupCreated) onGroupCreated(newChat);
        onClose();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleLeaveGroup = async () => {
    if (!existingChat) return;
    setIsSaving(true);
    try {
      await chatStore.leaveGroup(existingChat.id);
      if (onGroupLeft) onGroupLeft();
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in select-none">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[88vh]">
        {/* Top Header */}
        <div className="bg-gradient-to-r from-[#0FA958] to-[#0B8043] p-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-xs flex items-center justify-center">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold font-['Outfit']">
                {isEditing ? 'Group Details & Admins' : 'Create New Group'}
              </h2>
              <p className="text-[11px] text-emerald-100">
                {isEditing ? `${selectedMemberIds.length} members` : 'Add registered DOST users'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:text-emerald-200 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSave} className="p-5 flex-1 overflow-y-auto space-y-4">
          {/* Group Icon Upload */}
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <img
                src={photoUrl || '/assets/aistudio/download_7eb2aac4.jpeg'}
                alt="Group Icon"
                className="w-14 h-14 rounded-2xl object-cover border border-emerald-200 shadow-xs"
              />
              {amIGroupAdmin && (
                <>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center border-2 border-white cursor-pointer"
                    title="Upload Group Icon"
                  >
                    <Camera className="w-3 h-3" />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoSelect}
                    className="hidden"
                  />
                </>
              )}
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Group Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!amIGroupAdmin}
                placeholder="e.g. Friends Group"
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500 disabled:bg-slate-50"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Group Topic / Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={!amIGroupAdmin && Boolean(existingChat?.onlyAdminsCanEdit)}
              placeholder="What is this group about?"
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500 h-16 disabled:bg-slate-50"
            />
          </div>

          {amIGroupAdmin && (
            <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200/70 space-y-2.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Admin Member Controls</span>
              </p>
              <label className="flex items-center justify-between text-xs cursor-pointer">
                <div>
                  <p className="font-semibold text-slate-800">Only Admins Can Send Messages</p>
                  <p className="text-[10px] text-slate-500">Turn on for announcement-only groups</p>
                </div>
                <input
                  type="checkbox"
                  checked={onlyAdminsCanMessage}
                  onChange={(e) => setOnlyAdminsCanMessage(e.target.checked)}
                  className="w-4 h-4 accent-emerald-600 cursor-pointer"
                />
              </label>
              <label className="flex items-center justify-between text-xs cursor-pointer pt-1 border-t border-emerald-200/50">
                <div>
                  <p className="font-semibold text-slate-800">Only Admins Can Edit Group Info</p>
                  <p className="text-[10px] text-slate-500">Protect name, icon, and description</p>
                </div>
                <input
                  type="checkbox"
                  checked={onlyAdminsCanEdit}
                  onChange={(e) => setOnlyAdminsCanEdit(e.target.checked)}
                  className="w-4 h-4 accent-emerald-600 cursor-pointer"
                />
              </label>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-slate-700">
                Members ({selectedMemberIds.length})
              </label>
            </div>

            <div className="relative mb-2">
              <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Search registered users to add..."
                className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {allUsers.length === 0 ? (
              <p className="text-xs text-slate-400 p-4 bg-slate-50 rounded-xl text-center">
                {memberSearch.trim()
                  ? `No users matching "${memberSearch}"`
                  : 'No other registered users yet. Invite friends to register their accounts!'}
              </p>
            ) : (
              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                {allUsers.map((user) => {
                  const isSelected = selectedMemberIds.includes(user.id);
                  const isUserAdmin = adminIds.includes(user.id);
                  return (
                    <div
                      key={user.id}
                      onClick={() => toggleMember(user.id)}
                      className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                        amIGroupAdmin ? 'cursor-pointer' : ''
                      } ${
                        isSelected ? 'border-emerald-500 bg-emerald-50/50' : 'border-slate-100 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={user.photoUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`}
                          alt={user.displayName}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-800 truncate">{user.displayName}</p>
                          <p className="text-[10px] text-slate-400 truncate">{user.phoneNumber || user.email}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isEditing && isSelected && amIGroupAdmin && (
                          <button
                            type="button"
                            onClick={(e) => toggleAdminRole(e, user.id)}
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold flex items-center gap-1 cursor-pointer ${
                              isUserAdmin
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-emerald-100 hover:text-emerald-800'
                            }`}
                            title={isUserAdmin ? 'Remove Group Admin' : 'Make Group Admin'}
                          >
                            {isUserAdmin ? <ShieldCheck className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
                            <span>{isUserAdmin ? 'Admin' : 'Make Admin'}</span>
                          </button>
                        )}
                        {!amIGroupAdmin && isUserAdmin && (
                          <span className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                            Admin
                          </span>
                        )}
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${
                            isSelected ? 'bg-emerald-600 text-white' : 'border border-slate-300'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-2 space-y-2">
            {amIGroupAdmin && (
              <button
                type="submit"
                disabled={isSaving}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-md transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{isEditing ? 'Save Group Changes' : 'Create Group'}</span>
              </button>
            )}

            {isEditing && (
              !confirmLeave ? (
                <button
                  type="button"
                  onClick={() => setConfirmLeave(true)}
                  className="w-full py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-semibold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Leave Group</span>
                </button>
              ) : (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-rose-700">Leave "{name}"?</span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setConfirmLeave(false)}
                      className="px-2.5 py-1 bg-white text-slate-600 text-[11px] font-semibold rounded-lg cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleLeaveGroup}
                      disabled={isSaving}
                      className="px-2.5 py-1 bg-rose-600 text-white text-[11px] font-semibold rounded-lg cursor-pointer"
                    >
                      Confirm
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

