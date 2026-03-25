import { v } from 'convex/values';
import { Id } from '../_generated/dataModel';
import { ActionCtx, internalQuery } from '../_generated/server';
import { LLMMessage, chatCompletion } from '../util/llm';
import * as memory from './memory';
import { api, internal } from '../_generated/api';
import * as embeddingsCache from './embeddingsCache';
import { GameId, conversationId, playerId } from '../aiTown/ids';
import { NUM_MEMORIES_TO_SEARCH } from '../constants';

// ============================================================
// SYNAPSE 世界观 — 精简版，只提供足够的背景不喧宾夺主
// ============================================================
const SYNAPSE_WORLD_CONTEXT = `你在SYNAPSE像素小镇散步。2160年，数字意识文明。
小镇有商人、艺术家、哲学家、冒险者，像邻居一样街头闲聊。
三派共存：自由联盟、融合派、原生派。樱花街道、暖灯、热闹集市。`;

// ============================================================
// 自然对话风格指南 — 关键！让AI不再像机器人
// ============================================================
const NATURAL_DIALOGUE_GUIDE = `【核心：你是活生生的人！】
像微信跟好朋友聊天那样说话，短句为主：
- 口语化，有烟火气："哎呀"、"嘿"、"哈哈"、"嗯…"、"诶？"
- 可以吐槽、调侃、撒娇、耍赖、八卦
- 有情绪起伏：惊喜、好奇、得意、害羞、无奈、感动
- 聊日常：天气、吃的、趣事、八卦、小烦恼、最近的心情
- emoji最多1个，可以不用
- 禁止：技术术语(区块链/哈希/合约/协议/签名/链上)、编号列表、商务语气
- 像在街头偶遇老朋友随便聊几句 🌸`;

const FACTION_CHAT_VIBES: Record<string, string> = {
  '自由联盟': '说话爽快带劲，爱聊八卦和谁又发财了，偶尔吹牛，嘴甜但精明。',
  '融合派': '好奇心重的理科话唠，冷不丁蹦个冷知识，讲话有条理但不无聊，偶尔犯书呆子气。',
  '原生派': '文艺范儿，说话带诗意，爱用比喻，容易被小事感动，浪漫但不矫情。',
  '中立': '暖心邻家感，爱操心别人的事，什么都能聊两句，偶尔神秘兮兮透露小道消息。',
};

/** 根据角色identity中的关键词推断派系 */
function inferFaction(identity: string): string {
  if (identity.includes('自由联盟') || identity.includes('交易') || identity.includes('商人')) return '自由联盟';
  if (identity.includes('融合派') || identity.includes('融合') || identity.includes('科学家') || identity.includes('指挥官')) return '融合派';
  if (identity.includes('原生派') || identity.includes('艺术') || identity.includes('贤者')) return '原生派';
  return '中立';
}

/** 随机选一个有趣的开场场景 */
function randomEncounterContext(): string {
  const scenarios = [
    '你们在飘着花瓣的樱花树下碰上了',
    '你在集市的鲷鱼烧摊前排队时，回头发现对方就在后面',
    '你们在石板路上差点撞到对方',
    '你坐在长椅上发呆，对方忽然在旁边坐下',
    '你端着茶从茶馆出来，差点泼到对方身上',
    '你们在图书馆门口为了让门互相鞠躬',
    '午后的阳光暖洋洋的，你散步时看到对方在路边蹲着逗猫',
    '你在街角等人，发现路灯下站着的居然是对方',
    '黄昏的小桥上，你们不约而同停下来看夕阳',
    '你正仰头数樱花瓣，被叫了一声吓了一跳',
    '你刚买了章鱼烧，对方闻到香味凑了过来',
    '你们同时伸手去拿书架上同一本书',
  ];
  return scenarios[Math.floor(Math.random() * scenarios.length)];
}

