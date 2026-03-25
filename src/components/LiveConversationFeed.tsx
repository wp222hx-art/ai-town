import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { Descriptions, FACTIONS } from '../../data/characters';
import { useEffect, useRef, useState, useCallback } from 'react';

/** Get SYNAPSE character metadata by name */
function getCharacterInfo(name: string) {
  const desc = Descriptions.find((d) => d.name === name);
  if (!desc) return null;
  const faction = FACTIONS[desc.faction];
  return { ...desc, factionColor: faction.color, factionIcon: faction.icon };
}

/** Cheerful emoji picked based on message content */
function getHappyEmoji(text: string): string {
  if (/笑|哈哈|开心|快乐|嘿|哼/.test(text)) return '😆';
  if (/！{2}|好棒|太好了|厉害|nb|太强/.test(text)) return '🥳';
  if (/爱|喜欢|心动|暖|甜/.test(text)) return '💕';
  if (/吐槽|无语|倒霉|晕|哭/.test(text)) return '😤';
  if (/好奇|为什么|真的吗|诶/.test(text)) return '👀';
  if (/花|樱|sakura|春|美/.test(text)) return '🌸';
  if (/夜|月|星|梦/.test(text)) return '🌙';
  if (/吃|喝|茶|酒|饿|好吃/.test(text)) return '🍡';
  if (/记忆|回忆|过去|想起/.test(text)) return '💭';
  if (/走|散步|逛|路上/.test(text)) return '🚶';
  if (/八卦|秘密|偷偷|悄悄/.test(text)) return '🤫';
  if (/再见|拜拜|走了|下次/.test(text)) return '👋';
  const happy = ['✨', '🌟', '💫', '🎀', '🌺', '💝', '🦋', '🌈'];
  return happy[Math.floor(Math.random() * happy.length)];
}

/** Random celebration emoji for new conversations */
function getNewConvEmoji(): string {
  const emojis = ['🎉', '💬', '🤝', '✨', '🫧', '🎊', '💫', '⚡'];
  return emojis[Math.floor(Math.random() * emojis.length)];
}

