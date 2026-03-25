import { v } from 'convex/values';
import { action, mutation, query, internalMutation, internalQuery } from './_generated/server';
import { chatCompletion } from './util/llm';
import { internal } from './_generated/api';
import { Id } from './_generated/dataModel';

// ============================================================
// 物品系统 — 用户通过提示词创造物品，AI角色拾取并学会使用
// ============================================================

const ITEM_PICKUP_DISTANCE = 1.5; // tiles

/** AI generates an item from user's prompt */
export const generateItem = action({
  args: {
    worldId: v.id('worlds'),
    prompt: v.string(),
  },
  handler: async (ctx, args): Promise<{ itemId: Id<'items'>; name: string; emoji: string; description: string; usage: string; position: { x: number; y: number } }> => {
    const { content } = await chatCompletion({
      messages: [
        {
          role: 'system',
          content: `你是SYNAPSE像素小镇的物品创造师。用户给你一个提示词，你创造一个有趣的物品。
严格返回JSON（不要markdown代码块）：
{
  "name": "物品名（2-6字，有创意）",
  "emoji": "一个代表物品的emoji",
  "description": "物品描述（20-40字，有趣）",
  "usage": "使用方法（15-30字，具体可操作）"
}
物品要有想象力，适合像素小镇。可以是食物、工具、玩具、魔法道具、装饰品等。`,
        },
        {
          role: 'user',
          content: `创造一个物品：${args.prompt}`,
        },
      ],
      max_tokens: 2000,
      temperature: 1.0,
    });

    let item;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found');
      item = JSON.parse(jsonMatch[0]);
    } catch (e) {
      item = {
        name: args.prompt.slice(0, 6) || '神秘物品',
        emoji: '✨',
        description: `由"${args.prompt}"灵感创造的神秘物品`,
        usage: '拿在手里感受它的能量',
      };
    }

    const name = String(item.name || '神秘物品').slice(0, 20);
    const emoji = String(item.emoji || '✨').slice(0, 4);
    const description = String(item.description || '一个神秘的物品').slice(0, 100);
    const usage = String(item.usage || '感受它的能量').slice(0, 80);

    // Get map size for random spawn
    const mapSize = await ctx.runQuery(internal.items.getMapSize, { worldId: args.worldId });
    const x = 2 + Math.floor(Math.random() * Math.max(1, mapSize.width - 4));
    const y = 2 + Math.floor(Math.random() * Math.max(1, mapSize.height - 4));

    const itemId: Id<'items'> = await ctx.runMutation(internal.items.insertItem, {
      worldId: args.worldId,
      name,
      description,
      emoji,
      usage,
      creatorPrompt: args.prompt,
      position: { x, y },
    });

    return { itemId, name, emoji, description, usage, position: { x, y } };
  },
});

// ======== Internal helpers (called from action) ========

export const getMapSize = internalQuery({
  args: { worldId: v.id('worlds') },
  handler: async (ctx, args) => {
    const map = await ctx.db
      .query('maps')
      .withIndex('worldId', (q) => q.eq('worldId', args.worldId))
      .first();
    return { width: map?.width ?? 32, height: map?.height ?? 18 };
  },
});

export const insertItem = internalMutation({
  args: {
    worldId: v.id('worlds'),
    name: v.string(),
    description: v.string(),
    emoji: v.string(),
    usage: v.string(),
    creatorPrompt: v.string(),
    position: v.object({ x: v.number(), y: v.number() }),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('items', {
      ...args,
      state: 'spawned' as const,
    });
  },
});

// ======== Public queries ========

/** Get all items in a world (for map rendering) */
export const listItems = query({
  args: { worldId: v.id('worlds') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('items')
      .withIndex('worldId', (q) => q.eq('worldId', args.worldId))
      .collect();
  },
});

/** Get items owned by a specific player */
export const playerItems = query({
  args: {
    worldId: v.id('worlds'),
    playerId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('items')
      .withIndex('owner', (q) => q.eq('worldId', args.worldId).eq('ownerId', args.playerId))
      .collect();
  },
});

// ======== Item pickup (called from agent tick) ========

/** Check and pickup nearby items for a player */
export const checkAndPickupNearby = internalMutation({
  args: {
    worldId: v.id('worlds'),
    playerId: v.string(),
    playerX: v.number(),
    playerY: v.number(),
    playerName: v.string(),
  },
  handler: async (ctx, args) => {
    const spawned = await ctx.db
      .query('items')
      .withIndex('worldState', (q) => q.eq('worldId', args.worldId).eq('state', 'spawned'))
      .collect();

    const pickedUp = [];
    for (const item of spawned) {
      const dx = item.position.x - args.playerX;
      const dy = item.position.y - args.playerY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < ITEM_PICKUP_DISTANCE) {
        await ctx.db.patch(item._id, {
          state: 'picked' as const,
          ownerId: args.playerId,
          pickedAt: Date.now(),
        });
        pickedUp.push({ name: item.name, emoji: item.emoji, usage: item.usage });
        console.log(`🎒 ${args.playerName} 拾取了 ${item.emoji} ${item.name}！`);
      }
    }
    return pickedUp;
  },
});

/** Agent uses an item and learns about it */
export const agentUseItem = internalMutation({
  args: {
    worldId: v.id('worlds'),
    playerId: v.string(),
    itemId: v.id('items'),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.itemId);
    if (!item || item.state !== 'picked' || item.ownerId !== args.playerId) return null;
    await ctx.db.patch(args.itemId, {
      state: 'used' as const,
      usedAt: Date.now(),
    });
    return { name: item.name, emoji: item.emoji, description: item.description, usage: item.usage };
  },
});

/** Get picked (not yet used) items for a player - used by agent operations */
export const getAgentItems = internalQuery({
  args: {
    worldId: v.id('worlds'),
    playerId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('items')
      .withIndex('owner', (q) => q.eq('worldId', args.worldId).eq('ownerId', args.playerId))
      .filter((q) => q.eq(q.field('state'), 'picked'))
      .collect();
  },
});

/** Get positions of spawned items (for agent pathfinding toward items) */
export const getSpawnedPositions = internalQuery({
  args: { worldId: v.id('worlds') },
  handler: async (ctx, args) => {
    const items = await ctx.db
      .query('items')
      .withIndex('worldState', (q) => q.eq('worldId', args.worldId).eq('state', 'spawned'))
      .collect();
    return items.map((i) => ({ x: i.position.x, y: i.position.y, name: i.name, emoji: i.emoji }));
  },
});
