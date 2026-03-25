import { useState, useCallback } from 'react';
import { useAction, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id, Doc } from '../../convex/_generated/dataModel';

export function ItemCreator({ worldId }: { worldId: Id<'worlds'> }) {
  const [prompt, setPrompt] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [lastCreated, setLastCreated] = useState<{
    name: string;
    emoji: string;
    description: string;
    usage: string;
    position: { x: number; y: number };
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generateItem = useAction(api.items.generateItem);

  const handleCreate = useCallback(async () => {
    if (!prompt.trim() || isCreating) return;
    setIsCreating(true);
    setError(null);
    setLastCreated(null);
    try {
      const result = await generateItem({ worldId, prompt: prompt.trim() });
      setLastCreated(result);
      setPrompt('');
    } catch (e: any) {
      setError(e.message || '创造失败了，请重试');
    } finally {
      setIsCreating(false);
    }
  }, [prompt, isCreating, worldId, generateItem]);

  const quickPrompts = [
    '一把能说话的伞',
    '樱花味的记忆糖',
    '会发光的石头',
    '时间沙漏',
    '神秘的地图碎片',
    '会唱歌的贝壳',
  ];

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-lg">🪄</span>
        <h3 className="text-sm font-bold font-display text-yellow-200">创造物品</h3>
      </div>
      <p className="text-[10px] text-pink-300/60 -mt-1">
        输入提示词，AI会创造一个独特的物品放到地图上，角色们会去拾取并学会使用
      </p>

      {/* Input area */}
      <div className="flex gap-2">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          placeholder="描述你想创造的物品..."
          disabled={isCreating}
          className="flex-1 bg-black/30 border border-pink-400/20 rounded-lg px-3 py-2 text-xs text-gray-200 placeholder-pink-400/30 outline-none focus:border-yellow-300/40 transition-colors"
          maxLength={100}
        />
        <button
          onClick={handleCreate}
          disabled={isCreating || !prompt.trim()}
          className="px-3 py-2 rounded-lg text-xs font-bold transition-all shrink-0"
          style={{
            background: isCreating
              ? 'rgba(255,220,100,0.1)'
              : prompt.trim()
              ? 'linear-gradient(135deg, rgba(255,220,100,0.25), rgba(255,183,197,0.2))'
              : 'rgba(100,100,100,0.1)',
            border: prompt.trim() ? '1px solid rgba(255,220,100,0.3)' : '1px solid rgba(100,100,100,0.2)',
            color: prompt.trim() ? '#FFE08A' : '#666',
            cursor: isCreating || !prompt.trim() ? 'default' : 'pointer',
          }}
        >
          {isCreating ? (
            <span className="flex items-center gap-1">
              <span className="animate-spin">✨</span>
              创造中
            </span>
          ) : (
            '✨ 创造'
          )}
        </button>
      </div>

      {/* Quick prompts */}
      <div className="flex flex-wrap gap-1.5">
        {quickPrompts.map((qp) => (
          <button
            key={qp}
            onClick={() => setPrompt(qp)}
            className="text-[10px] px-2 py-1 rounded-full transition-colors hover:text-yellow-200"
            style={{
              background: 'rgba(255,220,100,0.06)',
              border: '1px solid rgba(255,220,100,0.15)',
              color: 'rgba(255,220,100,0.5)',
            }}
          >
            {qp}
          </button>
        ))}
      </div>

      {/* Error display */}
      {error && (
        <div className="text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2 border border-red-400/20">
          ⚠️ {error}
        </div>
      )}

      {/* Success display */}
      {lastCreated && (
        <div
          className="rounded-lg px-3 py-3 animate-popIn"
          style={{
            background: 'linear-gradient(135deg, rgba(255,220,100,0.12), rgba(255,183,197,0.08))',
            border: '1px solid rgba(255,220,100,0.3)',
          }}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xl">{lastCreated.emoji}</span>
            <div>
              <span className="text-sm font-bold text-yellow-200">{lastCreated.name}</span>
              <span className="text-[9px] text-pink-300/50 ml-2">
                已放置于 ({lastCreated.position.x}, {lastCreated.position.y})
              </span>
            </div>
          </div>
          <p className="text-[11px] text-gray-300 ml-7">{lastCreated.description}</p>
          <p className="text-[10px] text-yellow-300/60 ml-7 mt-1">
            📖 使用方法：{lastCreated.usage}
          </p>
        </div>
      )}
    </div>
  );
}

/** Display items in the world - used in the side panel */
export function WorldItems({ worldId }: { worldId: Id<'worlds'> }) {
  const items = useQuery(api.items.listItems, { worldId });

  if (!items || items.length === 0) {
    return (
      <div className="text-center py-4">
        <div className="text-2xl mb-1">📦</div>
        <p className="text-[10px] text-pink-300/40">世界里还没有物品</p>
        <p className="text-[10px] text-pink-300/30">在上方创造第一个吧！</p>
      </div>
    );
  }

  const spawned = items.filter((i: Doc<'items'>) => i.state === 'spawned');
  const picked = items.filter((i: Doc<'items'>) => i.state === 'picked');
  const used = items.filter((i: Doc<'items'>) => i.state === 'used');

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm">🎒</span>
        <h3 className="text-xs font-bold font-display text-pink-300">
          世界物品 · {items.length}
        </h3>
      </div>

      {spawned.length > 0 && (
        <div>
          <div className="text-[10px] text-yellow-300/60 mb-1 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse"></span>
            地图上 ({spawned.length})
          </div>
          {spawned.map((item: Doc<'items'>) => (
            <ItemCard key={item._id} item={item} />
          ))}
        </div>
      )}

      {picked.length > 0 && (
        <div>
          <div className="text-[10px] text-green-300/60 mb-1 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
            已被拾取 ({picked.length})
          </div>
          {picked.map((item: Doc<'items'>) => (
            <ItemCard key={item._id} item={item} />
          ))}
        </div>
      )}

      {used.length > 0 && (
        <div>
          <div className="text-[10px] text-gray-400/60 mb-1 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
            已使用 ({used.length})
          </div>
          {used.map((item: Doc<'items'>) => (
            <ItemCard key={item._id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function ItemCard({ item }: { item: Doc<'items'> }) {
  return (
    <div
      className="flex items-start gap-2 rounded-lg px-2.5 py-2 mb-1 transition-all"
      style={{
        background: item.state === 'spawned'
          ? 'rgba(255,220,100,0.06)'
          : item.state === 'picked'
          ? 'rgba(100,220,100,0.06)'
          : 'rgba(100,100,100,0.06)',
        borderLeft: item.state === 'spawned'
          ? '2px solid rgba(255,220,100,0.3)'
          : item.state === 'picked'
          ? '2px solid rgba(100,220,100,0.3)'
          : '2px solid rgba(100,100,100,0.2)',
      }}
    >
      <span className="text-base mt-0.5">{item.emoji}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-gray-200 truncate">{item.name}</span>
          {item.state === 'spawned' && (
            <span className="text-[9px] text-yellow-400/50">
              ({item.position.x},{item.position.y})
            </span>
          )}
        </div>
        <p className="text-[10px] text-gray-400 truncate">{item.description}</p>
        {item.state === 'picked' && item.ownerId && (
          <p className="text-[9px] text-green-400/50 mt-0.5">🎒 被角色持有中</p>
        )}
        {item.state === 'used' && (
          <p className="text-[9px] text-gray-500 mt-0.5">✅ 已被使用</p>
        )}
      </div>
    </div>
  );
}