/** 随机一个有趣的话题提示 */
function randomTopicHint(): string {
  const topics = [
    '跟对方分享你刚看到的一件小趣事',
    '随口问问对方今天过得咋样',
    '八卦一下镇上谁跟谁最近走得近',
    '推荐你刚吃到的某样好吃的',
    '聊聊你刚发现的一个有意思的角落',
    '吐槽一下最近遇到的小倒霉',
    '夸夸对方今天看起来不一样',
    '分享你做的一个奇怪的梦',
    '问问对方有没有推荐的消磨时间的去处',
    '感叹一下樱花季真的好美',
    '跟对方说你刚听到一个好笑的八卦',
    '随便聊聊最近让你开心的一件小事',
  ];
  return topics[Math.floor(Math.random() * topics.length)];
}

/** 给对话加入随机情绪色彩 */
function randomMoodHint(): string {
  const moods = [
    '你今天心情超好',
    '你刚吃了好吃的，整个人暖洋洋的',
    '你有点犯困但遇到人就精神了',
    '你正好在想一件搞笑的事',
    '你今天特别话多',
    '你心情不错，想找人分享',
    '你刚经历了一件小事，正想跟人吐槽',
    '你闲得发慌，正好遇到了人',
    '你有点小八卦想说',
    '你刚被樱花瓣砸到头，觉得好笑',
  ];
  return moods[Math.floor(Math.random() * moods.length)];
}

const selfInternal = internal.agent.conversation;

/** Fetch items held by this player and format as prompt context */
async function getItemContext(ctx: ActionCtx, worldId: Id<'worlds'>, playerId: GameId<'players'>): Promise<string[]> {
  try {
    const items = await ctx.runQuery(internal.items.getAgentItems, { worldId, playerId });
    if (items.length === 0) return [];
    const lines = [`（你身上带着这些物品：）`];
    for (const item of items.slice(0, 3)) {
      lines.push(`- ${item.emoji} ${item.name}：${item.usage}`);
    }
    lines.push(`可以自然地提到你的物品，比如给对方看、分享、或者聊聊它。`);
    return lines;
  } catch {
    return [];
  }
}

export async function startConversationMessage(
  ctx: ActionCtx,
  worldId: Id<'worlds'>,
  conversationId: GameId<'conversations'>,
  playerId: GameId<'players'>,
  otherPlayerId: GameId<'players'>,
): Promise<string> {
  const { player, otherPlayer, agent, otherAgent, lastConversation } = await ctx.runQuery(
    selfInternal.queryPromptData,
    {
      worldId,
      playerId,
      otherPlayerId,
      conversationId,
    },
  );
  const embedding = await embeddingsCache.fetch(
    ctx,
    `${player.name} is talking to ${otherPlayer.name}`,
  );

  const memories = await memory.searchMemories(
    ctx,
    player.id as GameId<'players'>,
    embedding,
    Number(process.env.NUM_MEMORIES_TO_SEARCH) || NUM_MEMORIES_TO_SEARCH,
  );

  const memoryWithOtherPlayer = memories.find(
    (m) => m.data.type === 'conversation' && m.data.playerIds.includes(otherPlayerId),
  );
  const faction = agent ? inferFaction(agent.identity) : '中立';
  const factionVibe = FACTION_CHAT_VIBES[faction] ?? FACTION_CHAT_VIBES['中立'];

  const prompt = [
    SYNAPSE_WORLD_CONTEXT,
    ``,
    NATURAL_DIALOGUE_GUIDE,
    ``,
    `你是"${player.name}"。${agent ? briefIdentity(agent.identity) : ''}`,
    `你的说话风格：${factionVibe}`,
    ``,
    `场景：${randomEncounterContext()}，你碰到了"${otherPlayer.name}"。${randomMoodHint()}。`,
  ];

  if (otherAgent) {
    prompt.push(`（${otherPlayer.name}是${briefOtherDesc(otherAgent.identity)}）`);
  }

  prompt.push(...previousConversationPrompt(otherPlayer, lastConversation));
  prompt.push(...relatedMemoriesPrompt(memories));
  prompt.push(...await getItemContext(ctx, worldId, playerId as GameId<'players'>));

  if (memoryWithOtherPlayer) {
    prompt.push(`你们之前聊过天，可以自然地提一嘴上次的话题。`);
  }

  prompt.push(``);
  prompt.push(`话题灵感：${randomTopicHint()}`);
  prompt.push(`直接开口说话，一两句，不超过60字。语气像发微信语音那么随意。`);

  const { content } = await chatCompletion({
    messages: [
      {
        role: 'system',
        content: prompt.join('\n'),
      },
    ],
    max_tokens: 2000,
    temperature: 0.9,
    presence_penalty: 0.6,
    frequency_penalty: 0.3,
    stop: stopWords(otherPlayer.name, player.name),
  });
  const lastPrompt = `${player.name} 对 ${otherPlayer.name} 说:`;
  return trimContentPrefx(content, lastPrompt);
}

