import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import Cropper from 'react-easy-crop';
import { useAuth } from '../App';
import { API_URL } from '../config';
import { getClassroomSocket, disconnectClassroomSocket } from '../utils/classroomSocket';
import '../styles/classroom.css';

/* ── Returns a square-cropped Blob from a data-URL ── */
async function getCroppedImg(imageSrc, pixelCrop) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      const size = Math.min(pixelCrop.width, pixelCrop.height);
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, pixelCrop.x, pixelCrop.y, size, size, 0, 0, size, size);
      canvas.toBlob(blob => {
        if (!blob) return reject(new Error('Canvas is empty'));
        resolve(blob);
      }, 'image/jpeg', 0.92);
    };
    image.onerror = reject;
    image.src = imageSrc;
  });
}

/* ── Icons (inline SVG to keep zero extra deps) ── */
const Ic = ({ d, size = 18, stroke = 'currentColor', fill = 'none', ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p}>
    {typeof d === 'string' ? <path d={d} /> : d}
  </svg>
);

const ICONS = {
  send: 'M22 2L11 13M22 2L15 22L11 13L2 9L22 2Z',
  edit: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
  trash: 'M3 6h18M8 6V4h8v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6',
  reply: 'M9 17l-5-5 5-5M20 18v-2a4 4 0 0 0-4-4H4',
  emoji: 'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01',
  attach: 'M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48',
  mic: 'M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8',
  micOff: 'M1 1l22 22M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23M12 19v4M8 23h8',
  plus: 'M12 5v14M5 12h14',
  close: 'M18 6L6 18M6 6l12 12',
  search: 'M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z',
  users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75M9 7a4 4 0 1 1 0 8 4 4 0 0 1 0-8z',
  more: 'M12 5h.01M12 12h.01M12 19h.01',
  check: 'M20 6L9 17l-5-5',
  checkdbl: [<path key="1" d="M18 6L7 17l-5-5"/>,<path key="2" d="M22 6L11 17"/>],
  group: 'M17 20h5v-2a3 3 0 0 0-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 0 1 5.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 0 1 9.288 0M15 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  link: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
  image: 'M4 16l4.586-4.586a2 2 0 0 1 2.828 0L16 16m-2-2l1.586-1.586a2 2 0 0 1 2.828 0L20 14m-6-6h.01M6 20h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z',
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  block: 'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM4.93 4.93l14.14 14.14',
  flag: 'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7',
  back: 'M19 12H5M12 19l-7-7 7-7',
  clock: 'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 6v6l4 2',
  copy: 'M8 16H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2m-6 12h8a2 2 0 0 1 2-2v-8a2 2 0 0 1-2-2h-8a2 2 0 0 1-2 2v8a2 2 0 0 1 2 2z',
  msgbubble: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  play: [<polygon key="p" points="5 3 19 12 5 21 5 3" fill="currentColor"/>],
  pause: [<line key="1" x1="6" y1="4" x2="6" y2="20"/>, <line key="2" x1="18" y1="4" x2="18" y2="20"/>],
  forward: 'M15 10l4 4-4 4M3 12h16M9 5a9 9 0 0 0-5 7.5',
  star: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  info: 'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zm0-7v-3m0-4h.01',
  expand: 'M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3',
  chevronR: 'M9 18l6-6-6-6',
  chevronL: 'M15 18l-6-6 6-6',
  crown: 'M3 18h18v2H3v-2zM5 16L3 7l4.5 3.5L12 3l4.5 7.5L21 7l-2 9H5z',
  pin: 'M12 22V12M9 4h6l1 5H8L9 4zm3 0V2',
  bellOff: 'M13.73 21a2 2 0 0 1-3.46 0M18.63 13A17.89 17.89 0 0 1 18 8M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14M18 8a6 6 0 0 0-9.33-5M1 1l22 22',
};

const QUICK_EMOJIS = ['👍','❤️','😂','😮','😢','😡','🎉','🔥','👏','🙏','💯','✅'];
const MUTE_OPTS = [
  { label: '8 hours',  ms: 8 * 60 * 60 * 1000 },
  { label: '1 week',   ms: 7 * 24 * 60 * 60 * 1000 },
  { label: 'Always',   ms: null },
];

const ALL_EMOJIS = [
  '😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩',
  '😘','😗','☺️','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔',
  '🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷',
  '🤒','🤕','🤢','🤮','🤧','🥵','🥶','🥴','😵','💫','🤯','🤠','🥳','🥸','😎','🤓',
  '🧐','😕','😟','🙁','☹️','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢',
  '😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀',
  '👋','🤚','🖐️','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆',
  '🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','🤲','🤝','🙏','✍️','💅',
  '🤳','💪','🦾','🦿','🦵','🦶','👂','🦻','👃','👀','🫦','👅','👄','🦷','🫀','🫁',
  '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','❤️‍🩹','💕','💞','💓',
  '💗','💖','💘','💝','💟','☮️','✝️','🎊','🎉','🎈','🎁','🎀','🎗️','🎟️','🏆','🥇',
  '🌟','⭐','✨','💫','🔥','💥','❄️','🌈','☀️','🌙','🌊','🍀','🌸','🌺','🌻','🌹',
];

const REPORT_REASONS = ['Spam or misleading','Harassment or bullying','Inappropriate content','Cheating or plagiarism','Impersonation','Other'];