export function LiveConversationFeed({
  worldId,
}: {
  worldId: Id<'worlds'>;
}) {
  const messages = useQuery(api.messages.recentMessages, { worldId, limit: 30 });
  const feedRef = useRef<HTMLDivElement>(null);
  const [lastSeenCount, setLastSeenCount] = useState(0);
  const [newMsgFlash, setNewMsgFlash] = useState(false);
  const [newConvFlash, setNewConvFlash] = useState(false);
  const [newConvNames, setNewConvNames] = useState<string[]>([]);
  const [expandedMsgId, setExpandedMsgId] = useState<string | null>(null);
  const prevMsgCountRef = useRef(0);
  const prevConvIdsRef = useRef<Set<string>>(new Set());

  // Detect new messages AND new conversations
  useEffect(() => {
    if (!messages || messages.length === 0) return;
    const count = messages.length;

    // Detect new conversation starts
    const currentConvStarts = messages.filter((m) => m.isConversationStart);
    const currentConvIds = new Set(currentConvStarts.map((m) => m.conversationId));
    
    if (prevConvIdsRef.current.size > 0) {
      const brandNewConvs = currentConvStarts.filter(
        (m) => !prevConvIdsRef.current.has(m.conversationId),
      );
      if (brandNewConvs.length > 0) {
        // New conversation detected!
        setNewConvFlash(true);
        setNewConvNames(brandNewConvs.map((m) => m.authorName));
        setTimeout(() => setNewConvFlash(false), 4000);
      }
    }
    prevConvIdsRef.current = currentConvIds;

    // Detect regular new messages
    if (count > prevMsgCountRef.current && prevMsgCountRef.current > 0) {
      setNewMsgFlash(true);
      setTimeout(() => setNewMsgFlash(false), 2000);
    }
    prevMsgCountRef.current = count;
  }, [messages]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTo({
        top: feedRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages]);

  // Mark messages as seen when scrolling to bottom
  const markAsSeen = useCallback(() => {
    if (messages) setLastSeenCount(messages.length);
  }, [messages]);

  useEffect(() => {
    const el = feedRef.current;
    if (!el) return;
    const onScroll = () => {
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 30) {
        markAsSeen();
      }
    };
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, [markAsSeen]);

  const newCount = messages ? Math.max(0, messages.length - lastSeenCount) : 0;

  if (!messages) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-3">
        <div className="text-2xl animate-bounce">🌸</div>
        <div className="text-xs opacity-50 text-center text-pink-200">
          正在连接意识流...
        </div>
        <div className="flex gap-1">
          <span className="w-2 h-2 rounded-full bg-pink-400 animate-pulse" style={{ animationDelay: '0ms' }}></span>
          <span className="w-2 h-2 rounded-full bg-pink-400 animate-pulse" style={{ animationDelay: '200ms' }}></span>
          <span className="w-2 h-2 rounded-full bg-pink-400 animate-pulse" style={{ animationDelay: '400ms' }}></span>
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-3">
        <div className="text-3xl">🤫</div>
        <div className="text-xs opacity-50 text-center text-pink-200">
          意识体们还在酝酿...
        </div>
        <div className="text-xs opacity-30 text-pink-300">
          等待第一段对话开始
        </div>
      </div>
    );
  }

  // Group messages by conversationId for display
  const conversationStartMsgs = messages.filter((m) => m.isConversationStart);

  return (
    <div className="flex flex-col h-full">
      {/* ====== Happy Conversation Bar - NEW CONVERSATION notification ====== */}
      {newConvFlash && (
        <div
          className="relative overflow-hidden rounded-xl mb-3 animate-popIn animate-rainbowBorder"
          style={{
            background: 'linear-gradient(135deg, rgba(255,200,150,0.2) 0%, rgba(255,183,197,0.25) 40%, rgba(180,220,255,0.15) 100%)',
            border: '2px solid rgba(255,183,197,0.5)',
            boxShadow: '0 0 24px rgba(255,150,200,0.25), 0 4px 12px rgba(0,0,0,0.1)',
          }}
        >
          <div className="flex items-center gap-2 px-3 py-2.5">
            <span className="text-xl animate-confetti">{getNewConvEmoji()}</span>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold font-display text-yellow-200 truncate">
                新对话开始啦！
              </h3>
              <p className="text-[10px] text-pink-300/80 truncate">
                {newConvNames.length > 0
                  ? `${newConvNames.join('、')} 开始了新的闲聊 ✨`
                  : '有新的意识体开始聊天了'}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-xs px-2 py-0.5 rounded-full font-bold animate-pulse"
                style={{ background: 'rgba(255,220,100,0.25)', color: '#FFE08A' }}>
                NEW!
              </span>
            </div>
          </div>
          {/* Shimmer bar */}
          <div className="absolute bottom-0 left-0 w-full h-0.5 overflow-hidden">
            <div
              className="h-full w-1/3 rounded"
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(255,220,150,0.8), transparent)',
                animation: 'shimmer 1.2s ease-in-out infinite',
              }}
            ></div>
          </div>
        </div>
      )}

      {/* ====== Header Bar - Live status ====== */}
      <div
        className={`relative overflow-hidden rounded-lg mb-3 transition-all duration-500 ${
          newMsgFlash ? 'animate-happyGlow' : ''
        }`}
        style={{
          background: newMsgFlash
            ? 'linear-gradient(135deg, rgba(255,183,197,0.2) 0%, rgba(255,220,180,0.15) 50%, rgba(200,230,200,0.15) 100%)'
            : 'linear-gradient(135deg, rgba(255,183,197,0.06) 0%, rgba(255,220,180,0.04) 100%)',
          border: newMsgFlash ? '1px solid rgba(255,183,197,0.4)' : '1px solid rgba(255,183,197,0.12)',
        }}
      >
        <div className="flex items-center gap-2 px-3 py-2">
          <span className={`text-lg ${newMsgFlash ? 'animate-bounce' : ''}`}>
            {newMsgFlash ? '🎉' : '💬'}
          </span>
          <div className="flex-1">
            <h3 className="text-sm font-bold font-display text-pink-300">
              意识流 · 实时对话
            </h3>
            <p className="text-[10px] text-pink-400/60">
              {messages.length} 条对话
              {newCount > 0 && (
                <span className="ml-1 text-pink-300 font-bold animate-pulse">
                  +{newCount} 新消息!
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-pink-400 opacity-60 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
              LIVE
            </span>
          </div>
        </div>
        {newMsgFlash && (
          <div className="absolute bottom-0 left-0 w-full h-0.5 overflow-hidden">
            <div
              className="h-full w-1/3 rounded"
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(255,183,197,0.8), transparent)',
                animation: 'shimmer 1.5s ease-in-out infinite',
              }}
            ></div>
          </div>
        )}
      </div>

      {/* ====== Messages Feed ====== */}
      <div
        ref={feedRef}
        className="flex-1 overflow-y-auto space-y-1.5 pr-1 scroll-smooth"
        style={{ maxHeight: '450px' }}
      >
        {messages.map((msg, idx) => {
          const charInfo = getCharacterInfo(msg.authorName);
          const factionColor = charInfo?.factionColor ?? '#aaa';
          const factionIcon = charInfo?.factionIcon ?? '🌟';
          const isNew = idx >= messages.length - newCount;
          const isExpanded = expandedMsgId === msg._id;
          const emoji = getHappyEmoji(msg.text);
          const isLong = msg.text.length > 100;
          const isConvStart = msg.isConversationStart;

          // Find the other person in the same conversation (for conversation start labels)
          let otherName: string | null = null;
          if (isConvStart) {
            const nextInConv = messages.find(
              (m) => m.conversationId === msg.conversationId && m._id !== msg._id,
            );
            otherName = nextInConv?.authorName ?? null;
          }

          return (
            <div key={msg._id}>
              {/* Conversation start indicator */}
              {isConvStart && (
                <div
                  className={`flex items-center gap-2 py-1.5 px-2 mb-1 rounded-lg ${
                    isNew ? 'animate-popIn' : ''
                  }`}
                  style={{
                    background: 'linear-gradient(90deg, rgba(255,200,150,0.08), rgba(255,183,197,0.12), rgba(180,200,255,0.06))',
                    borderLeft: '2px solid rgba(255,220,150,0.4)',
                  }}
                >
                  <span className="text-xs">🤝</span>
                  <span className="text-[10px] text-yellow-200/70 font-display">
                    {msg.authorName}
                    {otherName ? ` 和 ${otherName} ` : ' '}
                    开始聊天
                  </span>
                  <span className="text-[10px] text-yellow-300/40 ml-auto">
                    {new Date(msg._creationTime).toLocaleTimeString('zh-CN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              )}

              {/* Message bubble */}
              <div
                className={`relative rounded-lg px-3 py-2 transition-all duration-300 cursor-pointer group ${
                  isNew ? 'animate-slideIn' : ''
                }`}
                style={{
                  background: isNew
                    ? 'rgba(255,183,197,0.08)'
                    : 'rgba(0,0,0,0.2)',
                  borderLeft: `3px solid ${factionColor}`,
                  borderRight: isNew ? '1px solid rgba(255,183,197,0.15)' : 'none',
                }}
                onClick={() => setExpandedMsgId(isExpanded ? null : msg._id)}
              >
                {/* New indicator dot */}
                {isNew && (
                  <span className="absolute -left-1 top-2 w-2 h-2 rounded-full bg-pink-400 animate-pulse"></span>
                )}

                {/* Header: author info */}
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-xs">{factionIcon}</span>
                  <span
                    className="text-xs font-bold truncate"
                    style={{ color: factionColor }}
                  >
                    {msg.authorName}
                  </span>
                  {charInfo && (
                    <span className="text-[9px] opacity-30 ml-1 truncate hidden sm:inline">
                      {charInfo.title}
                    </span>
                  )}
                  <span className="ml-auto text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                    {emoji}
                  </span>
                </div>

                {/* Message body */}
                <p className={`text-xs leading-relaxed text-gray-300 ml-4 ${
                  !isExpanded && isLong ? 'line-clamp-2' : ''
                }`}>
                  {isExpanded || !isLong
                    ? msg.text
                    : msg.text.slice(0, 100) + '...'}
                </p>
                {isLong && (
                  <span className="text-[9px] text-pink-400/50 ml-4 mt-0.5 inline-block">
                    {isExpanded ? '收起 ▲' : '展开 ▼'}
                  </span>
                )}

                {/* Timestamp */}
                <div className="flex items-center justify-end mt-1 gap-1">
                  <time className="text-[9px] opacity-25">
                    {new Date(msg._creationTime).toLocaleTimeString('zh-CN', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </time>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ====== Bottom status bar ====== */}
      <div className="flex items-center justify-between mt-2 pt-2" style={{ borderTop: '1px solid rgba(255,183,197,0.1)' }}>
        <div className="flex items-center gap-1 text-[10px] text-pink-400/40">
          <span>🌸</span>
          <span>SYNAPSE 意识流</span>
        </div>
        <div className="text-[10px] text-pink-400/30">
          {messages.length > 0 && (
            <>最新 {new Date(messages[messages.length - 1]._creationTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</>
          )}
        </div>
      </div>
    </div>
  );
}