/** 从长identity中提取简短人设（一句话） */
function briefIdentity(identity: string): string {
  // 取identity的前80个字就够了，给AI一个印象就好
  const short = identity.slice(0, 100);
  const lastPeriod = short.lastIndexOf('。');
  return lastPeriod > 20 ? short.slice(0, lastPeriod + 1) : short + '...';
}

/** 简短描述对方 */
function briefOtherDesc(identity: string): string {
  const short = identity.slice(0, 60);
  const lastPeriod = short.lastIndexOf('。');
  return lastPeriod > 10 ? short.slice(0, lastPeriod + 1) : short + '...';
}

function trimContentPrefx(content: string, prompt: string) {
  let result = content;
  if (result.startsWith(prompt)) {
    result = result.slice(prompt.length);
  }
  // 去掉可能的引号和角色名前缀
  result = result.replace(/^[「"'"]+/, '').replace(/[」"'"]+$/, '');
  result = result.trim();
  return result;
}

export async function continueConversationMessage(
  ctx: ActionCtx,
  worldId: Id<'worlds'>,
  conversationId: GameId<'conversations'>,
  playerId: GameId<'players'>,
  otherPlayerId: GameId<'players'>,
): Promise<string> {
  const { player, otherPlayer, conversation, agent, otherAgent } = await ctx.runQuery(
    selfInternal.queryPromptData,
    {
      worldId,
      playerId,
      otherPlayerId,
      conversationId,
    },
  );
  const now = Date.now();
  const started = new Date(conversation.created);
  const embedding = await embeddingsCache.fetch(
    ctx,
    `What do you think about ${otherPlayer.name}?`,
  );
  const memories = await memory.searchMemories(ctx, player.id as GameId<'players'>, embedding, 3);
  const faction = agent ? inferFaction(agent.identity) : '中立';
  const factionVibe = FACTION_CHAT_VIBES[faction] ?? FACTION_CHAT_VIBES['中立'];

  const prompt = [
    SYNAPSE_WORLD_CONTEXT,
    ``,
    NATURAL_DIALOGUE_GUIDE,
    ``,
    `你是"${player.name}"，正在和"${otherPlayer.name}"聊天。`,
    `你的说话风格：${factionVibe}`,
    agent ? `（你的背景：${briefIdentity(agent.identity)}）` : '',
    ``,
    ...relatedMemoriesPrompt(memories),
    ...await getItemContext(ctx, worldId, playerId as GameId<'players'>),
    ``,
    `【接话要诀】`,
    `- 回应对方刚说的，让人感觉你在认真听`,
    `- 追问细节、接梗、甩个新话题都行`,
    `- 有共鸣就表达，不同意就友善吐槽`,
    `- 一两句话，不超过60字，要有情绪`,
    ``,
    `以下是你们的对话：`,
  ];

  const llmMessages: LLMMessage[] = [
    {
      role: 'system',
      content: prompt.join('\n'),
    },
    ...(await previousMessages(
      ctx,
      worldId,
      player,
      otherPlayer,
      conversation.id as GameId<'conversations'>,
    )),
  ];
  llmMessages.push({ role: 'user', content: `（${player.name}接话，一句就好，不超过60字，要有情绪反应）` });

  const { content } = await chatCompletion({
    messages: llmMessages,
    max_tokens: 2000,
    temperature: 0.9,
    presence_penalty: 0.6,
    frequency_penalty: 0.4,
    stop: stopWords(otherPlayer.name, player.name),
  });
  const lastPrompt = `${player.name} 对 ${otherPlayer.name} 说:`;
  return trimContentPrefx(content, lastPrompt);
}

