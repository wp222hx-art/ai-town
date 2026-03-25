import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import { agentTables } from './agent/schema';
import { aiTownTables } from './aiTown/schema';
import { conversationId, playerId } from './aiTown/ids';
import { engineTables } from './engine/schema';

export default defineSchema({
  music: defineTable({
    storageId: v.string(),
    type: v.union(v.literal('background'), v.literal('player')),
  }),

  messages: defineTable({
    conversationId,
    messageUuid: v.string(),
    author: playerId,
    text: v.string(),
    worldId: v.optional(v.id('worlds')),
  })
    .index('conversationId', ['worldId', 'conversationId'])
    .index('messageUuid', ['conversationId', 'messageUuid']),

  // ======== Items System ========
  // Items created by users via AI, placed in the world for agents to discover
  items: defineTable({
    worldId: v.id('worlds'),
    name: v.string(),
    description: v.string(),
    emoji: v.string(),
    usage: v.string(), // How to use this item (AI-generated)
    creatorPrompt: v.string(), // Original user prompt
    position: v.object({ x: v.number(), y: v.number() }),
    // State: 'spawned' (on map), 'picked' (held by agent), 'used' (consumed/used)
    state: v.union(v.literal('spawned'), v.literal('picked'), v.literal('used')),
    ownerId: v.optional(playerId), // Which player/agent picked it up
    pickedAt: v.optional(v.number()),
    usedAt: v.optional(v.number()),
  })
    .index('worldId', ['worldId'])
    .index('worldState', ['worldId', 'state'])
    .index('owner', ['worldId', 'ownerId']),

  ...agentTables,
  ...aiTownTables,
  ...engineTables,
});
