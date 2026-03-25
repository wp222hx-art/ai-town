import { useMemo, useRef, useState } from 'react';
import PixiGame from './PixiGame.tsx';

import { useElementSize } from 'usehooks-ts';
import { Stage } from '@pixi/react';
import { ConvexProvider, useConvex, useQuery } from 'convex/react';
import PlayerDetails from './PlayerDetails.tsx';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { useWorldHeartbeat } from '../hooks/useWorldHeartbeat.ts';
import { useHistoricalTime } from '../hooks/useHistoricalTime.ts';
import { DebugTimeManager } from './DebugTimeManager.tsx';
import { GameId } from '../../convex/aiTown/ids.ts';
import { useServerGame, type ServerGame } from '../hooks/serverGame.ts';
import { createMockGame } from '../mockData.ts';
import { Descriptions, FACTIONS, type Faction } from '../../data/characters.ts';
import { LiveConversationFeed } from './LiveConversationFeed.tsx';
import { ItemCreator, WorldItems } from './Items.tsx';

export const SHOW_DEBUG_UI = !!import.meta.env.VITE_SHOW_DEBUG_UI;

/** Helper: get faction info for a character name */
function getFactionForCharacter(characterName: string): { faction: Faction; color: string; icon: string } | null {
  const desc = Descriptions.find((d) => d.character === characterName || d.name === characterName);
  if (!desc) return null;
  const f = FACTIONS[desc.faction];
  return { faction: desc.faction, color: f.color, icon: f.icon };
}

export default function Game() {
  const convex = useConvex();
  const [selectedElement, setSelectedElement] = useState<{
    kind: 'player';
    id: GameId<'players'>;
  }>();
  const [gameWrapperRef, { width, height }] = useElementSize();

  const worldStatus = useQuery(api.world.defaultWorldStatus);
  const worldId = worldStatus?.worldId;
  const engineId = worldStatus?.engineId;

  const game = useServerGame(worldId);

  // Send a periodic heartbeat to our world to keep it alive.
  useWorldHeartbeat();

  const worldState = useQuery(api.world.worldState, worldId ? { worldId } : 'skip');
  const { historicalTime, timeManager } = useHistoricalTime(worldState?.engine);

  const scrollViewRef = useRef<HTMLDivElement>(null);

  // Create mock game data for demo mode when Convex backend is unavailable
  const mockGame = useMemo(() => createMockGame(), []);
  const isDemo = !worldId || !engineId || !game;
  const activeGame = game ?? mockGame;

  return (
    <>
      {SHOW_DEBUG_UI && !isDemo && (
        <DebugTimeManager timeManager={timeManager} width={200} height={100} />
      )}
      {isDemo && (
        <div className="text-center py-2 text-pink-200 text-sm" style={{ background: 'linear-gradient(90deg, rgba(255,150,200,0.1), rgba(200,150,220,0.1), rgba(255,150,200,0.1))' }}>
          演示模式 — 意识连接未建立。运行{' '}
          <code className="bg-black/30 px-1 rounded">npx convex dev</code> 以接入 SYNAPSE 世界。
        </div>
      )}
      <div className="mx-auto w-full max-w grid grid-rows-[240px_1fr] lg:grid-rows-[1fr] lg:grid-cols-[1fr_auto] lg:grow max-w-[1400px] min-h-[480px] game-frame">
        {/* Game area */}
        <div className="relative overflow-hidden bg-brown-900" ref={gameWrapperRef}>
          <div className="absolute inset-0">
            <div className="container">
              <Stage width={width} height={height} options={{ backgroundColor: 0x88af74 }}>
                {/* Re-propagate context because contexts are not shared between renderers. */}
                <ConvexProvider client={convex}>
                  <PixiGame
                    game={activeGame}
                    worldId={worldId ?? ('' as any)}
                    engineId={engineId ?? ('' as any)}
                    width={width}
                    height={height}
                    historicalTime={isDemo ? undefined : historicalTime}
                    setSelectedElement={setSelectedElement}
                    isDemo={isDemo}
                  />
                </ConvexProvider>
              </Stage>
            </div>
          </div>
        </div>
        {/* Right column area — SYNAPSE 信息面板 */}
        <div
          className="flex flex-col overflow-y-auto shrink-0 px-4 py-4 sm:px-6 lg:w-96 xl:pr-6 cyber-panel"
          ref={scrollViewRef}
          style={{ borderLeft: '1px solid rgba(255, 183, 197, 0.2)' }}
        >
          {isDemo ? (
            <DemoPlayerList game={activeGame} setSelectedElement={setSelectedElement} selectedId={selectedElement?.id} />
          ) : (
            <SidePanelTabs
              worldId={worldId!}
              engineId={engineId!}
              game={activeGame}
              selectedElement={selectedElement}
              setSelectedElement={setSelectedElement}
              scrollViewRef={scrollViewRef}
            />
          )}
        </div>
      </div>
    </>
  );
}