/* ── Helpers ── */
const fmt = (d) => {
  if (!d) return '';
  const date = new Date(d);
  const now = new Date();
  const diff = now - date;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  const today = now.toDateString();
  if (date.toDateString() === today) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const fmtTime = (d) => d ? new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

const fmtLastSeen = (d) => {
  if (!d) return '';
  const date = new Date(d);
  const diff = Date.now() - date;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `today at ${fmtTime(d)}`;
  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${fmtTime(d)}`;
};

const formatBytes = (b) => {
  if (!b) return '';
  if (b < 1024) return `${b}B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)}KB`;
  return `${(b / 1048576).toFixed(1)}MB`;
};

const isSameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();

const fmtDateSep = (d) => {
  if (!d) return '';
  const date = new Date(d);
  const now = new Date();
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === now.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  const diff = now - date;
  if (diff < 7 * 86400000) return date.toLocaleDateString([], { weekday: 'long' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: diff > 365 * 86400000 ? 'numeric' : undefined });
};

const Avatar = ({ user, size = 42, className = '' }) => {
  const styles = {
    width: size, height: size, borderRadius: '50%', objectFit: 'cover',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 800, fontSize: Math.floor(size * 0.38), color: '#fff',
    background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', flexShrink: 0,
  };
  if (user?.avatar) return <img src={user.avatar} alt={user.name} style={{ ...styles, objectFit: 'cover' }} className={className} />;
  return <div style={styles} className={className}>{(user?.name || '?')[0].toUpperCase()}</div>;
};

const RoleBadge = ({ role }) => (
  <span className={`cls-role-badge ${role}`}>{role}</span>
);

/* ── Voice waveform bars (visual only) ── */
const Waveform = ({ count = 20 }) => {
  const bars = Array.from({ length: count }, (_, i) => {
    const h = 6 + Math.abs(Math.sin(i * 0.7)) * 18;
    return <div key={i} className="cls-voice-bar" style={{ height: h }} />;
  });
  return <div className="cls-voice-waveform">{bars}</div>;
};

/* ── Status ticks ── */
const Ticks = ({ status }) => {
  const white = 'rgba(255,255,255,0.85)';
  const seen  = '#7dd3fc'; // sky-blue — visible on purple bubble
  if (status === 'seen') return (
    <svg className="cls-msg-ticks" width="18" height="12" viewBox="0 0 18 12" fill="none" aria-label="Seen">
      <path d="M1 6L4.5 10L11 2"  stroke={seen} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M6 6L9.5 10L16 2" stroke={seen} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
  if (status === 'delivered') return (
    <svg className="cls-msg-ticks" width="18" height="12" viewBox="0 0 18 12" fill="none" aria-label="Delivered">
      <path d="M1 6L4.5 10L11 2"  stroke={white} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M6 6L9.5 10L16 2" stroke={white} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
  return (
    <svg className="cls-msg-ticks" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-label="Sent">
      <path d="M1 6L4.5 10L11 2" stroke={white} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
};

/* ── Main Component ── */
export default function Classroom() {
  const { user } = useAuth();
  const token = localStorage.getItem('token');

  // ── Core state ──
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [msgsByConv, setMsgsByConv] = useState({});
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [tab, setTab] = useState('chats');
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [typingUsers, setTypingUsers] = useState({});
  const [unreadCounts, setUnreadCounts] = useState({});
  const [sidebarHidden, setSidebarHidden] = useState(false);

  // ── Input state ──
  const [inputText, setInputText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [editingMsg, setEditingMsg] = useState(null);
  const [attachFiles, setAttachFiles] = useState([]);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const settingsBtnRef = useRef(null);

  // ── WhatsApp-style features ──
  const [lightbox, setLightbox] = useState(null);        // { url, senderName, time, msg }
  const [lightboxBarsVisible, setLightboxBarsVisible] = useState(true);
  const [imgMenu, setImgMenu] = useState(null);          // 'msgId-attIdx' key
  const [photoList, setPhotoList] = useState(null);      // { images[], msg }
  const [unfriendConfirm, setUnfriendConfirm] = useState(null); // friend._id pending confirm
  const [forwardMsg, setForwardMsg] = useState(null);    // msg object
  const [bottomSheet, setBottomSheet] = useState(null);  // msg object (long-press)
  const [muteModal, setMuteModal]             = useState(null);  // convId | null
  const [sendingFriendTo, setSendingFriendTo] = useState(null);  // userId | null
  const [blockConfirm, setBlockConfirm]       = useState(null);  // { userId, name } | null
  const [myBlocks, setMyBlocks]               = useState(new Set()); // Set of blocked userIds
  const [viewProfile, setViewProfile] = useState(null);  // public user object
  const [profileLoading, setProfileLoading] = useState(false);
  const [swipingId, setSwipingId] = useState(null);
  const [swipeOffsetX, setSwipeOffsetX] = useState(0);
  const swipeStartX = useRef(0);
  const swipeMsgRef = useRef(null);
  const swipeTriggeredRef = useRef(false);
  const longPressTimer = useRef(null);
  const convLongPressTimer = useRef(null);

  // ── Recording ──
  const [isRecording, setIsRecording] = useState(false);
  const [recTime, setRecTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recIntervalRef = useRef(null);

  // ── Playback ──
  const [playingVoice, setPlayingVoice] = useState(null);

  // ── Modals ──
  const [modal, setModal] = useState(null); // 'newGroup' | 'invite' | 'report' | 'groupInfo'
  const [modalData, setModalData] = useState({});

  // ── Add Member ──
  const [addMemberQuery, setAddMemberQuery]     = useState('');
  const [addMemberResults, setAddMemberResults] = useState([]);
  const [addMemberSearching, setAddMemberSearching] = useState(false);
  const [addingMemberId, setAddingMemberId]     = useState(null);
  const [showAddMember, setShowAddMember]       = useState(false);

  // ── Clear chat ──
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // ── Message search ──
  const [showMsgSearch, setShowMsgSearch]       = useState(false);
  const [msgSearchQ, setMsgSearchQ]             = useState('');
  const [msgSearchMatches, setMsgSearchMatches] = useState([]);
  const [msgSearchIdx, setMsgSearchIdx]         = useState(0);

  // ── Media panel ──
  const [showMedia, setShowMedia] = useState(false);
  const [mediaPanelTab, setMediaPanelTab] = useState('media');

  // ── Toast notifications ──
  const [toasts, setToasts] = useState([]);
  /* ── Download image without opening a new tab ── */
  const downloadImage = useCallback(async (url) => {
    try {
      const resp = await fetch(url);
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = url.split('/').pop().split('?')[0] || 'image.jpg';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch {
      window.open(url, '_blank');
    }
  }, []);

  const toast = useCallback((message, type = 'error') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  // ── Chat list selection (long-press to delete) ──
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedConvIds, setSelectedConvIds] = useState(new Set());

  // ── Group editing ──
  const [editingGroupName, setEditingGroupName]       = useState(false);
  const [groupNameInput, setGroupNameInput]           = useState('');
  const [groupAvatarUploading, setGroupAvatarUploading] = useState(false);
  const groupAvatarInputRef = useRef(null);
  const [showAvatarViewer, setShowAvatarViewer]       = useState(false);
  const [showAvatarOptions, setShowAvatarOptions]     = useState(false);
  const [cropSrc, setCropSrc]                         = useState(null);
  const [crop, setCrop]                               = useState({ x: 0, y: 0 });
  const [cropZoom, setCropZoom]                       = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels]     = useState(null);

  // ── Pagination ──
  const [loadingMore, setLoadingMore] = useState(false);
  const pagesRef = useRef({});          // convId -> current page loaded
  const hasMoreRef = useRef({});        // convId -> boolean
  const loadingMoreRef = useRef(false); // synchronous guard — prevents race condition

  // ── Refs ──
  const messagesEndRef = useRef(null);
  const messagesAreaRef = useRef(null);
  const photoListScrollRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const socketRef = useRef(null);
  const typingTimerRef = useRef(null);
  const searchTimerRef = useRef(null);

  const activeConv = conversations.find(c => c._id === activeConvId);
  const messages = msgsByConv[activeConvId] || [];

  /* ── Socket setup ── */
  useEffect(() => {
    if (!token) return;
    const sock = getClassroomSocket(token);
    socketRef.current = sock;

    sock.on('connect', () => {
      const convIds = conversations.map(c => c._id);
      if (convIds.length) sock.emit('join:conversations', convIds);
    });

    sock.on('msg:new', ({ message, conversationId }) => {
      setMsgsByConv(prev => ({
        ...prev,
        [conversationId]: [...(prev[conversationId] || []), message],
      }));
      setConversations(prev => prev.map(c =>
        c._id === conversationId ? { ...c, lastMessage: message, lastActivity: message.createdAt } : c
      ).sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity)));
      if (conversationId !== activeConvId) {
        setUnreadCounts(prev => ({ ...prev, [conversationId]: (prev[conversationId] || 0) + 1 }));
        // Tell the sender this message was delivered (we received it but aren't viewing it)
        if (message.sender?._id !== user?.id) {
          sock.emit('msg:delivered', { messageId: message._id, conversationId });
        }
      } else {
        sock.emit('msgs:seen', { conversationId });
      }
      if (message.mentions?.includes(user?.id)) {
        document.title = '🔔 Classroom';
        setTimeout(() => { document.title = 'Classroom'; }, 3000);
      }
    });

    sock.on('mention:new', ({ from }) => {
      toast(`${from} mentioned you`);
      document.title = '🔔 Classroom';
      setTimeout(() => { document.title = 'Classroom'; }, 3000);
    });

    sock.on('msg:edit', ({ message, conversationId }) => {
      setMsgsByConv(prev => ({
        ...prev,
        [conversationId]: (prev[conversationId] || []).map(m => m._id === message._id ? message : m),
      }));
    });

    sock.on('msg:delete', ({ messageId, conversationId }) => {
      setMsgsByConv(prev => ({
        ...prev,
        [conversationId]: (prev[conversationId] || []).map(m =>
          m._id === messageId ? { ...m, deletedForEveryone: true, text: '', attachments: [] } : m
        ),
      }));
    });

    sock.on('msg:react', ({ messageId, reactions, conversationId }) => {
      setMsgsByConv(prev => ({
        ...prev,
        [conversationId]: (prev[conversationId] || []).map(m =>
          m._id === messageId ? { ...m, reactions } : m
        ),
      }));
    });

    sock.on('msg:delivered', ({ messageId, conversationId }) => {
      setMsgsByConv(prev => ({
        ...prev,
        [conversationId]: (prev[conversationId] || []).map(m =>
          m._id === messageId ? { ...m, status: 'delivered' } : m
        ),
      }));
    });

    sock.on('msg:seen', ({ messageId, conversationId }) => {
      setMsgsByConv(prev => ({
        ...prev,
        [conversationId]: (prev[conversationId] || []).map(m =>
          m._id === messageId ? { ...m, status: 'seen' } : m
        ),
      }));
    });

    // Recipient came online / opened app — mark our sent messages as delivered
    sock.on('msgs:delivered', ({ userId, conversationId }) => {
      // Ignore if we triggered it ourselves (we delivered THEIR messages, not them delivering ours)
      if (userId === user?.id) return;
      setMsgsByConv(prev => ({
        ...prev,
        [conversationId]: (prev[conversationId] || []).map(m =>
          m.sender?._id !== user?.id ? m : { ...m, status: m.status === 'seen' ? 'seen' : 'delivered' }
        ),
      }));
    });

    sock.on('msgs:seen', ({ userId, conversationId }) => {
      // Ignore if we triggered it ourselves — only update tick colour when the OTHER person saw our messages
      if (userId === user?.id) return;
      setMsgsByConv(prev => ({
        ...prev,
        [conversationId]: (prev[conversationId] || []).map(m =>
          m.sender?._id !== user?.id ? m : { ...m, status: 'seen' }
        ),
      }));
    });

    sock.on('typing:start', ({ userId, conversationId }) => {
      setTypingUsers(prev => ({
        ...prev,
        [conversationId]: [...new Set([...(prev[conversationId] || []), userId])],
      }));
    });

    sock.on('typing:stop', ({ userId, conversationId }) => {
      setTypingUsers(prev => ({
        ...prev,
        [conversationId]: (prev[conversationId] || []).filter(id => id !== userId),
      }));
    });

    sock.on('user:online', ({ userId }) => {
      setOnlineUsers(prev => new Set([...prev, userId]));
    });

    sock.on('user:offline', ({ userId }) => {
      setOnlineUsers(prev => { const s = new Set(prev); s.delete(userId); return s; });
    });

    sock.on('friend-request:new', ({ request, from }) => {
      setFriendRequests(prev => [{ ...request, from }, ...prev]);
    });

    sock.on('friend-request:accepted', ({ conversationId, by }) => {
      loadConversations();
      loadFriends();
    });

    sock.on('friend:removed', ({ by }) => {
      // Remove from friends list so UI updates for both parties immediately
      setFriends(prev => prev.filter(f => f._id !== by));
    });

    sock.on('conv:updated', (data) => {
      setConversations(prev => prev.map(c => c._id === data.conversationId ? { ...c, ...data } : c));
    });

    sock.on('group:added', ({ conversation, addedBy }) => {
      setConversations(prev => {
        if (prev.find(c => c._id === conversation._id)) return prev;
        return [conversation, ...prev];
      });
      sock.emit('join:conversation', conversation._id);
    });

    // Someone sent us a group invite via DM (non-friend flow)
    sock.on('group:invite', ({ dm }) => {
      if (!dm) return;
      setConversations(prev => {
        if (prev.find(c => c._id === dm._id)) return prev;
        return [dm, ...prev];
      });
      sock.emit('join:conversation', dm._id);
    });

    return () => { sock.off(); };
  }, [token, activeConvId]);

  useEffect(() => {
    if (socketRef.current && conversations.length) {
      const ids = conversations.map(c => c._id);
      socketRef.current.emit('join:conversations', ids);
      // Mark all received-but-undelivered messages as delivered (handles offline period)
      socketRef.current.emit('msgs:delivered', { conversationIds: ids });
    }
  }, [conversations.length]);

  /* ── Initial load ── */
  useEffect(() => {
    loadConversations();
    loadFriends();
    loadMyBlocks();
    loadFriendRequests();
    loadSentRequests();
    loadOnlineUsers();
  }, []);

  /* ── Mark classroom page active (prevents body scroll / overlay) ── */
  useEffect(() => {
    window.scrollTo(0, 0);
    document.body.classList.add('cls-page-active');
    return () => document.body.classList.remove('cls-page-active');
  }, []);


  /* ── Hide bottom bar when chat is open ── */
  useEffect(() => {
    if (activeConvId) {
      document.body.classList.add('cls-chat-active');
    } else {
      document.body.classList.remove('cls-chat-active');
    }
    return () => document.body.classList.remove('cls-chat-active');
  }, [activeConvId]);

  /* ── Scroll photo list to tapped image on open ── */
  useEffect(() => {
    if (!photoList || photoList.scrollToIndex == null) return;
    const idx = photoList.scrollToIndex;
    const el = photoListScrollRef.current?.querySelector(`[data-index="${idx}"]`);
    if (el) el.scrollIntoView({ block: 'start', behavior: 'instant' });
  }, [photoList]);

  /* ── Escape key: close lightbox / avatar viewer / bottom sheet ── */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (imgMenu) { setImgMenu(null); return; }
      if (showMedia) { setShowMedia(false); return; }
      if (showMsgSearch) { setShowMsgSearch(false); setMsgSearchQ(''); setMsgSearchMatches([]); return; }
      if (lightbox) { if (lightbox.fromPhotoList) setPhotoList(lightbox.fromPhotoList); setLightbox(null); setLightboxBarsVisible(true); return; }
      if (photoList) { setPhotoList(null); return; }
      if (showAvatarViewer) { setShowAvatarViewer(false); setShowAvatarOptions(false); return; }
      if (muteModal) { setMuteModal(null); return; }
      if (bottomSheet) { setBottomSheet(null); return; }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [imgMenu, showMedia, showMsgSearch, photoList, lightbox, showAvatarViewer, muteModal, bottomSheet]);

  /* ── Auto-scroll: only on new incoming/sent messages, not on older-page loads ── */
  const prevMsgCountRef = useRef(0);
  useEffect(() => {
    const msgs = msgsByConv[activeConvId] || [];
    const prev = prevMsgCountRef.current;
    const isLoadingOlder = msgs.length > prev && (pagesRef.current[activeConvId] || 1) > 1 && loadingMore === false && msgs[0]?._id !== (msgsByConv[activeConvId]?.[0]?._id);
    // Scroll to bottom only when a new message arrives at the end (not prepended older msgs)
    if (msgs.length > 0 && !loadingMore) {
      const area = messagesAreaRef.current;
      if (area) {
        const distFromBottom = area.scrollHeight - area.scrollTop - area.clientHeight;
        // Auto-scroll if user is near bottom (within 200px) or it's a fresh load
        if (distFromBottom < 200 || prev === 0) {
          messagesEndRef.current?.scrollIntoView({ behavior: prev === 0 ? 'instant' : 'smooth' });
        }
      }
    }
    prevMsgCountRef.current = msgs.length;
  }, [msgsByConv[activeConvId]?.length, activeConvId]);

  /* ── Mark seen + load first page when switching conversations ── */
  useEffect(() => {
    if (!activeConvId || !socketRef.current) return;
    socketRef.current.emit('join:conversation', activeConvId);
    socketRef.current.emit('msgs:seen', { conversationId: activeConvId });
    setUnreadCounts(prev => ({ ...prev, [activeConvId]: 0 }));
    // Reset pagination state for the new conversation
    pagesRef.current[activeConvId] = 1;
    hasMoreRef.current[activeConvId] = true;
    prevMsgCountRef.current = 0;
    loadingMoreRef.current = false; // release any stale guard from prev conversation
    loadMessages(activeConvId, 1);
  }, [activeConvId]);

  /* ── Scroll handler: load older messages when near top ── */
  const handleMessagesScroll = () => {
    const area = messagesAreaRef.current;
    // Use the synchronous ref so rapid scroll events don't beat state updates
    if (!area || loadingMoreRef.current || hasMoreRef.current[activeConvId] === false) return;
    if (area.scrollTop < 80) loadMoreMessages();
  };

  /* ── Auto-resize textarea ── */
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    // Defer via rAF so the height change never happens inside the same
    // event loop tick as user input — prevents the brief collapse from
    // triggering a blur on Android (which closes the keyboard).
    requestAnimationFrame(() => {
      if (!ta) return;
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
    });
  }, [inputText]);

  /* ── API calls ── */
  const api = useCallback(async (path, opts = {}) => {
    const res = await fetch(`${API_URL}/api/classroom${path}`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...opts.headers },
      ...opts,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Request failed');
    }
    return res.json();
  }, [token]);

  const loadConversations = async () => {
    try { setConversations(await api('/conversations')); } catch {}
  };

  const PAGE_LIMIT = 40;

  const loadMessages = async (convId, page = 1) => {
    // Synchronous guard — blocks concurrent loads even before React re-renders
    if (loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const msgs = await api(`/conversations/${convId}/messages?page=${page}`);
      // hasMore: if we got a full page, there may be older messages
      hasMoreRef.current[convId] = msgs.length >= PAGE_LIMIT;
      pagesRef.current[convId] = page;

      if (page === 1) {
        setMsgsByConv(prev => ({ ...prev, [convId]: msgs }));
      } else {
        // Preserve scroll position when prepending older messages
        const area = messagesAreaRef.current;
        const prevHeight = area ? area.scrollHeight : 0;
        setMsgsByConv(prev => ({ ...prev, [convId]: [...msgs, ...(prev[convId] || [])] }));
        // Restore scroll position after React re-renders the prepended messages
        requestAnimationFrame(() => {
          if (area) area.scrollTop = area.scrollHeight - prevHeight;
        });
      }
    } catch {}
    finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  };

  const loadMoreMessages = () => {
    if (!activeConvId || loadingMoreRef.current || hasMoreRef.current[activeConvId] === false) return;
    const nextPage = (pagesRef.current[activeConvId] || 1) + 1;
    loadMessages(activeConvId, nextPage);
  };

  const loadFriends = async () => {
    try { setFriends(await api('/friends')); } catch {}
  };

  const loadMyBlocks = async () => {
    try {
      const blocks = await api('/blocks');
      setMyBlocks(new Set((blocks || []).map(b => String(b.blocked?._id || b.blocked))));
    } catch {}
  };

  const unblockUser = async (userId) => {
    try {
      await api(`/block/${userId}`, { method: 'DELETE' });
      setMyBlocks(prev => { const s = new Set(prev); s.delete(String(userId)); return s; });
      toast('User unblocked', 'success');
    } catch (e) { toast(e.message); }
  };

  const unfriend = async (userId) => {
    try {
      const friendName = friends.find(f => f._id === userId)?.name || 'User';
      await api(`/friends/${userId}`, { method: 'DELETE' });
      setFriends(prev => prev.filter(f => f._id !== userId));
      setUnfriendConfirm(null);
      toast(`${friendName} removed from friends`, 'success');
    } catch (err) { toast(err.message); }
  };

  /* ── Message search ── */
  useEffect(() => {
    const q = msgSearchQ.trim().toLowerCase();
    if (!q || !activeConvId) { setMsgSearchMatches([]); setMsgSearchIdx(0); return; }
    const msgs = msgsByConv[activeConvId] || [];
    const matches = msgs.filter(m => m.text?.toLowerCase().includes(q)).map(m => m._id);
    setMsgSearchMatches(matches);
    setMsgSearchIdx(0);
    if (matches.length > 0) {
      setTimeout(() => {
        const el = document.getElementById(`msg-${matches[0]}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
    }
  }, [msgSearchQ, activeConvId]); // eslint-disable-line

  const navigateMsgSearch = (dir) => {
    if (!msgSearchMatches.length) return;
    const next = (msgSearchIdx + dir + msgSearchMatches.length) % msgSearchMatches.length;
    setMsgSearchIdx(next);
    const el = document.getElementById(`msg-${msgSearchMatches[next]}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const loadFriendRequests = async () => {
    try { setFriendRequests(await api('/friends/requests')); } catch {}
  };

  const loadSentRequests = async () => {
    try { setSentRequests(await api('/friends/sent')); } catch {}
  };

  const loadOnlineUsers = async () => {
    try {
      const list = await api('/online');
      setOnlineUsers(new Set(list));
    } catch {}
  };

  /* ── Search ── */
  useEffect(() => {
    clearTimeout(searchTimerRef.current);
    if (!searchQ.trim()) { setSearchResults([]); return; }
    searchTimerRef.current = setTimeout(async () => {
      try { setSearchResults(await api(`/users/search?q=${encodeURIComponent(searchQ)}`)); }
      catch { setSearchResults([]); }
    }, 300);
  }, [searchQ]);

  /* ── Typing emit ── */
  const handleTyping = () => {
    if (!activeConvId || !socketRef.current) return;
    socketRef.current.emit('typing:start', { conversationId: activeConvId });
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      socketRef.current?.emit('typing:stop', { conversationId: activeConvId });
    }, 2000);
  };

  /* ── Open direct DM ── */
  const fetchProfile = async (userObj) => {
    if (!userObj?._id) return;
    setViewProfile({ ...userObj });   // show immediately with partial data
    setProfileLoading(true);
    try {
      const data = await api(`/users/${userObj._id}/public`);
      setViewProfile(data);
    } catch (_) {
      // keep partial data already shown
    } finally {
      setProfileLoading(false);
    }
  };

  const openDM = async (userId, knownConvId = null) => {
    // If the friendship already has a conversationId, navigate instantly without API call
    if (knownConvId) {
      const convIdStr = String(knownConvId);
      const existing = conversations.find(c => String(c._id) === convIdStr);
      if (existing) {
        setActiveConvId(existing._id);
        setTab('chats');
        setSearchQ('');
        setShowSearch(false);
        setSidebarHidden(true);
        return;
      }
    }
    try {
      const conv = await api('/conversations/direct', {
        method: 'POST',
        body: JSON.stringify({ userId }),
      });
      setConversations(prev => {
        const exists = prev.find(c => String(c._id) === String(conv._id));
        return exists ? prev : [conv, ...prev];
      });
      setActiveConvId(conv._id);
      setTab('chats');
      setSearchQ('');
      setShowSearch(false);
      setSidebarHidden(true);
    } catch (e) {
      if (e.message.includes('friend')) {
        sendFriendRequest(userId);
      } else {
        toast(e.message);
      }
    }
  };

  /* ── Mute / Pin helpers ── */
  const isMuted = useCallback((conv) => {
    if (!conv?.mutedBy?.length) return false;
    const uid = String(user?.id || user?._id);
    const entry = conv.mutedBy.find(m => String(m.user?._id || m.user) === uid);
    if (!entry) return false;
    if (!entry.until) return true;
    return new Date(entry.until) > new Date();
  }, [user]);

  const muteConv = async (convId, durationMs) => {
    try {
      const data = await api(`/conversations/${convId}/mute`, { method: 'PATCH', body: JSON.stringify({ duration: durationMs }) });
      const uid = String(user?.id || user?._id);
      setConversations(prev => prev.map(c => c._id === convId ? {
        ...c,
        mutedBy: [...(c.mutedBy || []).filter(m => String(m.user?._id || m.user) !== uid), { user: uid, until: data.until || null }],
      } : c));
    } catch (e) { toast(e.message); }
  };

  const unmuteConv = async (convId) => {
    try {
      await api(`/conversations/${convId}/unmute`, { method: 'PATCH', body: '{}' });
      const uid = String(user?.id || user?._id);
      setConversations(prev => prev.map(c => c._id === convId ? {
        ...c,
        mutedBy: (c.mutedBy || []).filter(m => String(m.user?._id || m.user) !== uid),
      } : c));
    } catch (e) { toast(e.message); }
  };

  const pinMessage = async (msgId) => {
    try {
      const data = await api(`/conversations/${activeConvId}/pin`, { method: 'PATCH', body: JSON.stringify({ messageId: msgId }) });
      setConversations(prev => prev.map(c => c._id === activeConvId ? { ...c, pinnedMessage: data.pinnedMessage } : c));
    } catch (e) { toast(e.message); }
  };

  const unpinMessage = async () => {
    try {
      await api(`/conversations/${activeConvId}/pin`, { method: 'PATCH', body: JSON.stringify({ messageId: null }) });
      setConversations(prev => prev.map(c => c._id === activeConvId ? { ...c, pinnedMessage: null, pinnedBy: null } : c));
    } catch (e) { toast(e.message); }
  };

  /* ── Friend request ── */
  const sendFriendRequest = async (toUserId) => {
    if (sendingFriendTo === toUserId) return;
    setSendingFriendTo(toUserId);
    try {
      const fr = await api('/friends/request', { method: 'POST', body: JSON.stringify({ toUserId }) });
      const knownUser = searchResults.find(u => u._id === toUserId)
        || friends.find(f => f._id === toUserId)
        || { _id: toUserId };
      setSentRequests(prev => {
        const alreadyIn = prev.some(r => String(r.to?._id || r.to) === String(toUserId));
        return alreadyIn ? prev : [...prev, { _id: fr?._id, to: knownUser }];
      });
      toast('Friend request sent!', 'success');
    } catch (e) {
      const msg = e.message?.toLowerCase() || '';
      if (msg.includes('already friends')) {
        toast('You are already friends', 'success');
      } else if (msg.includes('already sent') || msg.includes('already')) {
        // Update sentRequests so the UI shows "Pending" correctly
        const knownUser = searchResults.find(u => u._id === toUserId)
          || friends.find(f => f._id === toUserId)
          || { _id: toUserId };
        setSentRequests(prev => {
          const alreadyIn = prev.some(r => String(r.to?._id || r.to) === String(toUserId));
          return alreadyIn ? prev : [...prev, { to: knownUser }];
        });
        toast('Friend request already sent — waiting for their reply', 'success');
      } else {
        toast(e.message);
      }
    } finally {
      setSendingFriendTo(null);
    }
  };

  const acceptRequest = async (reqId) => {
    try {
      const { conversationId } = await api(`/friends/request/${reqId}/accept`, { method: 'PUT', body: '{}' });
      setFriendRequests(prev => prev.filter(r => r._id !== reqId));
      loadFriends();
      loadConversations();
      if (conversationId) setActiveConvId(conversationId);
    } catch (e) { toast(e.message); }
  };

  const declineRequest = async (reqId) => {
    try {
      await api(`/friends/request/${reqId}/decline`, { method: 'PUT', body: '{}' });
      setFriendRequests(prev => prev.filter(r => r._id !== reqId));
    } catch {}
  };

  /* ── Send message ── */
  const sendMessage = async () => {
    if (!activeConvId) return;
    const text = inputText.trim();
    if (!text && attachFiles.length === 0 && !isRecording) return;

    const form = new FormData();
    form.append('text', text);
    if (replyTo) form.append('replyTo', replyTo._id);
    const mentions = [...text.matchAll(/@\w+/g)].map(m => m[0]);
    if (mentions.length) form.append('mentions', JSON.stringify(mentions));
    attachFiles.forEach(f => form.append('files', f.file || f));

    try {
      const msg = await fetch(`${API_URL}/api/classroom/conversations/${activeConvId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      }).then(r => r.json());

      setInputText('');
      setReplyTo(null);
      setEditingMsg(null);
      setAttachFiles([]);
      // Textarea height is reset by the auto-resize useEffect (runs via rAF).
      // Keep focus on the textarea so the mobile keyboard stays open.
      textareaRef.current?.focus();
    } catch (e) { toast(e.message); }
  };

  /* ── Edit message ── */
  const saveEdit = async () => {
    if (!editingMsg || !activeConvId) return;
    try {
      await api(`/conversations/${activeConvId}/messages/${editingMsg._id}`, {
        method: 'PUT',
        body: JSON.stringify({ text: inputText }),
      });
      setEditingMsg(null);
      setInputText('');
      textareaRef.current?.focus();
    } catch (e) { toast(e.message); }
  };

  /* ── Delete message ── */
  const deleteMessage = async (msgId) => {
    try {
      await api(`/conversations/${activeConvId}/messages/${msgId}`, { method: 'DELETE' });
    } catch (e) { toast(e.message); }
  };

  /* ── React ── */
  const reactToMessage = async (msgId, emoji) => {
    setShowReactionPicker(null);
    try {
      await api(`/conversations/${activeConvId}/messages/${msgId}/react`, {
        method: 'POST',
        body: JSON.stringify({ emoji }),
      });
    } catch {}
  };

  /* ── Block / Report ── */
  const forwardMessage = async (msg, targetConvId) => {
    try {
      const fd = new FormData();
      if (msg.text) fd.append('text', msg.text);
      fd.append('conversationId', targetConvId);
      await fetch(`${API_URL}/api/classroom/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
    } catch (e) { console.error(e); }
    setForwardMsg(null);
  };

  const blockUser = async (userId) => {
    try {
      await api(`/block/${userId}`, { method: 'POST', body: '{}' });
      setMyBlocks(prev => new Set([...prev, String(userId)]));
      setBlockConfirm(null);
      toast('User blocked', 'success');
    } catch (e) { toast(e.message); }
  };

  const reportUser = async (userId, reason, details, messageId, messageContent) => {
    try {
      await api('/report', { method: 'POST', body: JSON.stringify({ reportedId: userId, reason, details, messageId, messageContent }) });
      toast('Report submitted. Thank you.', 'success');
      setModal(null);
    } catch (e) { toast(e.message); }
  };

  /* ── Create group ── */
  const createGroup = async (name, participantIds, inviteUsers = []) => {
    try {
      const conv = await api('/conversations/group', {
        method: 'POST',
        body: JSON.stringify({ name, participantIds }),
      });
      setConversations(prev => [conv, ...prev]);
      setActiveConvId(conv._id);
      setModal(null);
      setSidebarHidden(true);
      for (const user of inviteUsers) {
        try {
          await api(`/conversations/${conv._id}/invite-user`, {
            method: 'POST',
            body: JSON.stringify({ userId: user._id }),
          });
        } catch {}
      }
      if (inviteUsers.length > 0) {
        toast(`Group created! Invites sent to ${inviteUsers.length} person${inviteUsers.length !== 1 ? 's' : ''}.`, 'success');
      }
    } catch (e) { toast(e.message); }
  };

  /* ── Add Member: search all users ── */
  const searchAddMember = async (q) => {
    if (!q.trim()) { setAddMemberResults([]); return; }
    setAddMemberSearching(true);
    try {
      const results = await api(`/users/search?q=${encodeURIComponent(q)}`);
      setAddMemberResults(results);
    } catch {} finally { setAddMemberSearching(false); }
  };

  /* ── Add Member: directly add (they are a friend/staff) ── */
  const addMemberToGroup = async (userId, groupId) => {
    setAddingMemberId(userId);
    try {
      const updated = await api(`/conversations/${groupId}/members`, {
        method: 'POST',
        body: JSON.stringify({ userId }),
      });
      // Update local conversation so the member list refreshes in the modal
      setConversations(prev => prev.map(c => c._id === updated._id ? { ...c, participants: updated.participants } : c));
      setAddMemberResults(prev => prev.filter(u => u._id !== userId));
    } catch (e) { toast(e.message); }
    finally { setAddingMemberId(null); }
  };

  /* ── Add Member: send a group invite to any user (bypasses friendship requirement) ── */
  const sendGroupInvite = async (targetUser, group) => {
    setAddingMemberId(targetUser._id);
    try {
      await api(`/conversations/${group._id}/invite-user`, {
        method: 'POST',
        body: JSON.stringify({ userId: targetUser._id }),
      });
      toast(`Invite sent to ${targetUser.name}!`, 'success');
    } catch (e) { toast(e.message); }
    finally { setAddingMemberId(null); }
  };

  /* ── Join via invite code ── */
  const joinViaCode = async (code) => {
    try {
      const conv = await api('/conversations/join', {
        method: 'POST',
        body: JSON.stringify({ inviteCode: code }),
      });
      setConversations(prev => { const ex = prev.find(c => c._id === conv._id); return ex ? prev : [conv, ...prev]; });
      setActiveConvId(conv._id);
      setModal(null);
      setSidebarHidden(true);
    } catch (e) { toast(e.message); }
  };

  /* ── Voice recording ── */
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size) audioChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
        stream.getTracks().forEach(t => t.stop());
        if (!activeConvId) return;
        const form = new FormData();
        form.append('text', '');
        form.append('files', file);
        await fetch(`${API_URL}/api/classroom/conversations/${activeConvId}/messages`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        });
      };
      mr.start();
      setIsRecording(true);
      setRecTime(0);
      recIntervalRef.current = setInterval(() => setRecTime(t => t + 1), 1000);
    } catch { toast('Microphone access denied', 'error'); }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    clearInterval(recIntervalRef.current);
    setRecTime(0);
  };

  const fmtRec = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  /* ── File attach ── */
  const handleFiles = (files) => {
    const newFiles = Array.from(files).map(file => ({
      file,
      id: Math.random().toString(36).slice(2),
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
      name: file.name,
      size: file.size,
    }));
    setAttachFiles(prev => [...prev, ...newFiles]);
  };

  /* ── Update group name / avatar ── */
  const updateGroup = async ({ name, avatarFile, removeAvatar } = {}) => {
    if (!activeConvId) return;
    const form = new FormData();
    if (name) form.append('name', name);
    if (avatarFile) form.append('avatar', avatarFile);
    if (removeAvatar) form.append('removeAvatar', 'true');
    const res = await fetch(`${API_URL}/api/classroom/conversations/${activeConvId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || 'Update failed'); }
    const updated = await res.json();
    setConversations(prev => prev.map(c => c._id === updated._id ? { ...c, name: updated.name, avatar: updated.avatar } : c));
    return updated;
  };

  const handleGroupAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCropSrc(reader.result);
      setCrop({ x: 0, y: 0 });
      setCropZoom(1);
    };
    reader.readAsDataURL(file);
    if (e.target) e.target.value = '';
  };

  const handleCropConfirm = async () => {
    if (!cropSrc || !croppedAreaPixels) return;
    setGroupAvatarUploading(true);
    try {
      const blob = await getCroppedImg(cropSrc, croppedAreaPixels);
      const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
      await updateGroup({ avatarFile: file });
      setCropSrc(null);
      toast('Group photo updated!', 'success');
    } catch (err) { toast(err.message); }
    finally { setGroupAvatarUploading(false); }
  };

  const removeGroupAvatar = async () => {
    try {
      await updateGroup({ removeAvatar: true });
      toast('Group photo removed.', 'info');
    }
    catch (err) { toast(err.message); }
  };

  const clearChat = async () => {
    try {
      await api(`/conversations/${activeConvId}/messages`, { method: 'DELETE' });
      setMsgsByConv(prev => ({ ...prev, [activeConvId]: [] }));
      hasMoreRef.current[activeConvId] = false;
      // Fix: clear last-message preview in conversation list
      setConversations(prev => prev.map(c =>
        c._id === activeConvId ? { ...c, lastMessage: null } : c
      ));
      setShowClearConfirm(false);
    } catch (err) { toast(err.message); }
  };

  /* ── Chat list long-press selection & delete ── */
  const startConvLongPress = (convId) => () => {
    convLongPressTimer.current = setTimeout(() => {
      if (navigator.vibrate) navigator.vibrate(50);
      setSelectionMode(true);
      setSelectedConvIds(new Set([convId]));
    }, 500);
  };

  const cancelConvLongPress = () => clearTimeout(convLongPressTimer.current);

  const toggleConvSelection = (convId) => {
    setSelectedConvIds(prev => {
      const next = new Set(prev);
      if (next.has(convId)) next.delete(convId); else next.add(convId);
      return next;
    });
  };

  const cancelSelection = () => {
    setSelectionMode(false);
    setSelectedConvIds(new Set());
  };

  const deleteSelectedConvs = async () => {
    const ids = [...selectedConvIds];
    if (!ids.length) return;
    try {
      await Promise.all(ids.map(id =>
        fetch(`${API_URL}/api/classroom/conversations/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        })
      ));
      setConversations(prev => prev.filter(c => !ids.includes(c._id)));
      if (ids.includes(activeConvId)) {
        setActiveConvId(null);
        setSidebarHidden(false);
      }
      cancelSelection();
    } catch { toast('Failed to delete some chats. Please try again.', 'error'); }
  };

  const DISAPPEAR_OPTIONS = [
    { label: 'Off',    v: 0 },
    { label: '24h',   v: 86400000 },
    { label: '7 days', v: 604800000 },
  ];

  const fmtDisappear = (ms) => {
    if (!ms) return null;
    const h = Math.round(ms / 3600000);
    if (h >= 48) return `${Math.round(h / 24)}d`;
    return `${h}h`;
  };

  const setDisappear = async (ms) => {
    try {
      await api(`/conversations/${activeConvId}/disappear`, {
        method: 'PATCH',
        body: JSON.stringify({ disappearAfter: ms || 0 }),
      });
      setConversations(prev => prev.map(c => c._id === activeConvId ? { ...c, disappearAfter: ms || null } : c));
    } catch (err) { toast(err.message); }
  };

  const canEditGroup = !!activeConv && (
    user?.role === 'admin' ||
    (activeConv.createdBy?._id || activeConv.createdBy) === user?.id ||
    activeConv.admins?.some(a => (a._id || a) === user?.id)
  );

  const toggleMemberRole = async (userId) => {
    try {
      const data = await api(`/conversations/${activeConv._id}/members/${userId}/role`, { method: 'PATCH', body: '{}' });
      setConversations(prev => prev.map(c =>
        c._id === activeConv._id ? { ...c, admins: data.admins } : c
      ));
    } catch (e) { toast(e.message); }
  };

  const saveGroupName = async () => {
    const trimmed = groupNameInput.trim();
    if (!trimmed || trimmed === activeConv?.name) { setEditingGroupName(false); return; }
    try { await updateGroup({ name: trimmed }); }
    catch (err) { toast(err.message); }
    setEditingGroupName(false);
  };

  /* ── Conv header info ── */
  const getConvDisplay = (conv) => {
    if (!conv) return {};
    if (conv.type === 'group') return { name: conv.name, avatar: conv.avatar || null, isGroup: true };
    const other = conv.participants?.find(p => (p._id || p) !== user?.id);
    return { name: other?.name, avatar: other?.avatar, user: other, isGroup: false };
  };

  /* ── Typing display ── */
  const typingInConv = typingUsers[activeConvId] || [];
  const typingDisplay = (() => {
    if (!typingInConv.length) return null;
    const names = typingInConv.map(uid => {
      const p = activeConv?.participants?.find(p => p._id === uid);
      return p?.name?.split(' ')[0] || 'Someone';
    });
    return names.length === 1 ? `${names[0]} is typing...` : `${names.join(', ')} are typing...`;
  })();

  /* ── Close overlays on outside click ── */
  useEffect(() => {
    const handler = () => { setShowEmoji(false); setContextMenu(null); setShowReactionPicker(null); setShowSettings(false); setBottomSheet(null); };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  const convDisplay = getConvDisplay(activeConv);
  const otherUser = convDisplay.user;
  const isOnline = otherUser && onlineUsers.has(otherUser._id);

  // Student↔Student DMs require active friendship to send messages
  const isFriendBlocked = Boolean(
    activeConv?.type === 'direct' &&
    user?.role === 'student' &&
    otherUser?.role === 'student' &&
    !friends.some(f => f._id === otherUser._id)
  );

  /* ═══════════════════════════════════════
     RENDER
  ═══════════════════════════════════════ */
  return (
    <div className="cls-root" onClick={() => setContextMenu(null)}>

      {/* ══════════ SIDEBAR ══════════ */}
      <div className={`cls-sidebar ${sidebarHidden ? 'hidden' : ''}`}>
        {/* Header */}
        <div className="cls-sidebar-header">
          <div className="cls-sidebar-title">
            <Ic d={ICONS.msgbubble} size={20} fill="white" stroke="none" />
            Classroom
            <span className="cls-badge">BETA</span>
          </div>
          <div className="cls-header-actions">
            <button className="cls-icon-btn" title="New group" onClick={(e) => { e.stopPropagation(); setModal('newGroup'); setModalData({}); }}>
              <Ic d={ICONS.group} size={16} />
            </button>
            <button className="cls-icon-btn" title="Join via invite" onClick={(e) => { e.stopPropagation(); setModal('joinGroup'); setModalData({}); }}>
              <Ic d={ICONS.link} size={16} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="cls-search-wrap" style={{ position: 'relative' }}>
          <Ic d={ICONS.search} size={15} style={{ position: 'absolute', left: 24, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none', zIndex: 1 }} />
          <input
            className="cls-search-input"
            placeholder="Search people..."
            value={searchQ}
            onChange={e => { setSearchQ(e.target.value); setShowSearch(true); }}
            onFocus={() => setShowSearch(true)}
            onBlur={() => setTimeout(() => setShowSearch(false), 200)}
          />
          {showSearch && searchResults.length > 0 && (
            <div className="cls-search-results">
              {searchResults.map(u => {
                const isStaff = ['admin', 'teacher'].includes(u.role);
                const iAmStaff = ['admin', 'teacher'].includes(user?.role);
                const isFriendOf = friends.some(f => f._id === u._id);
                const hasSentReq = sentRequests.some(r => (r.to?._id || r.to) === u._id);
                const incomingReq = friendRequests.find(r => r.from?._id === u._id);
                const canChat = isStaff || iAmStaff || isFriendOf;
                return (
                  <div key={u._id} className="cls-user-item">
                    <div className="cls-conv-avatar" style={{ position: 'relative' }}>
                      <Avatar user={u} size={38} />
                      {onlineUsers.has(u._id) && <div className="cls-online-dot" />}
                    </div>
                    <div className="cls-user-info">
                      <div className="cls-user-name">{u.name}</div>
                      <RoleBadge role={u.role} />
                    </div>
                    {canChat ? (
                      <button className="cls-btn-sm cls-btn-primary" title="Send message"
                        onClick={() => { openDM(u._id); setShowSearch(false); setSearchQ(''); }}>
                        <Ic d={ICONS.msgbubble} size={13} />
                      </button>
                    ) : incomingReq ? (
                      <button className="cls-btn-sm cls-btn-primary"
                        onClick={() => acceptRequest(incomingReq._id)}>
                        Accept
                      </button>
                    ) : hasSentReq ? (
                      <span className="cls-req-pending-badge">Pending</span>
                    ) : sendingFriendTo === u._id ? (
                      <button className="cls-btn-sm cls-btn-ghost" disabled style={{ opacity: 0.6 }}>
                        Sending…
                      </button>
                    ) : (
                      <button className="cls-btn-sm cls-btn-primary"
                        onClick={() => sendFriendRequest(u._id)}>
                        + Add Friend
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="cls-tabs">
          <div className={`cls-tab ${tab === 'chats' ? 'active' : ''}`} onClick={() => setTab('chats')}>Chats</div>
          <div className={`cls-tab ${tab === 'friends' ? 'active' : ''}`} onClick={() => setTab('friends')}>Friends</div>
          <div className={`cls-tab ${tab === 'requests' ? 'active' : ''}`} onClick={() => { setTab('requests'); loadFriendRequests(); loadSentRequests(); }}>
            Requests
            {friendRequests.length > 0 && <div className="cls-tab-dot" />}
          </div>
        </div>

        {/* Tab content */}
        <div className="cls-conv-list">

          {/* ── Selection mode toolbar ── */}
          {tab === 'chats' && selectionMode && (
            <div className="cls-select-bar">
              <button className="cls-select-cancel-btn" onClick={cancelSelection}>
                <Ic d={ICONS.close} size={16} />
              </button>
              <span className="cls-select-count">
                {selectedConvIds.size === 0 ? 'Select chats' : `${selectedConvIds.size} selected`}
              </span>
              <button
                className={`cls-select-del-btn ${selectedConvIds.size > 0 ? 'cls-select-del-active' : ''}`}
                onClick={deleteSelectedConvs}
                disabled={selectedConvIds.size === 0}
                title="Delete selected"
              >
                <Ic d={ICONS.trash} size={17} />
              </button>
            </div>
          )}

          {tab === 'chats' && (
            conversations.length === 0
              ? <div className="cls-empty">
                  <div className="cls-empty-icon"><Ic d={ICONS.msgbubble} size={30} style={{ color: '#6366f1' }} /></div>
                  <h3>No chats yet</h3>
                  <p>Search for people above or accept a friend request to start chatting</p>
                </div>
              : conversations.map(conv => {
                  const { name, avatar, user: other } = getConvDisplay(conv);
                  const isActive = conv._id === activeConvId;
                  const isSelected = selectedConvIds.has(conv._id);
                  const isOnline = other && onlineUsers.has(other._id);
                  const typingHere = (typingUsers[conv._id] || []).length > 0;
                  const unread = unreadCounts[conv._id] || 0;
                  const lastMsg = conv.lastMessage;
                  let preview = typingHere ? 'typing...' : (lastMsg?.deletedForEveryone ? 'Message deleted' : (lastMsg?.text || (lastMsg?.attachments?.length ? 'Attachment' : '')));
                  return (
                    <div key={conv._id}
                      className={`cls-conv-item${isActive && !selectionMode ? ' active' : ''}${isSelected ? ' cls-conv-selected' : ''}`}
                      onClick={() => {
                        if (selectionMode) {
                          toggleConvSelection(conv._id);
                        } else {
                          setActiveConvId(conv._id);
                          setSidebarHidden(true);
                        }
                      }}
                      onMouseDown={!selectionMode ? startConvLongPress(conv._id) : undefined}
                      onMouseUp={cancelConvLongPress}
                      onMouseLeave={cancelConvLongPress}
                      onTouchStart={!selectionMode ? startConvLongPress(conv._id) : undefined}
                      onTouchEnd={cancelConvLongPress}
                      onTouchCancel={cancelConvLongPress}
                      onContextMenu={e => { if (!selectionMode) e.preventDefault(); }}
                    >
                      {/* Checkbox (selection mode only) */}
                      {selectionMode && (
                        <div className={`cls-conv-check${isSelected ? ' cls-conv-check-on' : ''}`}>
                          {isSelected && <Ic d={ICONS.check} size={11} stroke="#fff" />}
                        </div>
                      )}
                      <div className="cls-conv-avatar">
                        {conv.type === 'group'
                          ? conv.avatar
                            ? <img src={conv.avatar} alt={name} style={{ width: 46, height: 46, borderRadius: '50%', objectFit: 'cover' }} />
                            : <div className="cls-conv-avatar-init" style={{ background: 'linear-gradient(135deg,#059669,#10b981)' }}>{(name||'G')[0]}</div>
                          : <Avatar user={other} size={46} />
                        }
                        {isOnline && !conv.isGroup && <div className="cls-online-dot" />}
                      </div>
                      <div className="cls-conv-info">
                        <div className="cls-conv-name">{name || 'Unknown'}</div>
                        <div className="cls-conv-preview" style={{ color: typingHere ? '#6366f1' : undefined, fontStyle: typingHere ? 'italic' : 'normal' }}>{preview}</div>
                      </div>
                      {!selectionMode && (
                        <div className="cls-conv-meta">
                          <div className="cls-conv-time">{fmt(conv.lastActivity)}</div>
                          {isMuted(conv) && <Ic d={ICONS.bellOff} size={12} className="cls-muted-icon" />}
                          {unread > 0 && <div className="cls-unread-badge">{unread > 99 ? '99+' : unread}</div>}
                        </div>
                      )}
                    </div>
                  );
                })
          )}

          {tab === 'friends' && (
            friends.length === 0
              ? <div className="cls-empty">
                  <div className="cls-empty-icon"><Ic d={ICONS.users} size={28} style={{ color: '#6366f1' }} /></div>
                  <h3>No friends yet</h3>
                  <p>Search for classmates and send a friend request</p>
                </div>
              : friends.map(f => (
                  <div key={f._id} className="cls-user-item">
                    <div style={{ position: 'relative', cursor: 'pointer', flexShrink: 0 }} onClick={() => openDM(f._id, f.conversationId)}>
                      <Avatar user={f} size={42} />
                      {onlineUsers.has(f._id) && <div className="cls-online-dot" />}
                    </div>
                    <div className="cls-user-info" style={{ cursor: 'pointer' }} onClick={() => openDM(f._id, f.conversationId)}>
                      <div className="cls-user-name">{f.name}</div>
                      <div className="cls-user-role">
                        {onlineUsers.has(f._id)
                          ? <span style={{ color: '#22c55e', fontSize: 11, fontWeight: 600 }}>● Online</span>
                          : <span>Last seen {fmtLastSeen(f.lastSeen)}</span>}
                      </div>
                    </div>
                    <div className="cls-user-actions" style={{ flexShrink: 0 }}>
                      <button className="cls-btn-sm cls-btn-primary" onClick={() => openDM(f._id, f.conversationId)} title="Send message">
                        <Ic d={ICONS.msgbubble} size={13} />
                      </button>
                      <button className="cls-btn-sm cls-btn-ghost cls-btn-unfriend" onClick={() => setUnfriendConfirm(f._id)}>
                        Unfriend
                      </button>
                    </div>
                  </div>
                ))
          )}

          {tab === 'requests' && (
            <div>
              {friendRequests.length === 0 && (
                <div className="cls-empty">
                  <div className="cls-empty-icon"><Ic d={ICONS.users} size={28} style={{ color: '#6366f1' }} /></div>
                  <h3>No pending requests</h3>
                  <p>Friend requests from others will appear here</p>
                </div>
              )}
              {friendRequests.length > 0 && (
                <div style={{ padding: '8px 14px 4px', fontSize: 12, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Incoming</div>
              )}
              {friendRequests.map(r => (
                <div key={r._id} className="cls-user-item">
                  <Avatar user={r.from} size={42} />
                  <div className="cls-user-info">
                    <div className="cls-user-name">{r.from?.name}</div>
                    <RoleBadge role={r.from?.role} />
                  </div>
                  <div className="cls-user-actions">
                    <button className="cls-btn-sm cls-btn-primary" onClick={() => acceptRequest(r._id)}>Accept</button>
                    <button className="cls-btn-sm cls-btn-ghost" onClick={() => declineRequest(r._id)}>Decline</button>
                  </div>
                </div>
              ))}
              {sentRequests.length > 0 && (
                <div style={{ padding: '8px 14px 4px', fontSize: 12, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 8 }}>Sent</div>
              )}
              {sentRequests.map(r => (
                <div key={r._id || r.to?._id} className="cls-user-item">
                  <Avatar user={r.to} size={42} />
                  <div className="cls-user-info">
                    <div className="cls-user-name">{r.to?.name}</div>
                    <div className="cls-user-role" style={{ color: '#f59e0b', fontSize: 11, fontWeight: 600 }}>Pending...</div>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>

      {/* ══════════ MAIN CHAT ══════════ */}
      <div className="cls-main">
        {!activeConvId ? (
          <div className="cls-welcome">
            <div className="cls-welcome-icon">
              <Ic d={ICONS.msgbubble} size={48} style={{ color: '#6366f1' }} />
            </div>
            <h2>Welcome to Classroom</h2>
            <p>Connect with your classmates, teachers, and groups. All in one place.</p>
            <button className="cls-btn-sm cls-btn-primary" style={{ padding: '10px 24px', fontSize: 14, borderRadius: 12 }}
              onClick={() => setSidebarHidden(false)}>
              Start a conversation
            </button>
          </div>
        ) : (
          <>
            {/* ── Chat Header ── */}
            <div className="cls-chat-header">
              <button className="cls-chat-action-btn" style={{ display: 'none' }} onClick={() => { setActiveConvId(null); setSidebarHidden(false); }}
                id="cls-back-btn">
                <Ic d={ICONS.back} size={18} />
              </button>
              <button className="cls-chat-action-btn" style={{ display: window.innerWidth < 680 ? 'flex' : 'none' }}
                onClick={() => { setActiveConvId(null); setSidebarHidden(false); }}>
                <Ic d={ICONS.back} size={18} />
              </button>

              <div
                className="cls-chat-header-avatar"
                onClick={() => convDisplay.isGroup ? setModal('groupInfo') : otherUser && fetchProfile(otherUser)}
                style={{ cursor: 'pointer' }}
              >
                {convDisplay.isGroup
                  ? convDisplay.avatar
                    ? <img src={convDisplay.avatar} alt={convDisplay.name} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
                    : <div className="cls-chat-header-avatar-init" style={{ background: 'linear-gradient(135deg,#059669,#10b981)' }}>
                        {(convDisplay.name || 'G')[0]}
                      </div>
                  : <Avatar user={otherUser} size={40} />
                }
                {!convDisplay.isGroup && isOnline && (
                  <div style={{ position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, background: '#22c55e', borderRadius: '50%', border: '2px solid #fff' }} />
                )}
              </div>

              <div
                className="cls-chat-header-info"
                onClick={() => convDisplay.isGroup ? setModal('groupInfo') : otherUser && fetchProfile(otherUser)}
                style={{ cursor: 'pointer' }}
              >
                <div className="cls-chat-header-name">
                  {convDisplay.name}
                  {convDisplay.isGroup && <Ic d={ICONS.chevronR} size={13} style={{ marginLeft: 3, opacity: 0.5 }} />}
                </div>
                <div className={`cls-chat-header-status ${isOnline ? 'online' : ''}`}>
                  {typingDisplay
                    ? <><span style={{ color: '#6366f1', fontStyle: 'italic', fontSize: 12 }}>{typingDisplay}</span></>
                    : convDisplay.isGroup
                      ? <><Ic d={ICONS.users} size={11} /> {activeConv?.participants?.length} members</>
                      : isOnline
                        ? <><div className="cls-status-dot" /> Online</>
                        : otherUser?.lastSeen ? `Last seen ${fmtLastSeen(otherUser.lastSeen)}` : 'Offline'
                  }
                </div>
              </div>

              {/* Disappear timer pill */}
              {!!activeConv?.disappearAfter && (
                <div className="cls-disappear-pill" title="Disappearing messages enabled">
                  <Ic d={ICONS.clock} size={11} /> {fmtDisappear(activeConv.disappearAfter)}
                </div>
              )}

              <div className="cls-chat-header-actions" style={{ position: 'relative' }}>
                <button
                  ref={settingsBtnRef}
                  className={`cls-chat-action-btn ${showSettings ? 'active' : ''}`}
                  title="Settings"
                  onClick={(e) => { e.stopPropagation(); setShowSettings(p => !p); }}
                  style={{ color: showSettings ? '#4f46e5' : undefined }}
                >
                  <Ic d={ICONS.more} size={20} />
                </button>

                {/* ── Settings dropdown ── */}
                {showSettings && (
                  <div
                    className="cls-settings-menu"
                    onClick={e => e.stopPropagation()}
                  >
                    {/* Group-only actions */}
                    {convDisplay.isGroup && (
                      <>
                        <div className="cls-settings-section">Group</div>
                        <button className="cls-ctx-item" onClick={() => { setModal('inviteLink'); setModalData({ conv: activeConv }); setShowSettings(false); }}>
                          <Ic d={ICONS.link} size={15} /> Invite link
                        </button>
                        <button className="cls-ctx-item" onClick={() => {
                          setModal('groupInfo');
                          setEditingGroupName(true);
                          setGroupNameInput(activeConv?.name || '');
                          setShowSettings(false);
                        }}>
                          <Ic d={ICONS.edit} size={15} /> Edit group
                        </button>
                      </>
                    )}

                    {/* Common actions */}
                    <div className="cls-settings-section">Chat</div>
                    <button className="cls-ctx-item" onClick={() => { setShowMsgSearch(true); setMsgSearchQ(''); setShowSettings(false); }}>
                      <Ic d={ICONS.search} size={15} /> Search messages
                    </button>
                    <button className="cls-ctx-item" onClick={() => { setShowMedia(true); setShowSettings(false); }}>
                      <Ic d={ICONS.image} size={15} /> Media & files
                    </button>
                    <div className="cls-settings-divider" style={{ margin: '4px 0 2px' }} />
                    <div className="cls-settings-section">More</div>
                    <button className="cls-ctx-item cls-ctx-coming-soon" disabled>
                      <Ic d={ICONS.star} size={15} /> Starred messages
                      <span className="cls-soon-badge">Soon</span>
                    </button>
                    <button className="cls-ctx-item" onClick={() => {
                      if (isMuted(activeConv)) { unmuteConv(activeConvId); setShowSettings(false); }
                      else { setMuteModal(activeConvId); setShowSettings(false); }
                    }}>
                      <Ic d={ICONS.bellOff} size={15} />
                      {isMuted(activeConv) ? 'Unmute notifications' : 'Mute notifications'}
                    </button>
                    {activeConv?.pinnedMessage && (
                      <button className="cls-ctx-item" onClick={() => { unpinMessage(); setShowSettings(false); }}>
                        <Ic d={ICONS.pin} size={15} /> Unpin message
                      </button>
                    )}
                    <button className="cls-ctx-item cls-ctx-coming-soon" disabled>
                      <Ic d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" size={15} /> Chat wallpaper
                      <span className="cls-soon-badge">Soon</span>
                    </button>
                    <button className="cls-ctx-item cls-ctx-coming-soon" disabled>
                      <Ic d={ICONS.download} size={15} /> Export chat
                      <span className="cls-soon-badge">Soon</span>
                    </button>
                    <button className="cls-ctx-item cls-ctx-coming-soon" disabled>
                      <Ic d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zm0 0v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07" size={15} /> Translate messages
                      <span className="cls-soon-badge">Soon</span>
                    </button>

                    {/* Disappearing messages — DMs (any participant); groups via Group Info */}
                    {(!convDisplay.isGroup || canEditGroup) && (
                      <>
                        <div className="cls-settings-divider" style={{ margin: '4px 0 2px' }} />
                        <div className="cls-settings-section">Disappearing messages</div>
                        <div className="cls-disappear-chips-row">
                          {DISAPPEAR_OPTIONS.map(opt => (
                            <button
                              key={opt.v}
                              className={`cls-disappear-chip${(activeConv?.disappearAfter || 0) === opt.v ? ' active' : ''}`}
                              onClick={() => { setDisappear(opt.v); setShowSettings(false); }}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </>
                    )}

                    {/* Clear chat — always available */}
                    <div className="cls-settings-divider" />
                    <button className="cls-ctx-item danger" onClick={() => { setShowClearConfirm(true); setShowSettings(false); }}>
                      <Ic d={ICONS.trash} size={15} /> Clear chat
                    </button>

                    {/* DM-only danger actions */}
                    {!convDisplay.isGroup && otherUser?.role !== 'admin' && (
                      <>
                        <button className="cls-ctx-item danger" onClick={() => { setBlockConfirm({ userId: otherUser._id, name: otherUser.name }); setShowSettings(false); }}>
                          <Ic d={ICONS.block} size={15} /> Block user
                        </button>
                        <button className="cls-ctx-item danger" onClick={() => { setModal('report'); setModalData({ userId: otherUser._id }); setShowSettings(false); }}>
                          <Ic d={ICONS.flag} size={15} /> Report user
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ── Message search bar ── */}
            {showMsgSearch && (
              <div className="cls-msg-search-bar">
                <Ic d={ICONS.search} size={15} style={{ color: '#9ca3af', flexShrink: 0 }} />
                <input
                  autoFocus
                  className="cls-msg-search-input"
                  placeholder="Search messages…"
                  value={msgSearchQ}
                  onChange={e => setMsgSearchQ(e.target.value)}
                />
                {msgSearchQ && (
                  msgSearchMatches.length > 0
                    ? <span className="cls-msg-search-count">{msgSearchIdx + 1}/{msgSearchMatches.length}</span>
                    : <span className="cls-msg-search-count" style={{ color: '#ef4444' }}>No results</span>
                )}
                {msgSearchMatches.length > 1 && (
                  <>
                    <button className="cls-msg-search-nav" onClick={() => navigateMsgSearch(-1)} title="Previous">
                      <Ic d={ICONS.chevronR} size={14} style={{ transform: 'rotate(180deg)' }} />
                    </button>
                    <button className="cls-msg-search-nav" onClick={() => navigateMsgSearch(1)} title="Next">
                      <Ic d={ICONS.chevronR} size={14} />
                    </button>
                  </>
                )}
                <button className="cls-msg-search-close" onClick={() => { setShowMsgSearch(false); setMsgSearchQ(''); setMsgSearchMatches([]); }}>
                  <Ic d={ICONS.close} size={15} />
                </button>
              </div>
            )}

            {/* ── Pinned message banner ── */}
            {activeConv?.pinnedMessage && (
              <div className="cls-pin-banner" onClick={() => {
                const pid = activeConv.pinnedMessage?._id || activeConv.pinnedMessage;
                document.getElementById(`msg-${pid}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }}>
                <div className="cls-pin-icon"><Ic d={ICONS.pin} size={14} /></div>
                <div className="cls-pin-content">
                  <div className="cls-pin-label">Pinned message</div>
                  <div className="cls-pin-text">
                    {activeConv.pinnedMessage?.text
                      ? activeConv.pinnedMessage.text.slice(0, 70)
                      : activeConv.pinnedMessage?.attachments?.length ? 'Attachment' : 'Message'}
                  </div>
                </div>
                <button className="cls-pin-close" onClick={e => { e.stopPropagation(); unpinMessage(); }}>
                  <Ic d={ICONS.close} size={14} />
                </button>
              </div>
            )}

            {/* ── Messages ── */}
            <div
              className="cls-messages-area"
              ref={messagesAreaRef}
              onScroll={handleMessagesScroll}
              onClick={() => { setShowEmoji(false); setShowReactionPicker(null); }}
            >
              {/* ── Pagination top area ── */}
              {loadingMore && pagesRef.current[activeConvId] > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0' }}>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    {[0,1,2].map(i => (
                      <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#6366f1', opacity: 0.5, animation: `cls-typing-bounce 1.2s infinite ${i * 0.2}s` }} />
                    ))}
                  </div>
                </div>
              )}
              {/* "Load older messages" button — visible when more pages exist and not loading */}
              {!loadingMore && hasMoreRef.current[activeConvId] !== false && (pagesRef.current[activeConvId] || 1) >= 1 && messages.length >= PAGE_LIMIT && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
                  <button
                    onPointerDown={e => { e.preventDefault(); loadMoreMessages(); }}
                    style={{
                      background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)',
                      color: '#6366f1', borderRadius: 20, padding: '5px 16px',
                      fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex',
                      alignItems: 'center', gap: 6,
                    }}>
                    ↑ Load older messages
                  </button>
                </div>
              )}
              {!loadingMore && hasMoreRef.current[activeConvId] === false && messages.length > 0 && (
                <div style={{ textAlign: 'center', fontSize: 11, color: '#b0b7c3', padding: '8px 0 4px' }}>Beginning of conversation</div>
              )}
              {messages.map((msg, idx) => {
                const isOwn = (msg.sender?._id || msg.sender) === user?.id;
                const prevMsg = messages[idx - 1];
                const nextMsg = messages[idx + 1];
                const senderKey = (m) => m?.sender?._id || m?.sender;
                const showAvatar = !isOwn && (!prevMsg || senderKey(prevMsg) !== senderKey(msg));
                const showName = !isOwn && activeConv?.type === 'group' && showAvatar;
                const showDateSep = !prevMsg || !isSameDay(prevMsg.createdAt, msg.createdAt);
                const isGroupStart = !prevMsg || senderKey(prevMsg) !== senderKey(msg) || !isSameDay(prevMsg.createdAt, msg.createdAt);
                const isGroupEnd = !nextMsg || senderKey(nextMsg) !== senderKey(msg) || !isSameDay(msg.createdAt, nextMsg.createdAt);

                // Touch event handlers — swipe-to-reply + long-press bottom sheet
                const handleTouchStart = (e) => {
                  swipeStartX.current = e.touches[0].clientX;
                  swipeMsgRef.current = msg;
                  swipeTriggeredRef.current = false;
                  clearTimeout(longPressTimer.current);
                  longPressTimer.current = setTimeout(() => {
                    if (!swipeTriggeredRef.current) {
                      setBottomSheet(msg);
                      navigator.vibrate?.(40);
                    }
                  }, 500);
                };
                const handleTouchMove = (e) => {
                  clearTimeout(longPressTimer.current);
                  const dx = e.touches[0].clientX - swipeStartX.current;
                  if (dx > 5 && dx < 90) {
                    setSwipingId(msg._id);
                    setSwipeOffsetX(Math.min(dx, 75));
                  }
                  if (dx >= 65 && !swipeTriggeredRef.current) {
                    swipeTriggeredRef.current = true;
                    setSwipingId(null);
                    setSwipeOffsetX(0);
                    setReplyTo(msg);
                    setEditingMsg(null);
                    textareaRef.current?.focus();
                    navigator.vibrate?.(30);
                  }
                };
                const handleTouchEnd = () => {
                  clearTimeout(longPressTimer.current);
                  setSwipingId(null);
                  setSwipeOffsetX(0);
                };

                if (msg.type === 'system') {
                  return (
                    <React.Fragment key={msg._id}>
                      {showDateSep && <div className="cls-date-sep"><span>{fmtDateSep(msg.createdAt)}</span></div>}
                      <div className="cls-sys-msg">{msg.text}</div>
                    </React.Fragment>
                  );
                }

                if (msg.type === 'groupInvite') {
                  const gi = msg.groupInvite;
                  const alreadyMember = gi && conversations.some(c => c._id === String(gi.groupId));
                  return (
                    <React.Fragment key={msg._id}>
                      {showDateSep && <div className="cls-date-sep"><span>{fmtDateSep(msg.createdAt)}</span></div>}
                      <div className={`cls-msg-row ${isOwn ? 'own' : ''}`}>
                        <div className="cls-gi-invite-card">
                          <div className="cls-gi-invite-icon">👥</div>
                          <div className="cls-gi-invite-body">
                            <div className="cls-gi-invite-label">Group Invitation</div>
                            <div className="cls-gi-invite-name">{gi?.groupName || 'Group'}</div>
                            {!isOwn && (
                              alreadyMember
                                ? <span className="cls-gi-invite-joined">Already a member ✓</span>
                                : <button className="cls-gi-invite-btn"
                                    onPointerDown={e => { e.preventDefault(); gi?.inviteCode && joinViaCode(gi.inviteCode); }}>
                                    Join Group →
                                  </button>
                            )}
                            {isOwn && <span className="cls-gi-invite-sent">Invite sent</span>}
                          </div>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                }

                return (
                  <React.Fragment key={msg._id}>
                    {showDateSep && <div className="cls-date-sep"><span>{fmtDateSep(msg.createdAt)}</span></div>}
                    <div
                      id={`msg-${msg._id}`}
                      className={`cls-msg-row cls-msg-anim ${isOwn ? 'own' : ''} ${isGroupStart ? 'group-start' : ''}${showMsgSearch && msgSearchMatches[msgSearchIdx] === msg._id ? ' cls-msg-search-active' : ''}`}
                      onTouchStart={handleTouchStart}
                      onTouchMove={handleTouchMove}
                      onTouchEnd={handleTouchEnd}
                      style={swipingId === msg._id
                        ? { transform: `translateX(${swipeOffsetX}px)`, transition: 'none' }
                        : { transition: 'transform 0.2s ease' }}
                    >
                      {/* Swipe reply indicator */}
                      {swipingId === msg._id && swipeOffsetX > 20 && (
                        <div className="cls-swipe-icon" style={{ opacity: Math.min((swipeOffsetX - 20) / 40, 1) }}>
                          <Ic d={ICONS.reply} size={16} />
                        </div>
                      )}

                      {/* Avatar placeholder for non-own messages */}
                      {!isOwn && (
                        showAvatar
                          ? <button className="cls-avatar-btn" title={`View ${msg.sender?.name}'s profile`} onClick={() => fetchProfile(msg.sender)}>
                              <Avatar user={msg.sender} size={28} className="cls-msg-sender-avatar" />
                            </button>
                          : <div style={{ width: 28, flexShrink: 0 }} />
                      )}

                      <div className="cls-msg-content">
                        {showName && (
                          <div className="cls-msg-sender-name" style={{ cursor: 'pointer' }} onClick={() => fetchProfile(msg.sender)}>
                            {msg.sender?.name}
                          </div>
                        )}

                        {/* Reaction picker */}
                        {showReactionPicker === msg._id && (
                          <div className="cls-reaction-picker" onClick={e => e.stopPropagation()}>
                            {QUICK_EMOJIS.map(emoji => (
                              <button key={emoji} className="cls-reaction-picker-emoji"
                                onClick={() => reactToMessage(msg._id, emoji)}>{emoji}</button>
                            ))}
                          </div>
                        )}

                        {/* Hover actions (desktop) */}
                        <div className="cls-msg-actions" onClick={e => e.stopPropagation()}>
                          <button className="cls-msg-action-btn" title="React"
                            onClick={() => setShowReactionPicker(showReactionPicker === msg._id ? null : msg._id)}>
                            😊
                          </button>
                          <button className="cls-msg-action-btn" title="Reply"
                            onClick={() => { setReplyTo(msg); setEditingMsg(null); textareaRef.current?.focus(); }}>
                            <Ic d={ICONS.reply} size={13} />
                          </button>
                          {!msg.deletedForEveryone && (
                            <button className="cls-msg-action-btn" title="Forward"
                              onClick={() => setForwardMsg(msg)}>
                              <Ic d={ICONS.forward} size={13} />
                            </button>
                          )}
                          {isOwn && !msg.deletedForEveryone && (
                            <button className="cls-msg-action-btn" title="Edit"
                              onClick={() => { setEditingMsg(msg); setInputText(msg.text); setReplyTo(null); textareaRef.current?.focus(); }}>
                              <Ic d={ICONS.edit} size={13} />
                            </button>
                          )}
                          {(isOwn || activeConv?.admins?.includes(user?.id)) && !msg.deletedForEveryone && (
                            <button className="cls-msg-action-btn" title="Delete" style={{ color: '#ef4444' }}
                              onClick={() => deleteMessage(msg._id)}>
                              <Ic d={ICONS.trash} size={13} />
                            </button>
                          )}
                          {!isOwn && !msg.deletedForEveryone && (msg.sender?._id || msg.sender) !== user?.id && (
                            <button className="cls-msg-action-btn" title="Report message" style={{ color: '#f59e0b' }}
                              onClick={() => {
                                const senderId = msg.sender?._id || msg.sender;
                                setModal('report');
                                setModalData({ userId: senderId, message: msg });
                              }}>
                              <Ic d={ICONS.flag} size={13} />
                            </button>
                          )}
                        </div>

                        {/* Bubble — timestamp + ticks are INSIDE, tail on last of sequence */}
                        <div className={`cls-bubble ${isOwn ? 'own' : ''} ${msg.deletedForEveryone ? 'deleted' : ''} ${isGroupEnd && !msg.deletedForEveryone ? 'tail' : ''} ${!msg.deletedForEveryone && !msg.text && !msg.replyTo && msg.attachments?.length > 0 && msg.attachments.every(a => a.type === 'image') ? 'img-only' : ''}`}>
                          {/* Reply preview */}
                          {msg.replyTo && !msg.deletedForEveryone && (
                            <div className="cls-reply-preview">
                              <strong>{msg.replyTo?.sender?.name || 'Message'}</strong>
                              {msg.replyTo?.text || 'Attachment'}
                            </div>
                          )}

                          {msg.deletedForEveryone
                            ? <span style={{ display: 'flex', alignItems: 'center', gap: 5, opacity: 0.55, fontStyle: 'italic' }}><Ic d={ICONS.block} size={13} /> This message was deleted</span>
                            : <>
                                {/* Text */}
                                {msg.text && <span style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</span>}

                                {/* Attachments: voice + files (original index preserved for voice key) */}
                                {msg.attachments?.map((att, i) => {
                                  if (att.type === 'voice') return (
                                    <VoiceMessage key={i} att={att} isOwn={isOwn}
                                      playing={playingVoice === `${msg._id}-${i}`}
                                      onToggle={() => setPlayingVoice(p => p === `${msg._id}-${i}` ? null : `${msg._id}-${i}`)}
                                    />
                                  );
                                  if (att.type !== 'image') return (
                                    <a key={i} href={att.url} target="_blank" rel="noreferrer" className="cls-attach-file"
                                      style={{ marginTop: msg.text ? 8 : 0 }}>
                                      <Ic d={ICONS.file} size={22} style={{ flexShrink: 0 }} />
                                      <div className="cls-attach-file-info">
                                        <div className="cls-attach-file-name">{att.name}</div>
                                        <div className="cls-attach-file-size">{formatBytes(att.size)}</div>
                                      </div>
                                      <Ic d={ICONS.download} size={15} />
                                    </a>
                                  );
                                  return null;
                                })}
                                {/* Image grid */}
                                {(() => {
                                  const imgAtts = msg.attachments?.filter(a => a.type === 'image') || [];
                                  if (!imgAtts.length) return null;
                                  const GRID_MAX = 4;
                                  const extra = Math.max(0, imgAtts.length - GRID_MAX);
                                  const gridImgs = imgAtts.slice(0, GRID_MAX);
                                  const hasNonImg = msg.attachments?.some(a => a.type !== 'image');
                                  return (
                                    <div
                                      className={`cls-img-grid cls-img-grid-${Math.min(imgAtts.length, 4)}`}
                                      style={{ marginTop: msg.text || hasNonImg ? 8 : 0 }}
                                    >
                                      {gridImgs.map((att, gi) => {
                                        const showOverlay = gi === GRID_MAX - 1 && extra > 0;
                                        return (
                                          <div
                                            key={gi}
                                            className="cls-img-grid-cell"
                                            onClick={e => {
                                              e.stopPropagation();
                                              setPhotoList({ images: imgAtts, msg, scrollToIndex: gi });
                                            }}
                                          >
                                            <img src={att.url} alt="" className="cls-img-grid-img" />
                                            {showOverlay && (
                                              <div className="cls-img-grid-more">+{extra}</div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  );
                                })()}
                              </>
                          }
                          {/* ── Time + ticks INSIDE bubble (WhatsApp-style) ── */}
                          <div className="cls-msg-meta-inner">
                            {msg.edited && <span className="cls-msg-edited-inner">edited</span>}
                            <span>{fmtTime(msg.createdAt)}</span>
                            {isOwn && <Ticks status={msg.status} />}
                          </div>
                        </div>

                        {/* Reactions */}
                        {msg.reactions?.filter(r => r.users?.length > 0).length > 0 && (
                          <div className="cls-reactions">
                            {msg.reactions.filter(r => r.users?.length > 0).map(r => {
                              const mine = r.users?.some(u => (u._id || u) === user?.id);
                              return (
                                <button key={r.emoji} className={`cls-reaction-pill ${mine ? 'mine' : ''}`}
                                  onClick={() => reactToMessage(msg._id, r.emoji)}>
                                  {r.emoji}
                                  <span className="cls-reaction-count">{r.users?.length}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}

              {/* Typing indicator */}
              {typingDisplay && (
                <div className="cls-typing">
                  <div className="cls-typing-dots">
                    <div className="cls-typing-dot" />
                    <div className="cls-typing-dot" />
                    <div className="cls-typing-dot" />
                  </div>
                  <span>{typingDisplay}</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* ── Friend-blocked banner (student↔student, no active friendship) ── */}
            {isFriendBlocked && (
              <div className="cls-not-friends-bar">
                <Ic d={ICONS.users} size={18} style={{ flexShrink: 0, color: '#6366f1' }} />
                <div className="cls-not-friends-text">
                  <span className="cls-not-friends-title">You're not friends</span>
                  <span className="cls-not-friends-sub">Send a friend request to message {otherUser?.name?.split(' ')[0] || 'this person'} again</span>
                </div>
                <button
                  className="cls-not-friends-btn"
                  onClick={() => sendFriendRequest(otherUser._id)}
                  disabled={sendingFriendTo === otherUser._id}
                >
                  {sendingFriendTo === otherUser._id ? '…' : '+ Add Friend'}
                </button>
              </div>
            )}

            {/* ── Input Area ── */}
            <div className="cls-input-area" style={{ position: 'relative', display: isFriendBlocked ? 'none' : undefined }}>
              {/* Emoji Picker */}
              {showEmoji && (
                <div className="cls-emoji-picker" onClick={e => e.stopPropagation()}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', marginBottom: 6, padding: '0 2px' }}>QUICK REACT</div>
                  <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
                    {QUICK_EMOJIS.map(e => <button key={e} className="cls-emoji-btn"
                      onPointerDown={ev => { ev.preventDefault(); setInputText(t => t + e); textareaRef.current?.focus(); }}
                    >{e}</button>)}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', marginBottom: 6, padding: '0 2px' }}>ALL EMOJIS</div>
                  <div className="cls-emoji-grid">
                    {ALL_EMOJIS.map(e => <button key={e} className="cls-emoji-btn"
                      onPointerDown={ev => { ev.preventDefault(); setInputText(t => t + e); textareaRef.current?.focus(); }}
                    >{e}</button>)}
                  </div>
                </div>
              )}

              {/* Reply bar */}
              {replyTo && !editingMsg && (
                <div className="cls-reply-bar">
                  <Ic d={ICONS.reply} size={14} style={{ color: '#6366f1', flexShrink: 0 }} />
                  <div className="cls-reply-bar-text">
                    <strong>{replyTo.sender?.name || 'Message'}</strong>
                    {replyTo.text || 'Attachment'}
                  </div>
                  <button className="cls-reply-bar-close" onClick={() => setReplyTo(null)}>
                    <Ic d={ICONS.close} size={14} />
                  </button>
                </div>
              )}

              {/* Edit bar */}
              {editingMsg && (
                <div className="cls-edit-bar">
                  <Ic d={ICONS.edit} size={13} />
                  <span>Editing message</span>
                  <button className="cls-edit-bar-close" onClick={() => { setEditingMsg(null); setInputText(''); }}>
                    <Ic d={ICONS.close} size={14} />
                  </button>
                </div>
              )}

              {/* Attachment strip */}
              {attachFiles.length > 0 && (
                <div className="cls-attach-strip">
                  {attachFiles.map(f => (
                    <div key={f.id} className="cls-attach-thumb">
                      {f.preview
                        ? <img src={f.preview} alt={f.name} />
                        : <div className="cls-attach-thumb-file">
                            <Ic d={ICONS.file} size={18} style={{ color: '#6366f1' }} />
                            <span style={{ fontSize: 9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', textAlign: 'center' }}>{f.name}</span>
                          </div>
                      }
                      <button className="cls-attach-remove" onClick={() => setAttachFiles(prev => prev.filter(x => x.id !== f.id))}>×</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Input row */}
              {isRecording
                ? (
                  <div className="cls-input-row">
                    <div className="cls-recording-bar">
                      <div className="cls-recording-dot" />
                      <span className="cls-recording-time">{fmtRec(recTime)}</span>
                      <Waveform count={18} />
                    </div>
                    <button className="cls-input-btn recording" onClick={stopRecording} title="Stop & send">
                      <Ic d={ICONS.send} size={18} />
                    </button>
                    <button className="cls-input-btn" style={{ color: '#ef4444' }} onClick={() => { mediaRecorderRef.current?.stop(); setIsRecording(false); clearInterval(recIntervalRef.current); setRecTime(0); audioChunksRef.current = []; }} title="Cancel">
                      <Ic d={ICONS.close} size={18} />
                    </button>
                  </div>
                ) : (
                  <div className="cls-input-row">
                    {/* Emoji — onPointerDown + preventDefault keeps keyboard open */}
                    <button className={`cls-input-btn ${showEmoji ? 'active' : ''}`} title="Emoji"
                      onPointerDown={e => {
                        e.preventDefault();
                        setShowEmoji(p => !p);
                        textareaRef.current?.focus();
                      }}>
                      <Ic d={ICONS.emoji} size={20} />
                    </button>

                    {/* Attach — trigger hidden input without blurring textarea */}
                    <button className="cls-input-btn" title="Attach file"
                      onPointerDown={e => {
                        e.preventDefault();
                        fileInputRef.current?.click();
                      }}>
                      <Ic d={ICONS.attach} size={20} />
                    </button>
                    <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.doc,.docx,.txt,.ppt,.pptx,.xls,.xlsx,.zip,.mp4" style={{ display: 'none' }}
                      onChange={e => { handleFiles(e.target.files); e.target.value = ''; }} />

                    {/* Textarea */}
                    <div className="cls-textarea-wrap">
                      <textarea
                        ref={textareaRef}
                        className="cls-textarea"
                        placeholder="Type a message…"
                        value={inputText}
                        rows={1}
                        enterKeyHint="enter"
                        inputMode="text"
                        onChange={e => { setInputText(e.target.value); handleTyping(); }}
                        onFocus={() => {
                          setTimeout(() => {
                            const msgs = document.querySelector('.cls-messages-area');
                            if (msgs) msgs.scrollTop = msgs.scrollHeight;
                          }, 300);
                        }}
                        onInput={e => {
                          if (e.nativeEvent?.inputType === 'insertLineBreak') {
                            e.target.focus();
                          }
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            const isTouchDevice = navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
                            if (isTouchDevice) {
                              e.preventDefault();
                              return;
                            }
                            e.preventDefault();
                            editingMsg ? saveEdit() : sendMessage();
                          }
                        }}
                      />
                    </div>

                    {/* Voice / Send — onPointerDown keeps keyboard open */}
                    {!inputText.trim() && attachFiles.length === 0 && !editingMsg
                      ? <button className="cls-input-btn" title="Voice message"
                          onPointerDown={e => { e.preventDefault(); startRecording(e); }}>
                          <Ic d={ICONS.mic} size={20} />
                        </button>
                      : null
                    }

                    <button className="cls-send-btn" title="Send"
                      disabled={!inputText.trim() && attachFiles.length === 0 && !editingMsg}
                      onPointerDown={e => {
                        e.preventDefault();
                        if (e.currentTarget.disabled) return;
                        editingMsg ? saveEdit() : sendMessage();
                      }}>
                      <Ic d={ICONS.send} size={16} />
                    </button>
                  </div>
                )
              }
            </div>
          </>
        )}
      </div>

      {/* old header context menu removed — settings dropdown is now inline */}

      {/* ══════════ LIGHTBOX ══════════ */}
      {lightbox && ReactDOM.createPortal(
        <div
          className="cls-lightbox-overlay"
          onClick={() => { if (lightbox?.fromPhotoList) setPhotoList(lightbox.fromPhotoList); setLightbox(null); setLightboxBarsVisible(true); }}
        >
          {/* Top bar */}
          <div
            className={`cls-lightbox-topbar${lightboxBarsVisible ? '' : ' cls-lightbox-bars-hidden'}`}
            onClick={e => e.stopPropagation()}
          >
            <button className="cls-lightbox-topbtn" onClick={() => { if (lightbox?.fromPhotoList) setPhotoList(lightbox.fromPhotoList); setLightbox(null); setLightboxBarsVisible(true); }} aria-label="Close">
              <Ic d={ICONS.back} size={22} />
            </button>
            <div className="cls-lightbox-title-block">
              <span className="cls-lightbox-sender">{lightbox.senderName}</span>
              <span className="cls-lightbox-time">
                {lightbox.images.length > 1 ? `${lightbox.index + 1} / ${lightbox.images.length} · ` : ''}
                {fmtTime(lightbox.time)}
              </span>
            </div>
            <button className="cls-lightbox-topbtn" onClick={() => downloadImage(lightbox.images[lightbox.index].url)} aria-label="Download">
              <Ic d={ICONS.download} size={22} />
            </button>
            <button className="cls-lightbox-topbtn" onClick={() => { setForwardMsg(lightbox.msg); setLightbox(null); setLightboxBarsVisible(true); }} aria-label="Forward">
              <Ic d={ICONS.forward} size={22} />
            </button>
          </div>
          {/* Prev arrow */}
          {lightbox.images.length > 1 && lightbox.index > 0 && (
            <button
              className="cls-lightbox-nav cls-lightbox-nav-prev"
              onClick={e => { e.stopPropagation(); setLightbox(lb => ({ ...lb, index: lb.index - 1 })); }}
              aria-label="Previous"
            >
              <Ic d={ICONS.chevronL} size={24} />
            </button>
          )}
          {/* Next arrow */}
          {lightbox.images.length > 1 && lightbox.index < lightbox.images.length - 1 && (
            <button
              className="cls-lightbox-nav cls-lightbox-nav-next"
              onClick={e => { e.stopPropagation(); setLightbox(lb => ({ ...lb, index: lb.index + 1 })); }}
              aria-label="Next"
            >
              <Ic d={ICONS.chevronR} size={24} />
            </button>
          )}
          {/* Image */}
          <img
            src={lightbox.images[lightbox.index].url}
            alt="Full view"
            className="cls-lightbox-img"
            onClick={e => { e.stopPropagation(); setLightboxBarsVisible(v => !v); }}
          />
        </div>,
        document.body
      )}

      {/* ══════════ PHOTO LIST ══════════ */}
      {photoList && ReactDOM.createPortal(
        <div className="cls-photo-list-overlay" onClick={() => setPhotoList(null)}>
          <div className="cls-photo-list-header" onClick={e => e.stopPropagation()}>
            <button className="cls-photo-list-header-btn" onClick={() => setPhotoList(null)} aria-label="Back">
              <Ic d={ICONS.back} size={22} />
            </button>
            <div className="cls-photo-list-header-info">
              <div className="cls-photo-list-title">{photoList.msg.sender?.name || 'Photos'}</div>
              <div className="cls-photo-list-subtitle">
                {photoList.images.length} photo{photoList.images.length > 1 ? 's' : ''} · {fmt(photoList.msg.createdAt)}
              </div>
            </div>
          </div>
          <div className="cls-photo-list-scroll" ref={photoListScrollRef} onClick={e => e.stopPropagation()}>
            {photoList.images.map((img, i) => (
              <div
                key={i}
                data-index={i}
                className="cls-photo-list-item"
                onClick={() => {
                  setLightboxBarsVisible(true);
                  setLightbox({ images: photoList.images, index: i, senderName: photoList.msg.sender?.name || 'Unknown', time: photoList.msg.createdAt, msg: photoList.msg, fromPhotoList: photoList });
                }}
              >
                <img src={img.url} alt="" className="cls-photo-list-item-img" />
                <span className="cls-photo-list-item-time">{fmtTime(photoList.msg.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}

      {/* ══════════ GROUP INFO PANEL ══════════ */}
      {modal === 'groupInfo' && activeConv && (
        <div className="cls-modal-overlay" onClick={() => { setModal(null); setShowAddMember(false); setAddMemberQuery(''); setAddMemberResults([]); setEditingGroupName(false); }}>
          <div className="cls-group-info-modal" onClick={e => e.stopPropagation()}>
            <div className="cls-gi-header">
              {/* Clickable avatar — opens file picker */}
              <div className="cls-gi-avatar-wrap" onClick={() => setShowAvatarViewer(true)} title="View group photo">
                {activeConv.avatar
                  ? <img src={activeConv.avatar} alt="group" className="cls-gi-avatar-img" />
                  : <div className="cls-gi-avatar">{(activeConv.name || 'G')[0].toUpperCase()}</div>
                }
                <div className="cls-gi-avatar-overlay">
                  <Ic d={ICONS.expand} size={18} />
                </div>
                <input
                  ref={groupAvatarInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleGroupAvatarChange}
                />
              </div>

              {/* Editable group name */}
              {editingGroupName ? (
                <div className="cls-gi-name-edit-wrap">
                  <input
                    className="cls-gi-name-input"
                    value={groupNameInput}
                    autoFocus
                    maxLength={50}
                    onChange={e => setGroupNameInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') saveGroupName();
                      if (e.key === 'Escape') setEditingGroupName(false);
                    }}
                  />
                  <div className="cls-gi-name-actions">
                    <button className="cls-gi-name-confirm" onClick={saveGroupName} title="Save">✓</button>
                    <button className="cls-gi-name-cancel" onClick={() => setEditingGroupName(false)} title="Cancel">✕</button>
                  </div>
                </div>
              ) : (
                <h2
                  className="cls-gi-name cls-gi-name-editable"
                  onClick={() => { setGroupNameInput(activeConv.name || ''); setEditingGroupName(true); }}
                  title="Click to rename"
                >
                  {activeConv.name}
                  <Ic d={ICONS.edit} size={14} className="cls-gi-name-edit-icon" />
                </h2>
              )}
              <p className="cls-gi-count">{activeConv.participants?.length} members</p>
            </div>

            <div className="cls-gi-actions">
              <button className="cls-gi-action-btn" onClick={() => { setShowAddMember(p => !p); setAddMemberQuery(''); setAddMemberResults([]); }}>
                <span className="cls-gi-action-icon"><Ic d={ICONS.plus} size={18} /></span>
                <span>Add member</span>
              </button>
              <button className="cls-gi-action-btn" onClick={() => { setModal('inviteLink'); setModalData({ conv: activeConv }); }}>
                <span className="cls-gi-action-icon"><Ic d={ICONS.link} size={18} /></span>
                <span>Invite link</span>
              </button>
              <button className="cls-gi-action-btn" onClick={() => { navigator.clipboard?.writeText(activeConv.inviteCode || ''); }}>
                <span className="cls-gi-action-icon"><Ic d={ICONS.copy} size={18} /></span>
                <span>Copy code</span>
              </button>
            </div>

            {/* ── Scrollable body: add-member + members list ── */}
            <div className="cls-gi-body">
              {/* Add Member search panel */}
              {showAddMember && (
                <div className="cls-add-member-panel">
                  <div className="cls-add-member-search-row">
                    <input
                      className="cls-add-member-input"
                      placeholder="Search by name or email…"
                      value={addMemberQuery}
                      autoFocus
                      onChange={e => {
                        setAddMemberQuery(e.target.value);
                        searchAddMember(e.target.value);
                      }}
                    />
                    {addMemberSearching && <span className="cls-add-member-spinner">…</span>}
                  </div>
                  {addMemberResults.length > 0 && (
                    <div className="cls-add-member-results">
                      {addMemberResults.map(u => {
                        const alreadyIn = activeConv.participants?.some(p => (p._id || p) === u._id);
                        const isFriendOfMe = friends.some(f => f._id === u._id);
                        const isStaff = ['admin', 'teacher'].includes(u.role);
                        const iAmStaff = ['admin', 'teacher'].includes(user?.role);
                        const loading = addingMemberId === u._id;
                        return (
                          <div key={u._id} className="cls-add-member-row">
                            <Avatar user={u} size={36} />
                            <div className="cls-add-member-info">
                              <span className="cls-add-member-name">{u.name}</span>
                              <RoleBadge role={u.role || 'student'} />
                            </div>
                            {alreadyIn ? (
                              <span className="cls-add-member-tag in-group">In group</span>
                            ) : loading ? (
                              <span className="cls-add-member-tag loading">…</span>
                            ) : (isFriendOfMe || isStaff || iAmStaff) ? (
                              <button className="cls-add-member-btn add"
                                onClick={() => addMemberToGroup(u._id, activeConv._id)}>
                                Add
                              </button>
                            ) : (
                              <button className="cls-add-member-btn invite"
                                onClick={() => sendGroupInvite(u, activeConv)}>
                                Invite
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {addMemberQuery.trim() && !addMemberSearching && addMemberResults.length === 0 && (
                    <div className="cls-add-member-empty">No users found</div>
                  )}
                </div>
              )}

              {/* Disappearing messages — group admins/creator only */}
              {canEditGroup && (
                <div style={{ padding: '4px 0 12px' }}>
                  <div className="cls-gi-section-title">Disappearing messages</div>
                  <div className="cls-disappear-chips-row" style={{ padding: '0 2px' }}>
                    {DISAPPEAR_OPTIONS.map(opt => (
                      <button
                        key={opt.v}
                        className={`cls-disappear-chip${(activeConv?.disappearAfter || 0) === opt.v ? ' active' : ''}`}
                        onClick={() => setDisappear(opt.v)}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {!!activeConv?.disappearAfter && (
                    <p style={{ fontSize: 12, color: '#6b7280', margin: '6px 2px 0', lineHeight: 1.4 }}>
                      New messages will be deleted after {fmtDisappear(activeConv.disappearAfter)}.
                    </p>
                  )}
                </div>
              )}

              <div className="cls-gi-section-title">Members</div>
              <div className="cls-gi-members">
                {activeConv.participants?.map(p => {
                  const pid = p._id || p;
                  const isAdmin = activeConv.admins?.some(a => (a._id || a) === pid);
                  const isCreator = (activeConv.createdBy?._id || activeConv.createdBy) === pid;
                  const isSelf = pid === user?.id;
                  return (
                    <div key={pid} className="cls-gi-member">
                      <Avatar user={p} size={38} />
                      <div className="cls-gi-member-info">
                        <span className="cls-gi-member-name">{p.name || 'Unknown'}</span>
                        <RoleBadge role={p.role || 'student'} />
                      </div>
                      {(isAdmin || isCreator) && (
                        <span className="cls-gi-badge">{isCreator ? 'Creator' : 'Admin'}</span>
                      )}
                      {/* Crown button — visible to admins/creator for non-self, non-creator members */}
                      {canEditGroup && !isSelf && !isCreator && (
                        <button
                          className={`cls-gi-crown-btn${isAdmin ? ' is-admin' : ''}`}
                          title={isAdmin ? 'Remove admin' : 'Make admin'}
                          onClick={() => toggleMemberRole(pid)}
                        >
                          <Ic d={ICONS.crown} size={15} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="cls-gi-footer">
              <button className="cls-modal-btn secondary" onClick={() => { setModal(null); setShowAddMember(false); setAddMemberQuery(''); setAddMemberResults([]); setEditingGroupName(false); }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ GROUP AVATAR VIEWER ══════════ */}
      {showAvatarViewer && activeConv?.type === 'group' && (
        <div className="cls-av-overlay" onClick={() => { setShowAvatarViewer(false); setShowAvatarOptions(false); }}>
          <div className="cls-av-container" onClick={e => e.stopPropagation()}>
            {/* Top bar */}
            <div className="cls-av-topbar">
              <button className="cls-av-close-btn" onClick={() => { setShowAvatarViewer(false); setShowAvatarOptions(false); }}>
                <Ic d={ICONS.close} size={22} />
              </button>
              <span className="cls-av-topbar-name">{activeConv.name}</span>
              <div style={{ width: 40 }} />
            </div>

            {/* Image */}
            <div className="cls-av-img-area">
              {activeConv.avatar
                ? <img src={activeConv.avatar} className="cls-av-img" alt={activeConv.name} />
                : <div className="cls-av-placeholder">{(activeConv.name || 'G')[0].toUpperCase()}</div>
              }
            </div>

            {/* Hidden file input — shared with group info modals */}
            <input
              ref={groupAvatarInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleGroupAvatarChange}
            />

            {/* Pencil FAB — only for admins / creator */}
            {canEditGroup && (
              <div className="cls-av-bottombar">
                <div className="cls-av-pencil-wrap">
                  <button
                    className="cls-av-pencil-btn"
                    onClick={() => setShowAvatarOptions(p => !p)}
                    title="Edit photo"
                    disabled={groupAvatarUploading}
                  >
                    {groupAvatarUploading
                      ? <span style={{ fontSize: 16 }}>…</span>
                      : <Ic d={ICONS.edit} size={22} />
                    }
                  </button>
                  {showAvatarOptions && (
                    <div className="cls-av-options-menu">
                      <button
                        className="cls-av-option"
                        onClick={() => { setShowAvatarOptions(false); groupAvatarInputRef.current?.click(); }}
                      >
                        <Ic d={ICONS.image} size={16} />
                        <span>Upload photo</span>
                      </button>
                      {activeConv.avatar && (
                        <button
                          className="cls-av-option danger"
                          onClick={() => { setShowAvatarOptions(false); removeGroupAvatar(); }}
                        >
                          <Ic d={ICONS.trash} size={16} />
                          <span>Remove photo</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Bottom close button — always visible on mobile */}
            <div className="cls-av-bottomclose">
              <button
                className="cls-av-bottomclose-btn"
                onClick={() => { setShowAvatarViewer(false); setShowAvatarOptions(false); }}
              >
                <Ic d={ICONS.close} size={18} />
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ FORWARD PICKER ══════════ */}
      {forwardMsg && (
        <div className="cls-modal-overlay" onClick={() => setForwardMsg(null)}>
          <div className="cls-forward-modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <button className="cls-chat-action-btn" onClick={() => setForwardMsg(null)}>
                <Ic d={ICONS.close} size={18} />
              </button>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#1a1f36' }}>Forward to…</h3>
            </div>
            {forwardMsg.text && (
              <div className="cls-forward-preview">
                <Ic d={ICONS.forward} size={12} style={{ flexShrink: 0, opacity: 0.6 }} />
                <span>{forwardMsg.text.slice(0, 80)}{forwardMsg.text.length > 80 ? '…' : ''}</span>
              </div>
            )}
            <div className="cls-forward-list">
              {conversations.filter(c => c._id !== activeConvId).map(c => {
                const otherP = c.participants?.find(p => (p._id || p) !== user?.id);
                const cName = c.type === 'group' ? c.name : (otherP?.name || 'Chat');
                return (
                  <button key={c._id} className="cls-forward-row" onClick={() => forwardMessage(forwardMsg, c._id)}>
                    <div className={`cls-fw-avatar ${c.type === 'group' ? 'group' : ''}`}>
                      {c.type === 'group'
                        ? (c.name || 'G')[0].toUpperCase()
                        : <Avatar user={otherP} size={40} />
                      }
                    </div>
                    <div className="cls-forward-row-info">
                      <span className="cls-forward-row-name">{cName}</span>
                      {c.type === 'group' && <span className="cls-forward-row-sub">{c.participants?.length} members</span>}
                    </div>
                    <Ic d={ICONS.chevronR} size={14} style={{ color: '#9ca3af' }} />
                  </button>
                );
              })}
              {conversations.filter(c => c._id !== activeConvId).length === 0 && (
                <div style={{ textAlign: 'center', padding: 24, color: '#9ca3af', fontSize: 13 }}>No other conversations</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════ LONG-PRESS BOTTOM SHEET ══════════ */}
      {bottomSheet && (
        <div className="cls-bs-overlay" onClick={() => setBottomSheet(null)}>
          <div className="cls-bottom-sheet" onClick={e => e.stopPropagation()}>
            {/* Message preview */}
            {bottomSheet.text && (
              <div className="cls-bs-preview">
                <span>{bottomSheet.text.slice(0, 100)}{bottomSheet.text.length > 100 ? '…' : ''}</span>
              </div>
            )}
            {/* Quick emoji row */}
            <div className="cls-bs-emoji-row">
              {QUICK_EMOJIS.slice(0, 7).map(e => (
                <button key={e} className="cls-bs-emoji" onClick={() => { reactToMessage(bottomSheet._id, e); setBottomSheet(null); }}>{e}</button>
              ))}
            </div>
            <div className="cls-bs-divider" />
            {/* Actions */}
            <button className="cls-bs-action" onClick={() => { setReplyTo(bottomSheet); setEditingMsg(null); textareaRef.current?.focus(); setBottomSheet(null); }}>
              <Ic d={ICONS.reply} size={18} /> Reply
            </button>
            <button className="cls-bs-action" onClick={() => { setForwardMsg(bottomSheet); setBottomSheet(null); }}>
              <Ic d={ICONS.forward} size={18} /> Forward
            </button>
            {!bottomSheet?.deletedForEveryone && (
              <button className="cls-bs-action" onClick={() => { pinMessage(bottomSheet._id); setBottomSheet(null); }}>
                <Ic d={ICONS.pin} size={18} /> Pin message
              </button>
            )}
            {(() => {
              const bsIsOwn = (bottomSheet.sender?._id || bottomSheet.sender) === user?.id;
              return bsIsOwn && !bottomSheet.deletedForEveryone ? (
                <button className="cls-bs-action" onClick={() => { setEditingMsg(bottomSheet); setInputText(bottomSheet.text); setReplyTo(null); textareaRef.current?.focus(); setBottomSheet(null); }}>
                  <Ic d={ICONS.edit} size={18} /> Edit message
                </button>
              ) : null;
            })()}
            {(() => {
              const bsIsOwn = (bottomSheet.sender?._id || bottomSheet.sender) === user?.id;
              return (bsIsOwn || activeConv?.admins?.includes(user?.id)) && !bottomSheet.deletedForEveryone ? (
                <button className="cls-bs-action danger" onClick={() => { deleteMessage(bottomSheet._id); setBottomSheet(null); }}>
                  <Ic d={ICONS.trash} size={18} /> Delete message
                </button>
              ) : null;
            })()}
            {(() => {
              const bsIsOwn = (bottomSheet.sender?._id || bottomSheet.sender) === user?.id;
              const senderId = bottomSheet.sender?._id || bottomSheet.sender;
              return !bsIsOwn && !bottomSheet.deletedForEveryone && senderId ? (
                <button className="cls-bs-action danger" onClick={() => {
                  setModal('report');
                  setModalData({ userId: senderId, message: bottomSheet });
                  setBottomSheet(null);
                }}>
                  <Ic d={ICONS.flag} size={18} /> Report message
                </button>
              ) : null;
            })()}
            <div className="cls-bs-divider" />
            <button className="cls-bs-action" style={{ fontWeight: 700, color: '#4f46e5' }} onClick={() => setBottomSheet(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ══════════ MUTE MODAL ══════════ */}
      {muteModal && (
        <div className="cls-mute-overlay" onClick={() => setMuteModal(null)}>
          <div className="cls-mute-sheet" onClick={e => e.stopPropagation()}>
            <div className="cls-mute-title">Mute notifications</div>
            {MUTE_OPTS.map(opt => (
              <button key={opt.label} className="cls-mute-option" onClick={() => { muteConv(muteModal, opt.ms); setMuteModal(null); }}>
                {opt.label}
              </button>
            ))}
            <div className="cls-bs-divider" />
            <button className="cls-mute-cancel" onClick={() => setMuteModal(null)}>Cancel</button>
          </div>
        </div>
      )}

      {/* ══════════ USER PROFILE PANEL ══════════ */}
      {viewProfile && (
        <div className="cls-modal-overlay" onClick={() => setViewProfile(null)}>
          <div className="cls-profile-panel" onClick={e => e.stopPropagation()}>
            {/* Close */}
            <button className="cls-profile-close" onClick={() => setViewProfile(null)}>
              <Ic d={ICONS.close} size={20} />
            </button>

            {/* Hero */}
            <div className="cls-profile-hero">
              <div className="cls-profile-avatar-lg">
                {viewProfile.avatar
                  ? <img src={viewProfile.avatar} alt={viewProfile.name} className="cls-profile-avatar-img" />
                  : <span>{(viewProfile.name || 'U')[0].toUpperCase()}</span>
                }
                {onlineUsers.has(viewProfile._id) && <div className="cls-profile-online-dot" />}
              </div>
              <h2 className="cls-profile-name">{viewProfile.name}</h2>
              <span className={`cls-role-badge ${viewProfile.role}`}>{viewProfile.role}</span>
            </div>

            {/* Bio */}
            {profileLoading
              ? <div className="cls-profile-bio loading">Loading…</div>
              : viewProfile.bio
                ? <p className="cls-profile-bio">{viewProfile.bio}</p>
                : <p className="cls-profile-bio empty">No bio yet.</p>
            }

            {/* Last seen */}
            {!onlineUsers.has(viewProfile._id) && viewProfile.lastSeen && (
              <div className="cls-profile-lastseen">
                Last seen {fmtLastSeen(viewProfile.lastSeen)}
              </div>
            )}
            {onlineUsers.has(viewProfile._id) && (
              <div className="cls-profile-lastseen online">Online now</div>
            )}

            {/* Actions */}
            {viewProfile._id !== user?.id && (() => {
              const isStaff = ['admin', 'teacher'].includes(viewProfile.role);
              const iAmStaff = ['admin', 'teacher'].includes(user?.role);
              const isFriendOf = friends.some(f => f._id === viewProfile._id);
              const hasSentReq = sentRequests.some(r => (r.to?._id || r.to) === viewProfile._id);
              const incomingReq = friendRequests.find(r => r.from?._id === viewProfile._id);
              const canChat = isStaff || iAmStaff || isFriendOf;
              const isBlockedByMe = myBlocks.has(String(viewProfile._id));
              return (
                <div className="cls-profile-actions">
                  {isBlockedByMe ? (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#ef4444', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                        <Ic d={ICONS.block} size={15} /> Blocked
                      </div>
                      <button className="cls-profile-action-btn"
                        style={{ borderColor: '#ef4444', color: '#ef4444' }}
                        onClick={() => unblockUser(viewProfile._id)}>
                        Unblock
                      </button>
                    </>
                  ) : canChat ? (
                    <button className="cls-profile-action-btn primary"
                      onClick={() => { openDM(viewProfile._id); setViewProfile(null); }}>
                      <Ic d={ICONS.msgbubble} size={16} /> Message
                    </button>
                  ) : incomingReq ? (
                    <button className="cls-profile-action-btn primary"
                      onClick={() => { acceptRequest(incomingReq._id); setViewProfile(null); }}>
                      Accept Friend Request
                    </button>
                  ) : hasSentReq ? (
                    <button className="cls-profile-action-btn" disabled style={{ opacity: 0.6, cursor: 'default' }}>
                      ✓ Request Sent
                    </button>
                  ) : sendingFriendTo === viewProfile._id ? (
                    <button className="cls-profile-action-btn" disabled style={{ opacity: 0.6 }}>
                      Sending…
                    </button>
                  ) : (
                    <button className="cls-profile-action-btn primary"
                      onClick={() => sendFriendRequest(viewProfile._id)}>
                      + Add Friend
                    </button>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ══════════ MODALS ══════════ */}

      {/* New Group */}
      {modal === 'newGroup' && (
        <NewGroupModal
          onClose={() => setModal(null)}
          onCreate={createGroup}
          token={token}
        />
      )}

      {/* Join Group */}
      {modal === 'joinGroup' && (
        <div className="cls-modal-overlay" onClick={() => setModal(null)}>
          <div className="cls-modal" onClick={e => e.stopPropagation()}>
            <h3>Join a Group</h3>
            <p>Enter an invite code to join a group chat</p>
            <input className="cls-modal-input" placeholder="Invite code…" id="join-code" autoFocus />
            <div className="cls-modal-actions">
              <button className="cls-modal-btn secondary" onClick={() => setModal(null)}>Cancel</button>
              <button className="cls-modal-btn primary"
                onClick={() => joinViaCode(document.getElementById('join-code')?.value?.trim())}>
                Join
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Link */}
      {modal === 'inviteLink' && modalData.conv && (
        <div className="cls-modal-overlay" onClick={() => setModal(null)}>
          <div className="cls-modal" onClick={e => e.stopPropagation()}>
            <h3>Invite to "{modalData.conv.name}"</h3>
            <p>Share this code or link with people to invite them to the group</p>
            <div className="cls-invite-box">
              <span className="cls-invite-code">{modalData.conv.inviteCode}</span>
              <button className="cls-btn-sm cls-btn-ghost" onClick={() => {
                navigator.clipboard.writeText(modalData.conv.inviteCode);
                toast('Code copied!', 'success');
              }}>
                <Ic d={ICONS.copy} size={14} /> Copy
              </button>
            </div>
            <div className="cls-modal-actions" style={{ marginTop: 16 }}>
              <button className="cls-modal-btn primary" onClick={() => setModal(null)}>Done</button>
            </div>
          </div>
        </div>
      )}

      {/* Clear chat confirmation */}
      {showClearConfirm && (
        <div className="cls-modal-overlay" onClick={() => setShowClearConfirm(false)}>
          <div className="cls-modal" style={{ maxWidth: 360 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <span style={{ display:'flex', alignItems:'center', color:'#ef4444' }}><Ic d={ICONS.trash} size={28} /></span>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#1a1f36' }}>Clear chat?</h3>
            </div>
            <p style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.5, margin: '0 0 20px' }}>
              All messages will be hidden from <strong>your</strong> view. Other participants won't be affected — they can still see the full chat history.
            </p>
            <div className="cls-modal-actions">
              <button className="cls-modal-btn secondary" onClick={() => setShowClearConfirm(false)}>Cancel</button>
              <button className="cls-modal-btn danger" onClick={clearChat}>Clear for me</button>
            </div>
          </div>
        </div>
      )}

      {/* Report */}
      {modal === 'report' && (
        <ReportModal
          onClose={() => setModal(null)}
          message={modalData?.message || null}
          onReport={(reason, details) => reportUser(
            modalData.userId, reason, details,
            modalData?.message?._id || null,
            modalData?.message?.text || null
          )}
        />
      )}

      {/* ══════════ UNFRIEND CONFIRM MODAL ══════════ */}
      {unfriendConfirm && (() => {
        const friendName = friends.find(f => f._id === unfriendConfirm)?.name || 'this person';
        return (
          <div className="cls-modal-overlay" onClick={() => setUnfriendConfirm(null)}>
            <div className="cls-modal cls-block-modal" onClick={e => e.stopPropagation()}>
              <div className="cls-block-modal-icon" style={{ color: '#ef4444' }}>
                <Ic d={ICONS.users} size={36} />
              </div>
              <h3 className="cls-block-modal-title">Unfriend {friendName.split(' ')[0]}?</h3>
              <p className="cls-block-modal-desc">
                Are you sure you want to remove <strong>{friendName}</strong> from your friends?
                You won't be able to send them direct messages until you're friends again.
              </p>
              <div className="cls-modal-actions">
                <button className="cls-modal-btn secondary" onClick={() => setUnfriendConfirm(null)}>
                  Cancel
                </button>
                <button className="cls-modal-btn danger" onClick={() => unfriend(unfriendConfirm)}>
                  Yes, Unfriend
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ══════════ BLOCK CONFIRM MODAL ══════════ */}
      {blockConfirm && (
        <div className="cls-modal-overlay" onClick={() => setBlockConfirm(null)}>
          <div className="cls-modal cls-block-modal" onClick={e => e.stopPropagation()}>
            <div className="cls-block-modal-icon">
              <Ic d={ICONS.block} size={36} />
            </div>
            <h3 className="cls-block-modal-title">Block {blockConfirm.name}?</h3>
            <p className="cls-block-modal-desc">
              Blocked users can't send you messages and won't appear in your chat list.
              You can unblock them anytime from their profile.
            </p>
            <div className="cls-modal-actions">
              <button className="cls-modal-btn secondary" onClick={() => setBlockConfirm(null)}>
                Cancel
              </button>
              <button className="cls-modal-btn danger" onClick={() => blockUser(blockConfirm.userId)}>
                <Ic d={ICONS.block} size={14} /> Block
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ AVATAR CROP MODAL ══════════ */}
      {cropSrc && (
        <div className="cls-crop-overlay">
          {/* Top bar — Cancel only (WhatsApp style) */}
          <div className="cls-crop-header">
            <button className="cls-crop-cancel-btn" onClick={() => setCropSrc(null)}>
              <Ic d={ICONS.close} size={22} />
            </button>
            <span className="cls-crop-title">Move and Scale</span>
            <div style={{ width: 44 }} />
          </div>

          {/* Crop stage */}
          <div className="cls-crop-stage">
            <Cropper
              image={cropSrc}
              crop={crop}
              zoom={cropZoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setCropZoom}
              onCropComplete={(_, pixels) => setCroppedAreaPixels(pixels)}
              style={{ containerStyle: { background: '#111' } }}
            />
          </div>

          {/* Bottom — zoom slider + Done FAB */}
          <div className="cls-crop-footer">
            <Ic d={ICONS.image} size={14} style={{ opacity: 0.55, flexShrink: 0 }} />
            <input
              type="range"
              min={1} max={3} step={0.01}
              value={cropZoom}
              onChange={e => setCropZoom(Number(e.target.value))}
              className="cls-crop-zoom-slider"
            />
            <Ic d={ICONS.expand} size={16} style={{ opacity: 0.55, flexShrink: 0 }} />
          </div>

          {/* Done FAB — always visible bottom-right (WhatsApp ✓) */}
          <button
            className="cls-crop-done-fab"
            onClick={handleCropConfirm}
            disabled={groupAvatarUploading}
            title="Use Photo"
          >
            {groupAvatarUploading
              ? <span style={{ fontSize: 22, fontWeight: 800 }}>…</span>
              : <Ic d={ICONS.check} size={28} stroke="#fff" strokeWidth={3} />
            }
          </button>
        </div>
      )}

      {/* ══════════ MEDIA & FILES PANEL ══════════ */}
      {showMedia && activeConvId && ReactDOM.createPortal(
        (() => {
          const allMsgs = msgsByConv[activeConvId] || [];
          const images = [];
          const files = [];
          allMsgs.forEach(msg => {
            if (msg.deletedForEveryone) return;
            (msg.attachments || []).forEach(att => {
              if (att.type === 'image') images.push({ att, msg });
              else if (att.type !== 'voice') files.push({ att, msg });
            });
          });
          return (
            <div className="cls-media-panel-overlay" onClick={() => setShowMedia(false)}>
              <div className="cls-media-panel" onClick={e => e.stopPropagation()}>
                <div className="cls-media-panel-header">
                  <button className="cls-media-panel-back" onClick={() => setShowMedia(false)}>
                    <Ic d={ICONS.back} size={20} />
                  </button>
                  <div>
                    <div className="cls-media-panel-title">Media &amp; Files</div>
                    <div className="cls-media-panel-sub">{convDisplay.name}</div>
                  </div>
                </div>

                <div className="cls-media-panel-tabs">
                  <button
                    className={`cls-media-tab ${mediaPanelTab === 'media' ? 'active' : ''}`}
                    onClick={() => setMediaPanelTab('media')}
                  >
                    <Ic d={ICONS.image} size={14} /> Photos &amp; Videos
                    {images.length > 0 && <span className="cls-media-tab-count">{images.length}</span>}
                  </button>
                  <button
                    className={`cls-media-tab ${mediaPanelTab === 'files' ? 'active' : ''}`}
                    onClick={() => setMediaPanelTab('files')}
                  >
                    <Ic d={ICONS.file} size={14} /> Documents
                    {files.length > 0 && <span className="cls-media-tab-count">{files.length}</span>}
                  </button>
                </div>

                <div className="cls-media-panel-body">
                  {mediaPanelTab === 'media' && (
                    images.length === 0
                      ? (
                        <div className="cls-media-panel-empty">
                          <Ic d={ICONS.image} size={36} style={{ color: '#c7d2fe', marginBottom: 10 }} />
                          <p>No photos or videos yet</p>
                          <span>Shared images will appear here</span>
                        </div>
                      )
                      : (
                        <div className="cls-media-img-grid">
                          {images.map(({ att, msg }, idx) => (
                            <div
                              key={idx}
                              className="cls-media-img-cell"
                              onClick={() => {
                                const imgAtts = (msg.attachments || []).filter(a => a.type === 'image');
                                const imgIdx = imgAtts.findIndex(a => a.url === att.url);
                                setShowMedia(false);
                                setLightboxBarsVisible(true);
                                setLightbox({ images: imgAtts, index: Math.max(0, imgIdx), senderName: msg.sender?.name || 'Unknown', time: msg.createdAt, msg });
                              }}
                            >
                              <img src={att.url} alt="" className="cls-media-img-thumb" />
                              <div className="cls-media-img-overlay">
                                <span className="cls-media-img-date">{fmt(msg.createdAt)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                  )}

                  {mediaPanelTab === 'files' && (
                    files.length === 0
                      ? (
                        <div className="cls-media-panel-empty">
                          <Ic d={ICONS.file} size={36} style={{ color: '#c7d2fe', marginBottom: 10 }} />
                          <p>No documents yet</p>
                          <span>Shared files will appear here</span>
                        </div>
                      )
                      : (
                        <div className="cls-media-files-list">
                          {files.map(({ att, msg }, idx) => (
                            <a
                              key={idx}
                              href={att.url}
                              target="_blank"
                              rel="noreferrer"
                              className="cls-media-file-row"
                            >
                              <div className="cls-media-file-icon">
                                <Ic d={ICONS.file} size={20} />
                              </div>
                              <div className="cls-media-file-info">
                                <div className="cls-media-file-name">{att.name || 'File'}</div>
                                <div className="cls-media-file-meta">
                                  {formatBytes(att.size)}{att.size ? ' · ' : ''}{fmt(msg.createdAt)} · {msg.sender?.name || 'Unknown'}
                                </div>
                              </div>
                              <Ic d={ICONS.download} size={16} style={{ flexShrink: 0, color: '#9ca3af' }} />
                            </a>
                          ))}
                        </div>
                      )
                  )}
                </div>
              </div>
            </div>
          );
        })(),
        document.body
      )}

      {/* ── Toast notifications ── */}
      {toasts.length > 0 && (
        <div className="cls-toast-stack">
          {toasts.map(t => (
            <div key={t.id} className={`cls-toast cls-toast-${t.type}`}>
              <span className="cls-toast-icon">
                {t.type === 'success' && <Ic d={ICONS.check} size={15} />}
                {t.type === 'error'   && <Ic d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" size={15} />}
                {t.type === 'info'    && <Ic d="M12 8h.01M12 12v4" size={15} />}
              </span>
              <span className="cls-toast-msg">{t.message}</span>
              <button className="cls-toast-close" onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}>
                <Ic d={ICONS.close} size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}

/* ── Sub-components ── */

function VoiceMessage({ att, isOwn, playing, onToggle }) {
  const audioRef = useRef(null);

  useEffect(() => {
    if (!audioRef.current) return;
    if (playing) audioRef.current.play().catch(() => {});
    else { audioRef.current.pause(); audioRef.current.currentTime = 0; }
  }, [playing]);

  return (
    <div className="cls-voice-msg">
      <audio ref={audioRef} src={att.url} onEnded={onToggle} style={{ display: 'none' }} />
      <button className="cls-voice-play-btn" onClick={onToggle}>
        {playing
          ? <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><line x1="6" y1="4" x2="6" y2="20" strokeWidth="2" stroke="currentColor"/><line x1="18" y1="4" x2="18" y2="20" strokeWidth="2" stroke="currentColor"/></svg>
          : <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        }
      </button>
      <Waveform count={16} />
      {att.duration && <span className="cls-voice-duration">{Math.floor(att.duration)}s</span>}
    </div>
  );
}

function NewGroupModal({ onClose, onCreate, token }) {
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [creating, setCreating] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [friends, setFriends] = useState([]);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const searchRef = useRef(null);
  const nameRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/classroom/friends`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setFriends(Array.isArray(data) ? data.map(f => ({ ...f, isFriend: true })) : []);
      } catch {}
      finally { setLoadingFriends(false); }
    })();
  }, [token]);

  useEffect(() => {
    clearTimeout(timerRef.current);
    if (!searchQ.trim()) { setSearchResults([]); setSearching(false); return; }
    setSearching(true);
    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API_URL}/api/classroom/users/search?q=${encodeURIComponent(searchQ)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        const friendIds = new Set(friends.map(f => f._id));
        setSearchResults(data.map(u => ({ ...u, isFriend: friendIds.has(u._id) })));
      } catch {}
      finally { setSearching(false); }
    }, 280);
  }, [searchQ, friends]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (step === 1) searchRef.current?.focus();
      else nameRef.current?.focus();
    }, 120);
    return () => clearTimeout(t);
  }, [step]);

  const isSelected = (id) => selected.some(u => u._id === id);
  const toggleMember = (user) => {
    setSelected(p => isSelected(user._id) ? p.filter(u => u._id !== user._id) : [...p, user]);
  };
  const removeMember = (id) => setSelected(p => p.filter(u => u._id !== id));

  const handleCreate = async () => {
    if (!groupName.trim() || creating) return;
    setCreating(true);
    const directIds = selected.filter(u => u.isFriend).map(u => u._id);
    const inviteUsers = selected.filter(u => !u.isFriend);
    await onCreate(groupName.trim(), directIds, inviteUsers);
    setCreating(false);
  };

  const displayList = searchQ.trim() ? searchResults : friends;

  const UA = ({ user, size = 44 }) => {
    const s = { width: size, height: size, borderRadius: '50%', objectFit: 'cover', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: Math.floor(size * 0.38), color: '#fff', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', flexShrink: 0 };
    return user?.avatar ? <img src={user.avatar} alt={user.name} style={s} /> : <div style={s}>{(user?.name || '?')[0].toUpperCase()}</div>;
  };

  return (
    <div className="cls-ng-fullscreen">

      {step === 1 ? (<>
        {/* ── Topbar ── */}
        <div className="cls-ng-topbar">
          <button className="cls-ng-back-btn" onClick={onClose}>
            <Ic d={ICONS.close} size={20} />
          </button>
          <div className="cls-ng-topbar-info">
            <span className="cls-ng-topbar-title">Add group participants</span>
            <span className="cls-ng-topbar-count">{selected.length} selected</span>
          </div>
        </div>

        {/* ── Search bar ── */}
        <div className="cls-ng-searchbar-wrap">
          <div className="cls-ng-searchbar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              ref={searchRef}
              className="cls-ng-search-input"
              placeholder="Search name or email…"
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
            />
            {searching && <div className="cls-ng-spin" />}
            {searchQ && !searching && (
              <button className="cls-ng-clear-btn" onClick={() => setSearchQ('')}>×</button>
            )}
          </div>
        </div>

        {/* ── Selected chips strip ── */}
        {selected.length > 0 && (
          <div className="cls-ng-chips-strip">
            {selected.map(u => (
              <div key={u._id} className="cls-ng-chip2">
                <div style={{ position: 'relative' }}>
                  <UA user={u} size={48} />
                  <button className="cls-ng-chip2-remove" onClick={() => removeMember(u._id)}>×</button>
                </div>
                <span className="cls-ng-chip2-name">{u.name.split(' ')[0]}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── Contact list ── */}
        <div className="cls-ng-contact-list">
          {!searchQ.trim() && (
            <div className="cls-ng-list-label">
              {loadingFriends ? 'Loading contacts…' : friends.length === 0 ? 'No contacts yet — search to find people' : 'Contacts'}
            </div>
          )}
          {searchQ.trim() && !searching && searchResults.length === 0 && (
            <div className="cls-ng-empty-search">No results for "{searchQ}"</div>
          )}
          {displayList.map(u => {
            const sel = isSelected(u._id);
            return (
              <button key={u._id} className={`cls-ng-contact-row ${sel ? 'selected' : ''}`} onClick={() => toggleMember(u)}>
                <div className="cls-ng-contact-check">
                  {sel
                    ? <div className="cls-ng-check-filled"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg></div>
                    : <div className="cls-ng-check-empty" />
                  }
                </div>
                <UA user={u} size={44} />
                <div className="cls-ng-contact-info">
                  <span className="cls-ng-contact-name">{u.name}</span>
                  <span className="cls-ng-contact-sub">
                    {u.isFriend ? (u.role || 'student') : '⚡ Will receive invite'}
                  </span>
                </div>
                {!u.isFriend && (
                  <span className={`cls-ng-invite-badge ${sel ? 'done' : ''}`}>
                    {sel ? '✓ Invited' : 'Invite'}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Next FAB — portalled to body to escape stacking context ── */}
        {selected.length > 0 && ReactDOM.createPortal(
          <button className="cls-ng-action-fab" onClick={() => setStep(2)}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6"/>
            </svg>
          </button>,
          document.body
        )}
      </>) : (<>

        {/* ── Step 2 topbar ── */}
        <div className="cls-ng-topbar">
          <button className="cls-ng-back-btn" onClick={() => setStep(1)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <div className="cls-ng-topbar-info">
            <span className="cls-ng-topbar-title">New group</span>
            <span className="cls-ng-topbar-count">{selected.length} participant{selected.length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* ── Participant strip ── */}
        <div className="cls-ng-participant-strip">
          {selected.slice(0, 8).map(u => (
            <div key={u._id} className="cls-ng-participant-item">
              <UA user={u} size={50} />
              <span className="cls-ng-participant-name">{u.name.split(' ')[0]}</span>
            </div>
          ))}
          {selected.length > 8 && (
            <div className="cls-ng-participant-item">
              <div style={{ width: 50, height: 50, borderRadius: '50%', background: '#e0e7ff', color: '#6366f1', fontSize: 14, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                +{selected.length - 8}
              </div>
              <span className="cls-ng-participant-name">more</span>
            </div>
          )}
        </div>

        {/* ── Group name ── */}
        <div className="cls-ng-name-section">
          <div className="cls-ng-name-row">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" style={{ flexShrink: 0 }}>
              <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
            <input
              ref={nameRef}
              className="cls-ng-name-input"
              placeholder="Group name"
              value={groupName}
              onChange={e => setGroupName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              maxLength={60}
            />
            <span className="cls-ng-name-count">{groupName.length}/60</span>
          </div>
          {selected.some(u => !u.isFriend) && (
            <p className="cls-ng-invite-note">
              ⚡ {selected.filter(u => !u.isFriend).length} person(s) are not in your contacts — they'll get an invite and be added when they accept.
            </p>
          )}
        </div>

        {/* ── Create FAB — portalled to body to escape stacking context ── */}
        {ReactDOM.createPortal(
          <button
            className="cls-ng-action-fab"
            disabled={!groupName.trim() || creating}
            onClick={handleCreate}
          >
            {creating
              ? <div className="cls-ng-spin" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff', width: 22, height: 22 }} />
              : <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
            }
          </button>,
          document.body
        )}
      </>)}
    </div>
  );
}

function ReportModal({ onClose, onReport, message }) {
  const [reason, setReason] = useState('');
  const [otherText, setOtherText] = useState('');
  const canSubmit = reason && (reason !== 'Other' || otherText.trim().length >= 5);

  return (
    <div className="cls-modal-overlay" onClick={onClose}>
      <div className="cls-modal cls-report-modal" onClick={e => e.stopPropagation()}>
        <button className="cls-report-close" onClick={onClose}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>

        <div className="cls-report-header">
          <div className="cls-report-header-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7"/></svg>
          </div>
          <div>
            <h3 className="cls-report-title">{message ? 'Report Message' : 'Report User'}</h3>
            <p className="cls-report-subtitle">Reviewed by admins · Your identity stays private</p>
          </div>
        </div>

        {message?.text && (
          <div className="cls-report-msg-preview">
            <div className="cls-report-msg-label">Reported message</div>
            <div className="cls-report-msg-text">
              "{message.text.length > 130 ? message.text.slice(0, 130) + '…' : message.text}"
            </div>
          </div>
        )}

        <div className="cls-report-section-label">What's the issue?</div>
        <div className="cls-report-options">
          {REPORT_REASONS.map(r => (
            <button
              key={r}
              className={`cls-report-option ${reason === r ? 'selected' : ''}`}
              onClick={() => { setReason(r); if (r !== 'Other') setOtherText(''); }}
            >
              {r}
            </button>
          ))}
        </div>

        {reason === 'Other' && (
          <div className="cls-report-other-wrap">
            <textarea
              className="cls-report-other-input"
              placeholder="Please describe the issue in detail… (min 5 characters)"
              value={otherText}
              onChange={e => setOtherText(e.target.value)}
              maxLength={500}
              rows={3}
              autoFocus
            />
            <div className="cls-report-other-count">{otherText.length}/500</div>
          </div>
        )}

        <div className="cls-modal-actions">
          <button className="cls-modal-btn secondary" onClick={onClose}>Cancel</button>
          <button
            className="cls-modal-btn primary"
            disabled={!canSubmit}
            onClick={() => onReport(reason, reason === 'Other' ? otherText.trim() : undefined)}
          >
            Submit Report
          </button>
        </div>
      </div>
    </div>
  );
}
