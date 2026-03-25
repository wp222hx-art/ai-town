import { v } from 'convex/values';
import { internalAction } from '../_generated/server';
import { WorldMap, serializedWorldMap } from './worldMap';
import { rememberConversation } from '../agent/memory';
import { GameId, agentId, conversationId, playerId } from './ids';
import {
  continueConversationMessage,
  leaveConversationMessage,
  startConversationMessage,
} from '../agent/conversation';
import { assertNever } from '../util/assertNever';
import { serializedAgent } from './agent';
import { ACTIVITIES, ACTIVITY_COOLDOWN, CONVERSATION_COOLDOWN, ZONE_ACTIVITIES } from '../constants';
import { api, internal } from '../_generated/api';
import { sleep } from '../util/sleep';
import { serializedPlayer } from './player';
import { Descriptions } from '../../data/characters';

export const agentRememberConversation = internalAction({
  args: {
    worldId: v.id('worlds'),
    playerId,
    agentId,
    conversationId,
    operationId: v.string(),
  },
  handler: async (ctx, args) => {
    await rememberConversation(
      ctx,
      args.worldId,
      args.agentId as GameId<'agents'>,
      args.playerId as GameId<'players'>,
      args.conversationId as GameId<'conversations'>,
    );
    await sleep(Math.random() * 1000);
    await ctx.runMutation(api.aiTown.main.sendInput, {
      worldId: args.worldId,
      name: 'finishRememberConversation',
      args: {
        agentId: args.agentId,
        operationId: args.operationId,
      },
    });
  },
});

export const agentGenerateMessage = internalAction({
  args: {
    worldId: v.id('worlds'),
    playerId,
    agentId,
    conversationId,
    otherPlayerId: playerId,
    operationId: v.string(),
    type: v.union(v.literal('start'), v.literal('continue'), v.literal('leave')),
    messageUuid: v.string(),
  },
  handler: async (ctx, args) => {
    let completionFn;
    switch (args.type) {
      case 'start':
        completionFn = startConversationMessage;
        break;
      case 'continue':
        completionFn = continueConversationMessage;
        break;
      case 'leave':
        completionFn = leaveConversationMessage;
        break;
      default:
        assertNever(args.type);
    }
    const text = await completionFn(
      ctx,
      args.worldId,
      args.conversationId as GameId<'conversations'>,
      args.playerId as GameId<'players'>,
      args.otherPlayerId as GameId<'players'>,
    );

    await ctx.runMutation(internal.aiTown.agent.agentSendMessage, {
      worldId: args.worldId,
      conversationId: args.conversationId,
      agentId: args.agentId,
      playerId: args.playerId,
      text,
      messageUuid: args.messageUuid,
      leaveConversation: args.type === 'leave',
      operationId: args.operationId,
    });
  },
});

