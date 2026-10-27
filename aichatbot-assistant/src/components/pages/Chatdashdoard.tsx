// Chatbot/src/components/pages/Chatdashboard.tsx
import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic,
  Send,
  Search,
  Plus,
  Trash2,
  Bot,
  User,
  Volume2,
  VolumeX,
  MessageSquare,
  Sparkles,
  X,
  Menu,
} from 'lucide-react';
import styles from '../pagesmodulecss/chatdashboard.module.css';
import * as API from '../../services/api';
import type { Conversation, Message } from '../../services/api';

type Status =
  | 'idle'
  | 'recording'
  | 'transcribing'
  | 'thinking'
  | 'speaking';

interface ChatDashboardProps {
  darkMode?: boolean;
}

const EASE = [0.22, 1, 0.36, 1] as const;

const msgVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.42, ease: EASE },
  },
};

const listVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.04, delayChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.32, ease: EASE },
  },
};

const statusVariants = {
  hidden: { opacity: 0, y: 5 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.22, ease: EASE } },
  exit: { opacity: 0, y: 5, transition: { duration: 0.16 } },
};

const STATUS_LABEL: Record<Status, string> = {
  idle: '',
  recording: 'Recording — release to send',
  transcribing: 'Transcribing your voice…',
  thinking: 'Assistant is thinking…',
  speaking: 'Speaking…',
};

const STATUS_DOT: Record<Status, string> = {
  idle: '',
  recording: styles.dotRecording,
  transcribing: styles.dotTranscribing,
  thinking: styles.dotThinking,
  speaking: styles.dotSpeaking,
};

const HINTS = [
  'What can you do?',
  "Today's AI news",
  'Tell me a fun fact',
];

