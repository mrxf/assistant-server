export const AGENT_ID = 'xiaoman';

/**
 * `InboxEvent.source` used for system-reported events (主动推送的触发事件)。
 *
 * Shared between the event runner (which stamps it on the event) and the
 * dialogue store (which uses it to keep the raw event text out of history).
 * Keep the two in sync via this single constant.
 */
export const GAME_SYSTEM_SOURCE = 'system-event';

export const INITIAL_RELATIONSHIP = {
  trustLevel: 30,
  cooperationLevel: 50,
  affinity: 20,
  speakingStyle: '温和亲切，乐于帮忙',
};

export const FIRST_GREETING =
  '你好呀，我是小满，你的生活助理～ 育儿、家务还是生活上的小事，都可以问我。';