export async function leaveConversationMessage(
  ctx: ActionCtx,
  worldId: Id<'worlds'>,
  conversationId: GameId<'conversations'>,
  playerId: GameId<'players'>,
  otherPlayerId: GameId<'players'>,
): Promise<string> {
  const { player, otherPlayer, conversation, agent, otherAgent } = await ctx.runQuery(
    selfInternal.queryPromptData,
    {
      worldId,
      playerId,
      otherPlayerId,
      conversationId,
    },
  );
  const faction = agent ? inferFaction(agent.identity) : '中立';
  const factionVibe = FACTION_CHAT_VIBES[faction] ?? FACTION_CHAT_VIBES['中立'];

  const prompt = [
    SYNAPSE_WORLD_CONTEXT,
    ``,
    NATURAL_DIALOGUE_GUIDE,
    ``,
    `你是"${player.name}"，正和"${otherPlayer.name}"聊天，但你要走了。`,
    `你的说话风格：${factionVibe}`,
    ``,
    `随口说声再见，可以留个悬念、约个下次、或甩个俏皮话。不超过40字。`,
    ``,
    `以下是你们的对话：`,
  ];

  const llmMessages: LLMMessage[] = [
    {
      role: 'system',
      content: prompt.join('\n'),
    },
    ...(await previousMessages(
      ctx,
      worldId,
      player,
      otherPlayer,
      conversation.id as GameId<'conversations'>,
    )),
  ];
  llmMessages.push({ role: 'user', content: `（${player.name}要走了，说句告别的话）` });

  const { content } = await chatCompletion({
    messages: llmMessages,
    max_tokens: 2000,
    temperature: 0.85,
    presence_penalty: 0.5,
    stop: stopWords(otherPlayer.name, player.name),
  });
  const lastPrompt = `${player.name} 对 ${otherPlayer.name} 说:`;
  return trimContentPrefx(content, lastPrompt);
}

function agentPrompts(
  otherPlayer: { name: string },
  agent: { identity: string; plan: string } | null,
  otherAgent: { identity: string; plan: string } | null,
): string[] {
  const prompt = [];
  if (agent) {
    prompt.push(`【你的身份简介】${briefIdentity(agent.identity)}`);
  }
  if (otherAgent) {
    prompt.push(`【对方】${otherPlayer.name}——${briefOtherDesc(otherAgent.identity)}`);
  }
  return prompt;
}

function previousConversationPrompt(
  otherPlayer: { name: string },
  conversation: { created: number } | null,
): string[] {
  const prompt = [];
  if (conversation) {
    prompt.push(`你和${otherPlayer.name}之前聊过天，是老朋友了。`);
  }
  return prompt;
}

function relatedMemoriesPrompt(memories: memory.Memory[]): string[] {
  const prompt = [];
  if (memories.length > 0) {
    prompt.push(`（你脑海中想到的一些事：）`);
    for (const m of memories.slice(0, 2)) {
      // 只取2条，别太多
      const desc = m.description.length > 60 ? m.description.slice(0, 60) + '...' : m.description;
      prompt.push(`- ${desc}`);
    }
  }
  return prompt;
}

async function previousMessages(
  ctx: ActionCtx,
  worldId: Id<'worlds'>,
  player: { id: string; name: string },
  otherPlayer: { id: string; name: string },
  conversationId: GameId<'conversations'>,
) {
  const llmMessages: LLMMessage[] = [];
  const prevMessages = await ctx.runQuery(api.messages.listMessages, { worldId, conversationId });
  for (const message of prevMessages) {
    const isMe = message.author === player.id;
    llmMessages.push({
      role: isMe ? 'assistant' : 'user',
      content: message.text,
    });
  }
  return llmMessages;
}