export default function ChatDashboard({ darkMode = false }: ChatDashboardProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [isRecording, setIsRecording] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const micDownRef = useRef(false);

  const activeConvIdRef = useRef<number | null>(null);
  const autoSpeakRef = useRef(true);
  const statusRef = useRef<Status>('idle');

  useEffect(() => { activeConvIdRef.current = activeConvId; }, [activeConvId]);
  useEffect(() => { autoSpeakRef.current = autoSpeak; }, [autoSpeak]);
  useEffect(() => { statusRef.current = status; }, [status]);

  const loadConversations = useCallback(async () => {
    try {
      const data = await API.getConversations();
      setConversations(data);
    } catch {
      // Non-critical
    }
  }, []);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, status]);

  const stopAudio = useCallback(() => {
    if (!currentAudioRef.current) return;
    currentAudioRef.current.pause();
    currentAudioRef.current.onended = null;
    currentAudioRef.current = null;
  }, []);

  const playReply = useCallback(async (text: string) => {
    stopAudio();
    setStatus('speaking');
    try {
      const url = await API.textToSpeech(text);
      const audio = new Audio(url);
      currentAudioRef.current = audio;
      void audio.play();
      audio.onended = () => {
        setStatus('idle');
        URL.revokeObjectURL(url);
        currentAudioRef.current = null;
      };
    } catch {
      setStatus('idle');
    }
  }, [stopAudio]);

  const handleSend = useCallback(async (
    text: string,
    skipAddUserMsg = false,
  ) => {
    const trimmed = text.trim();
    if (!trimmed || statusRef.current === 'thinking') return;

    setErrorMsg('');

    if (!skipAddUserMsg) {
      setInputText('');
      if (inputRef.current) inputRef.current.style.height = 'auto';
      setMessages(prev => [...prev, { role: 'user', content: trimmed }]);
    }

    setStatus('thinking');

    try {
      const res = await API.sendChat(trimmed, activeConvIdRef.current);
      setActiveConvId(res.conversation_id);
      setMessages(prev => [...prev, { role: 'assistant', content: res.reply }]);
      void loadConversations();

      if (autoSpeakRef.current) {
        await playReply(res.reply);
      } else {
        setStatus('idle');
      }
    } catch {
      setErrorMsg('Something went wrong — please try again.');
      setStatus('idle');
    }
  }, [loadConversations, playReply]);

  const openConversation = useCallback(async (convId: number) => {
    stopAudio();
    setActiveConvId(convId);
    setSidebarOpen(false);
    setErrorMsg('');
    try {
      const msgs = await API.getConversationMessages(convId);
      setMessages(msgs);
    } catch {
      setErrorMsg('Could not load conversation.');
    }
  }, [stopAudio]);

  const handleNewConversation = useCallback(() => {
    stopAudio();
    setActiveConvId(null);
    setMessages([]);
    setInputText('');
    setErrorMsg('');
    setStatus('idle');
    setSidebarOpen(false);
    setTimeout(() => inputRef.current?.focus(), 60);
  }, [stopAudio]);

  const handleDelete = useCallback(async (
    e: React.MouseEvent,
    convId: number,
  ) => {
    e.stopPropagation();
    try {
      await API.deleteConversation(convId);
      if (activeConvIdRef.current === convId) handleNewConversation();
      void loadConversations();
    } catch {
      setErrorMsg('Could not delete — try again.');
    }
  }, [handleNewConversation, loadConversations]);

  // ─────────────────────────────────────────────────
  // MIC RECORDING
  // ─────────────────────────────────────────────────

  const startRecording = useCallback(async () => {
    if (
      statusRef.current === 'thinking' ||
      statusRef.current === 'transcribing'
    ) return;
    stopAudio();
    setErrorMsg('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const recorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];

      recorder.ondataavailable = e => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.start(100);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setStatus('recording');
    } catch {
      setErrorMsg(
        'Microphone access denied. Allow mic access in browser settings.'
      );
    }
  }, [stopAudio]);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== 'recording') return;
    setIsRecording(false);

    recorder.onstop = async () => {
      recorder.stream.getTracks().forEach(t => t.stop());

      const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      if (blob.size < 600) { 
        setStatus('idle'); 
        return; 
      }

      setStatus('transcribing');
      try {
        const text = await API.transcribeAudio(blob);
        const trimmed = text.trim();
        if (!trimmed) { 
          setStatus('idle'); 
          return; 
        }

        setMessages(prev => [...prev, { role: 'user', content: trimmed }]);
        await handleSend(trimmed, true);
      } catch (err) {
        console.error("Transcription error:", err);
        setErrorMsg('Voice processing failed — please try again.');
        setStatus('idle');
      }
    };

    recorder.stop();
    mediaRecorderRef.current = null;
  }, [handleSend]);

  const handleMicDown = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      micDownRef.current = true;
      void startRecording();
    },
    [startRecording],
  );

  const handleMicUp = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      if (!micDownRef.current) return;
      micDownRef.current = false;
      stopRecording();
    },
    [stopRecording],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend(inputText);
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  const filteredConvs = conversations.filter(c =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeTitle =
    conversations.find(c => c.id === activeConvId)?.title ?? 'VoiceAI Chat';

  const inputDisabled =
    status === 'recording' ||
    status === 'transcribing' ||
    status === 'thinking';

  return (
    <div className={`${styles.dashboard} ${darkMode ? styles.dark : ''}`}>
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            className={styles.overlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      <aside
        className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}
      >
        <div className={styles.sidebarHeader}>
          <div className={styles.brand}>
            <motion.div
              className={styles.brandIcon}
              whileHover={{ rotate: 8, scale: 1.06 }}
              transition={{ type: 'spring', stiffness: 320, damping: 22 }}
            >
              <Sparkles size={15} strokeWidth={1.8} />
            </motion.div>
            <div className={styles.brandText}>
              <span className={styles.brandName}>VoiceAI</span>
              <span className={styles.brandSub}>Assistant</span>
            </div>
          </div>

          <div className={styles.searchWrap}>
            <Search size={13} className={styles.searchIcon} />
            <input
              className={styles.searchInput}
              placeholder="Search conversations"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              aria-label="Search conversations"
            />
            <AnimatePresence>
              {searchQuery && (
                <motion.button
                  className={styles.searchClear}
                  onClick={() => setSearchQuery('')}
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.6 }}
                  transition={{ duration: 0.14 }}
                  aria-label="Clear search"
                >
                  <X size={11} />
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          <motion.button
            className={styles.newChatBtn}
            onClick={handleNewConversation}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
          >
            <Plus size={14} strokeWidth={2.2} />
            New conversation
          </motion.button>
        </div>

        <div className={styles.convList}>
          {filteredConvs.length === 0 ? (
            <p className={styles.convEmptyState}>
              {searchQuery
                ? `No matches for "${searchQuery}"`
                : 'No conversations yet — start one below.'}
            </p>
          ) : (
            <>
              <p className={styles.sectionLabel}>Recent</p>
              <motion.ul
                className={styles.convUl}
                variants={listVariants}
                initial="hidden"
                animate="visible"
              >
                {filteredConvs.map(conv => (
                  <motion.li
                    key={conv.id}
                    variants={itemVariants}
                    layout
                    className={`${styles.convItem} ${
                      activeConvId === conv.id ? styles.convItemActive : ''
                    }`}
                    onClick={() => void openConversation(conv.id)}
                  >
                    <MessageSquare
                      size={13}
                      strokeWidth={1.8}
                      className={styles.convIcon}
                    />
                    <span className={styles.convTitle}>{conv.title}</span>
                    <motion.button
                      className={styles.convDeleteBtn}
                      onClick={e => void handleDelete(e, conv.id)}
                      whileTap={{ scale: 0.86 }}
                      title="Delete conversation"
                      aria-label="Delete conversation"
                    >
                      <Trash2 size={12} strokeWidth={1.8} />
                    </motion.button>
                  </motion.li>
                ))}
              </motion.ul>
            </>
          )}
        </div>
      </aside>

      <main className={styles.main}>
        <header className={styles.mainHeader}>
          <motion.button
            className={styles.menuBtn}
            onClick={() => setSidebarOpen(s => !s)}
            whileTap={{ scale: 0.9 }}
            aria-label="Toggle conversation sidebar"
          >
            <Menu size={17} strokeWidth={1.8} />
          </motion.button>

          <div className={styles.headerMeta}>
            <span className={styles.headerEyebrow}>Conversation</span>
            <h1 className={styles.headerTitle}>
              {activeConvId ? activeTitle : 'New chat'}
            </h1>
          </div>

          <motion.button
            className={`${styles.autoSpeakBtn} ${
              autoSpeak ? styles.autoSpeakBtnOn : ''
            }`}
            onClick={() => { stopAudio(); setAutoSpeak(s => !s); }}
            whileTap={{ scale: 0.96 }}
            title={
              autoSpeak
                ? 'Auto-speak ON — click to mute'
                : 'Auto-speak OFF — click to enable'
            }
          >
            <span className={styles.autoSpeakDot} />
            {autoSpeak ? <Volume2 size={13} strokeWidth={1.8} /> : <VolumeX size={13} strokeWidth={1.8} />}
            <span className={styles.autoSpeakLabel}>
              {autoSpeak ? 'Voice' : 'Muted'}
            </span>
          </motion.button>
        </header>

        <div className={styles.messagesArea}>
          {messages.length === 0 ? (
            <div className={styles.welcomeWrap}>
              <motion.p
                className={styles.welcomeEyebrow}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: EASE }}
              >
                <span className={styles.welcomeDot} />
                Ready when you are
              </motion.p>

              <motion.h2
                className={styles.welcomeTitle}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: EASE, delay: 0.08 }}
              >
                How can I help?
              </motion.h2>

              <motion.p
                className={styles.welcomeSub}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: EASE, delay: 0.16 }}
              >
                Type a message, or hold the microphone to speak.
              </motion.p>

              <motion.div
                className={styles.hintRow}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: EASE, delay: 0.24 }}
              >
                {HINTS.map(hint => (
                  <motion.button
                    key={hint}
                    className={styles.hintChip}
                    onClick={() => void handleSend(hint)}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {hint}
                  </motion.button>
                ))}
              </motion.div>
            </div>
          ) : (
            <div className={styles.threadWrap}>
              <AnimatePresence initial={false}>
                {messages.map((msg, idx) => (
                  <motion.div
                    key={idx}
                    className={`${styles.messageRow} ${
                      msg.role === 'user'
                        ? styles.messageRowUser
                        : styles.messageRowAI
                    }`}
                    variants={msgVariants}
                    initial="hidden"
                    animate="visible"
                  >
                    <div
                      className={`${styles.avatar} ${
                        msg.role === 'user'
                          ? styles.avatarUser
                          : styles.avatarAI
                      }`}
                    >
                      {msg.role === 'user'
                        ? <User size={13} strokeWidth={1.8} />
                        : <Bot size={13} strokeWidth={1.8} />
                      }
                    </div>

                    <div
                      className={`${styles.bubble} ${
                        msg.role === 'user'
                          ? styles.bubbleUser
                          : styles.bubbleAI
                      }`}
                    >
                      {msg.content}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              <AnimatePresence>
                {(status === 'thinking' || status === 'transcribing') && (
                  <motion.div
                    className={styles.typingRow}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className={`${styles.avatar} ${styles.avatarAI}`}>
                      <Bot size={13} strokeWidth={1.8} />
                    </div>
                    <div className={styles.typingBubble}>
                      {[0, 1, 2].map(i => (
                        <motion.span
                          key={i}
                          className={styles.dot}
                          animate={{ y: [0, -5, 0], opacity: [0.4, 1, 0.4] }}
                          transition={{
                            duration: 0.72,
                            repeat: Infinity,
                            delay: i * 0.14,
                            ease: 'easeInOut',
                          }}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <AnimatePresence>
          {errorMsg && (
            <motion.div
              className={styles.errorBar}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.24, ease: EASE }}
            >
              <span className={styles.errorDot} />
              <span>{errorMsg}</span>
              <button
                className={styles.errorClose}
                onClick={() => setErrorMsg('')}
                aria-label="Dismiss error"
              >
                <X size={12} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {status !== 'idle' && (
            <motion.div
              key={status}
              className={styles.statusBar}
              variants={statusVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <motion.span
                className={`${styles.statusDot} ${STATUS_DOT[status]}`}
                animate={{
                  scale: [1, 1.5, 1],
                  opacity: [1, 0.4, 1],
                }}
                transition={{ duration: 1.0, repeat: Infinity, ease: 'easeInOut' }}
              />
              {STATUS_LABEL[status]}
            </motion.div>
          )}
        </AnimatePresence>

        <div className={styles.inputArea}>
          <div className={styles.inputBox}>
            <textarea
              ref={inputRef}
              className={styles.textInput}
              placeholder="Type a message… or hold the mic to speak"
              value={inputText}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={inputDisabled}
              aria-label="Chat input"
            />

            <div className={styles.inputActions}>
              <motion.button
                className={styles.sendBtn}
                onClick={() => void handleSend(inputText)}
                disabled={!inputText.trim() || inputDisabled}
                whileTap={{ scale: 0.92 }}
                aria-label="Send message"
              >
                <Send size={14} strokeWidth={1.9} />
              </motion.button>

              <motion.button
                className={`${styles.micBtn} ${
                  isRecording ? styles.micBtnRecording : ''
                }`}
                onMouseDown={handleMicDown}
                onMouseUp={handleMicUp}
                onMouseLeave={handleMicUp}
                onTouchStart={handleMicDown}
                onTouchEnd={handleMicUp}
                animate={
                  isRecording
                    ? {
                        scale: [1, 1.12, 1],
                        boxShadow: [
                          '0 0 0 0px rgba(201,100,66,0.5)',
                          '0 0 0 12px rgba(201,100,66,0)',
                          '0 0 0 0px rgba(201,100,66,0.5)',
                        ],
                      }
                    : {
                        scale: 1,
                        boxShadow: '0 0 0 0px rgba(201,100,66,0)',
                      }
                }
                transition={{
                  duration: 1.2,
                  repeat: isRecording ? Infinity : 0,
                  ease: 'easeInOut',
                }}
                aria-label={
                  isRecording
                    ? 'Recording — release to send'
                    : 'Hold to record voice'
                }
                title="Hold to record"
              >
                {isRecording ? (
                  <div className={styles.waveform}>
                    {([1, 2, 3, 4, 5] as const).map(i => (
                      <span
                        key={i}
                        className={`${styles.waveBar} ${
                          (styles as Record<string, string>)[`waveBar${i}`] ?? ''
                        }`}
                      />
                    ))}
                  </div>
                ) : (
                  <Mic size={14} strokeWidth={1.9} />
                )}
              </motion.button>
            </div>
          </div>

          <p className={styles.inputHint}>
            <kbd>Enter</kbd> to send
            <span className={styles.hintSep}>·</span>
            <kbd>Shift</kbd>+<kbd>Enter</kbd> for new line
            <span className={styles.hintSep}>·</span>
            Hold mic to speak
          </p>
        </div>
      </main>
    </div>
  );
}