/** Tabbed side panel: switch between player details and live conversation feed */
function SidePanelTabs({
  worldId,
  engineId,
  game,
  selectedElement,
  setSelectedElement,
  scrollViewRef,
}: {
  worldId: Id<'worlds'>;
  engineId: Id<'engines'>;
  game: ServerGame;
  selectedElement?: { kind: 'player'; id: GameId<'players'> };
  setSelectedElement: (element?: { kind: 'player'; id: GameId<'players'> }) => void;
  scrollViewRef: React.RefObject<HTMLDivElement>;
}) {
  const [activeTab, setActiveTab] = useState<'details' | 'feed' | 'items'>('feed');

  // If user selects a player, switch to details tab automatically
  const prevSelectedRef = useRef(selectedElement?.id);
  if (selectedElement?.id && selectedElement.id !== prevSelectedRef.current) {
    prevSelectedRef.current = selectedElement.id;
    if (activeTab !== 'details') {
      setActiveTab('details');
    }
  }

  const tabClass = (tab: string) =>
    `flex-1 py-2 text-xs text-center cursor-pointer transition-all rounded-t-lg font-display ${
      activeTab === tab
        ? 'text-pink-200 font-bold'
        : 'text-gray-500 hover:text-pink-400'
    }`;

  const activeTabStyle = (tab: string): React.CSSProperties =>
    activeTab === tab
      ? {
          background: 'linear-gradient(180deg, rgba(255,150,200,0.12) 0%, rgba(255,150,200,0.04) 100%)',
          borderBottom: '2px solid rgba(255,183,197,0.6)',
          borderTop: '1px solid rgba(255,183,197,0.2)',
          borderLeft: '1px solid rgba(255,183,197,0.1)',
          borderRight: '1px solid rgba(255,183,197,0.1)',
        }
      : {
          background: 'rgba(0, 0, 0, 0.15)',
          borderBottom: '2px solid transparent',
        };

  return (
    <div className="flex flex-col h-full">
      {/* Tab headers */}
      <div className="flex gap-1 mb-3">
        <button className={tabClass('feed')} style={activeTabStyle('feed')} onClick={() => setActiveTab('feed')}>
          <span className="flex items-center justify-center gap-1">
            <span>💬</span>
            <span>意识流</span>
          </span>
        </button>
        <button className={tabClass('items')} style={activeTabStyle('items')} onClick={() => setActiveTab('items')}>
          <span className="flex items-center justify-center gap-1">
            <span>🪄</span>
            <span>物品</span>
          </span>
        </button>
        <button className={tabClass('details')} style={activeTabStyle('details')} onClick={() => setActiveTab('details')}>
          <span className="flex items-center justify-center gap-1">
            <span>👤</span>
            <span>角色</span>
          </span>
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'feed' ? (
        <LiveConversationFeed worldId={worldId} />
      ) : activeTab === 'items' ? (
        <div className="flex flex-col gap-4 overflow-y-auto" style={{ maxHeight: '500px' }}>
          <ItemCreator worldId={worldId} />
          <div style={{ borderTop: '1px solid rgba(255,183,197,0.1)' }} className="pt-3">
            <WorldItems worldId={worldId} />
          </div>
        </div>
      ) : (
        <PlayerDetails
          worldId={worldId}
          engineId={engineId}
          game={game}
          playerId={selectedElement?.id}
          setSelectedElement={setSelectedElement}
          scrollViewRef={scrollViewRef}
        />
      )}
    </div>
  );
}