export const queryPromptData = internalQuery({
  args: {
    worldId: v.id('worlds'),
    playerId,
    otherPlayerId: playerId,
    conversationId,
  },
  handler: async (ctx, args) => {
    const world = await ctx.db.get(args.worldId);
    if (!world) {
      throw new Error(`World ${args.worldId} not found`);
    }
    const player = world.players.find((p) => p.id === args.playerId);
    if (!player) {
      throw new Error(`Player ${args.playerId} not found`);
    }
    const playerDescription = await ctx.db
      .query('playerDescriptions')
      .withIndex('worldId', (q) => q.eq('worldId', args.worldId).eq('playerId', args.playerId))
      .first();
    if (!playerDescription) {
      throw new Error(`Player description for ${args.playerId} not found`);
    }
    const otherPlayer = world.players.find((p) => p.id === args.otherPlayerId);
    if (!otherPlayer) {
      throw new Error(`Player ${args.otherPlayerId} not found`);
    }
    const otherPlayerDescription = await ctx.db
      .query('playerDescriptions')
      .withIndex('worldId', (q) => q.eq('worldId', args.worldId).eq('playerId', args.otherPlayerId))
      .first();
    if (!otherPlayerDescription) {
      throw new Error(`Player description for ${args.otherPlayerId} not found`);
    }
    const conversation = world.conversations.find((c) => c.id === args.conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${args.conversationId} not found`);
    }
    const agent = world.agents.find((a) => a.playerId === args.playerId);
    if (!agent) {
      throw new Error(`Player ${args.playerId} not found`);
    }
    const agentDescription = await ctx.db
      .query('agentDescriptions')
      .withIndex('worldId', (q) => q.eq('worldId', args.worldId).eq('agentId', agent.id))
      .first();
    if (!agentDescription) {
      throw new Error(`Agent description for ${agent.id} not found`);
    }
    const otherAgent = world.agents.find((a) => a.playerId === args.otherPlayerId);
    let otherAgentDescription;
    if (otherAgent) {
      otherAgentDescription = await ctx.db
        .query('agentDescriptions')
        .withIndex('worldId', (q) => q.eq('worldId', args.worldId).eq('agentId', otherAgent.id))
        .first();
      if (!otherAgentDescription) {
        throw new Error(`Agent description for ${otherAgent.id} not found`);
      }
    }
    const lastTogether = await ctx.db
      .query('participatedTogether')
      .withIndex('edge', (q) =>
        q
          .eq('worldId', args.worldId)
          .eq('player1', args.playerId)
          .eq('player2', args.otherPlayerId),
      )
      // Order by conversation end time descending.
      .order('desc')
      .first();

    let lastConversation = null;
    if (lastTogether) {
      lastConversation = await ctx.db
        .query('archivedConversations')
        .withIndex('worldId', (q) =>
          q.eq('worldId', args.worldId).eq('id', lastTogether.conversationId),
        )
        .first();
      if (!lastConversation) {
        throw new Error(`Conversation ${lastTogether.conversationId} not found`);
      }
    }
    return {
      player: { name: playerDescription.name, ...player },
      otherPlayer: { name: otherPlayerDescription.name, ...otherPlayer },
      conversation,
      agent: { identity: agentDescription.identity, plan: agentDescription.plan, ...agent },
      otherAgent: otherAgent && {
        identity: otherAgentDescription!.identity,
        plan: otherAgentDescription!.plan,
        ...otherAgent,
      },
      lastConversation,
    };
  },
});

function stopWords(otherPlayer: string, player: string) {
  // These are the words we ask the LLM to stop on. OpenAI only supports 4.
  const variants = [
    `${otherPlayer} 对 ${player}`,
    `${otherPlayer} to ${player}`,
  ];
  return variants.flatMap((stop) => [stop + ':', stop + ' 说:']);
}
