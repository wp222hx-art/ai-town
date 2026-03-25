/**
 * Mock data for rendering the game without a Convex backend.
 * Provides a ServerGame object with map, players, and descriptions
 * so the PixiJS scene can render in demo/offline mode.
 */
import { World } from '../convex/aiTown/world';
import { WorldMap } from '../convex/aiTown/worldMap';
import { PlayerDescription } from '../convex/aiTown/playerDescription';
import { AgentDescription } from '../convex/aiTown/agentDescription';
import { GameId } from '../convex/aiTown/ids';
import { ServerGame } from './hooks/serverGame';
import { Descriptions } from '../data/characters';
import {
  tilesetpath,
  tiledim,
  tilesetpxw,
  tilesetpxh,
  bgtiles,
  objmap,
  animatedsprites,
  mapwidth,
  mapheight,
} from '../data/sakura_town.js';

// Pre-defined positions for demo players (open areas on the sakura town map, 32x18)
const demoPositions = [
  { x: 5, y: 5 },
  { x: 16, y: 4 },
  { x: 26, y: 6 },
  { x: 8, y: 10 },
  { x: 20, y: 9 },
  { x: 28, y: 12 },
  { x: 12, y: 14 },
  { x: 22, y: 14 },
  { x: 4, y: 8 },
  { x: 14, y: 7 },
  { x: 24, y: 11 },
  { x: 18, y: 15 },
];

const facingOptions = [
  { dx: 1, dy: 0 },
  { dx: -1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: 0, dy: -1 },
];

export function createMockGame(): ServerGame {
  const now = Date.now();

  // Build serialized players and descriptions from the active character Descriptions
  const serializedPlayers = Descriptions.map((desc, i) => ({
    id: `p:${i}` as GameId<'players'>,
    lastInput: now,
    position: demoPositions[i % demoPositions.length],
    facing: facingOptions[i % facingOptions.length],
    speed: 0,
  }));

  const serializedAgents = Descriptions.map((desc, i) => ({
    id: `a:${i}` as GameId<'agents'>,
    playerId: `p:${i}` as GameId<'players'>,
  }));

  const serializedWorld = {
    nextId: Descriptions.length + 1,
    conversations: [] as any[],
    players: serializedPlayers,
    agents: serializedAgents,
  };

  const world = new World(serializedWorld);

  // Build player descriptions map
  const playerDescriptions = new Map<GameId<'players'>, PlayerDescription>();
  for (let i = 0; i < Descriptions.length; i++) {
    const desc = Descriptions[i];
    const pd = new PlayerDescription({
      playerId: `p:${i}` as GameId<'players'>,
      name: desc.name,
      description: desc.identity,
      character: desc.character,
    });
    playerDescriptions.set(`p:${i}` as GameId<'players'>, pd);
  }

  // Build agent descriptions map
  const agentDescriptions = new Map<GameId<'agents'>, AgentDescription>();
  for (let i = 0; i < Descriptions.length; i++) {
    const desc = Descriptions[i];
    const ad = new AgentDescription({
      agentId: `a:${i}` as GameId<'agents'>,
      identity: desc.identity,
      plan: desc.plan,
    });
    agentDescriptions.set(`a:${i}` as GameId<'agents'>, ad);
  }

  // Build the world map from the gentle.js tile data
  const worldMap = new WorldMap({
    width: mapwidth,
    height: mapheight,
    tileSetUrl: tilesetpath,
    tileSetDimX: tilesetpxw,
    tileSetDimY: tilesetpxh,
    tileDim: tiledim,
    bgTiles: bgtiles,
    objectTiles: objmap,
    animatedSprites: animatedsprites,
  });

  return {
    world,
    playerDescriptions,
    agentDescriptions,
    worldMap,
  };
}