/** Simple player list for demo mode — no Convex queries needed */
function DemoPlayerList({
  game,
  setSelectedElement,
  selectedId,
}: {
  game: ReturnType<typeof createMockGame>;
  setSelectedElement: (element?: { kind: 'player'; id: GameId<'players'> }) => void;
  selectedId?: GameId<'players'>;
}) {
  const players = [...game.world.players.values()];
  const selectedPlayer = selectedId ? game.world.players.get(selectedId) : undefined;
  const selectedDesc = selectedId ? game.playerDescriptions.get(selectedId) : undefined;

  // Look up SYNAPSE faction info for selected character
  const selectedCharDesc = selectedDesc
    ? Descriptions.find((d) => d.name === selectedDesc.name || d.character === selectedDesc.character)
    : undefined;

  return (
    <div>
      <h2 className="text-lg font-bold font-display mb-2 text-pink-300">SYNAPSE 意识体</h2>
      <p className="text-xs opacity-50 mb-3 text-pink-200/60">点击角色查看详情</p>
      <div className="flex flex-col gap-2">
        {players.map((p) => {
          const desc = game.playerDescriptions.get(p.id);
          if (!desc) return null;
          const isSelected = selectedId === p.id;
          const charDesc = Descriptions.find((d) => d.name === desc.name || d.character === desc.character);
          const faction = charDesc ? FACTIONS[charDesc.faction] : null;

          return (
            <button
              key={p.id}
              className={`text-left px-3 py-2 rounded transition-colors ${
                isSelected
                  ? 'text-white'
                  : 'text-gray-300 hover:text-pink-200'
              }`}
              style={{
                background: isSelected ? 'rgba(255, 150, 200, 0.1)' : 'rgba(0, 0, 0, 0.2)',
                border: isSelected ? '1px solid rgba(255, 150, 200, 0.3)' : '1px solid transparent',
              }}
              onClick={() =>
                setSelectedElement(isSelected ? undefined : { kind: 'player', id: p.id })
              }
            >
              <div className="flex items-center gap-2">
                {faction && <span className="text-sm">{faction.icon}</span>}
                <span className="font-bold">{desc.name}</span>
                {charDesc && (
                  <span className="text-xs ml-auto px-2 py-0.5 rounded-full" style={{ background: 'rgba(0,0,0,0.3)', color: faction?.color ?? '#aaa' }}>
                    {charDesc.faction}
                  </span>
                )}
              </div>
              {charDesc && (
                <div className="text-xs opacity-60 mt-0.5 ml-6">{charDesc.title} · Lv.{charDesc.level}</div>
              )}
            </button>
          );
        })}
      </div>
      {selectedPlayer && selectedDesc && selectedCharDesc && (
        <div className="mt-4 p-3 rounded cyber-border" style={{ background: 'rgba(0, 0, 0, 0.3)' }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">{FACTIONS[selectedCharDesc.faction].icon}</span>
            <div>
              <h3 className="font-bold text-base">{selectedDesc.name}</h3>
              <p className="text-xs opacity-50">
                {selectedCharDesc.title} · Lv.{selectedCharDesc.level} · {selectedCharDesc.zone}
              </p>
            </div>
          </div>
          <div className="text-xs mb-2 px-2 py-1 rounded" style={{ background: 'rgba(0,0,0,0.3)', borderLeft: `3px solid ${FACTIONS[selectedCharDesc.faction].color}` }}>
            <span style={{ color: FACTIONS[selectedCharDesc.faction].color }}>{selectedCharDesc.faction}</span>
            <span className="opacity-60 ml-1">"{FACTIONS[selectedCharDesc.faction].motto}"</span>
          </div>
          <p className="text-sm text-brown-200 leading-relaxed">{selectedDesc.description}</p>
          <button
            className="mt-3 text-xs text-brown-400 hover:text-white"
            onClick={() => setSelectedElement(undefined)}
          >
            关闭
          </button>
        </div>
      )}
      {selectedPlayer && selectedDesc && !selectedCharDesc && (
        <div className="mt-4 p-3 rounded cyber-border" style={{ background: 'rgba(0, 0, 0, 0.3)' }}>
          <h3 className="font-bold text-base mb-2">{selectedDesc.name}</h3>
          <p className="text-sm text-brown-200 leading-relaxed">{selectedDesc.description}</p>
          <button
            className="mt-3 text-xs text-brown-400 hover:text-white"
            onClick={() => setSelectedElement(undefined)}
          >
            关闭
          </button>
        </div>
      )}
    </div>
  );
}