export const agentDoSomething = internalAction({
  args: {
    worldId: v.id('worlds'),
    player: v.object(serializedPlayer),
    agent: v.object(serializedAgent),
    map: v.object(serializedWorldMap),
    otherFreePlayers: v.array(v.object(serializedPlayer)),
    operationId: v.string(),
  },
  handler: async (ctx, args) => {
    const { player, agent } = args;
    const map = new WorldMap(args.map);
    const now = Date.now();

    // ======== Item pickup check ========
    // When an agent is idle, check if there are items nearby to pick up
    try {
      const playerDesc = await ctx.runQuery(internal.aiTown.game.getPlayerName, {
        worldId: args.worldId,
        playerId: player.id,
      });
      const pickedUp = await ctx.runMutation(internal.items.checkAndPickupNearby, {
        worldId: args.worldId,
        playerId: player.id,
        playerX: player.position.x,
        playerY: player.position.y,
        playerName: playerDesc ?? player.id,
      });
      if (pickedUp.length > 0) {
        // Agent found items! Do a special "using item" activity
        const item = pickedUp[0];
        await sleep(Math.random() * 500);
        await ctx.runMutation(api.aiTown.main.sendInput, {
          worldId: args.worldId,
          name: 'finishDoSomething',
          args: {
            operationId: args.operationId,
            agentId: agent.id,
            activity: {
              description: `发现了${item.emoji}${item.name}！正在学习使用：${item.usage}`,
              emoji: item.emoji,
              until: Date.now() + 15_000,
            },
          },
        });
        return;
      }
    } catch (e) {
      // Item check failed, continue with normal behavior
    }

    // ======== Normal agent behavior ========
    // Don't try to start a new conversation if we were just in one.
    const justLeftConversation =
      agent.lastConversation && now < agent.lastConversation + CONVERSATION_COOLDOWN;
    // Don't try again if we recently tried to find someone to invite.
    const recentlyAttemptedInvite =
      agent.lastInviteAttempt && now < agent.lastInviteAttempt + CONVERSATION_COOLDOWN;
    const recentActivity = player.activity && now < player.activity.until + ACTIVITY_COOLDOWN;
    // Decide whether to do an activity or wander somewhere.
    if (!player.pathfinding) {
      if (recentActivity || justLeftConversation) {
        // 30% chance to walk toward a spawned item instead of random wandering
        let destination = wanderDestination(map);
        try {
          const spawnedItems = await ctx.runQuery(internal.items.getSpawnedPositions, {
            worldId: args.worldId,
          });
          if (spawnedItems.length > 0 && Math.random() < 0.3) {
            const target = spawnedItems[Math.floor(Math.random() * spawnedItems.length)];
            destination = { x: target.x, y: target.y };
            console.log(`🎯 Agent ${player.id} walking toward item ${target.emoji}${target.name} at (${target.x}, ${target.y})`);
          }
        } catch {}
        await sleep(Math.random() * 1000);
        await ctx.runMutation(api.aiTown.main.sendInput, {
          worldId: args.worldId,
          name: 'finishDoSomething',
          args: {
            operationId: args.operationId,
            agentId: agent.id,
            destination,
          },
        });
        return;
      } else {
        // Choose activity based on character's zone (if we can identify them)
        const activity = pickActivityForAgent(player as any);
        await sleep(Math.random() * 1000);
        await ctx.runMutation(api.aiTown.main.sendInput, {
          worldId: args.worldId,
          name: 'finishDoSomething',
          args: {
            operationId: args.operationId,
            agentId: agent.id,
            activity: {
              description: activity.description,
              emoji: activity.emoji,
              until: Date.now() + activity.duration,
            },
          },
        });
        return;
      }
    }
    const invitee =
      justLeftConversation || recentlyAttemptedInvite
        ? undefined
        : await ctx.runQuery(internal.aiTown.agent.findConversationCandidate, {
            now,
            worldId: args.worldId,
            player: args.player,
            otherFreePlayers: args.otherFreePlayers,
          });

    // TODO: We hit a lot of OCC errors on sending inputs in this file. It's
    // easy for them to get scheduled at the same time and line up in time.
    await sleep(Math.random() * 1000);
    await ctx.runMutation(api.aiTown.main.sendInput, {
      worldId: args.worldId,
      name: 'finishDoSomething',
      args: {
        operationId: args.operationId,
        agentId: args.agent.id,
        invitee,
      },
    });
  },
});

function wanderDestination(worldMap: WorldMap) {
  // Wander someonewhere at least one tile away from the edge.
  return {
    x: 1 + Math.floor(Math.random() * (worldMap.width - 2)),
    y: 1 + Math.floor(Math.random() * (worldMap.height - 2)),
  };
}

/** Pick an activity for this agent based on their character's zone */
function pickActivityForAgent(player: { character?: string }) {
  // Match character ID to Description to get zone
  if (player.character) {
    const desc = Descriptions.find((d) => d.character === player.character);
    if (desc) {
      const zoneActivities = ZONE_ACTIVITIES[desc.zone];
      if (zoneActivities && zoneActivities.length > 0) {
        // 70% chance to pick zone-specific activity, 30% generic
        if (Math.random() < 0.7) {
          return zoneActivities[Math.floor(Math.random() * zoneActivities.length)];
        }
      }
    }
  }
  // Fallback: generic activity
  return ACTIVITIES[Math.floor(Math.random() * ACTIVITIES.length)];
}
