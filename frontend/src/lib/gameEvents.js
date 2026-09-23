/**
 * Central catalog for major game events.
 *
 * Every event has a stable identity so the notification can be rendered
 * consistently and, later, paired with a sound without touching call sites.
 *
 * priority:
 *   "medium"   → prominent top banner (never blocks the board)
 *   "high"     → centre-screen event, dimmed backdrop
 *   "critical" → full dramatic centre-screen event
 *
 * Normal notifications (joins, reconnects, "vote recorded", …) deliberately
 * stay as react-hot-toast and never enter this queue.
 */
export const EVENT_KINDS = {
  eliminated: {
    icon: "☠",
    title: "PLAYER ELIMINATED",
    tone: "danger",
    priority: "high",
    sound: "killed",
  },
  votedOut: {
    icon: "⚖",
    title: "VOTED OUT",
    tone: "amber",
    priority: "high",
    sound: "voteKick",
  },
  removed: {
    icon: "🚪",
    title: "PLAYER REMOVED",
    tone: "danger",
    priority: "high",
    sound: null,
  },
  victimMarked: {
    icon: "🎯",
    title: "VICTIM MARKED",
    tone: "danger",
    priority: "high",
    sound: "select",
  },
  protected: {
    icon: "🛡️",
    title: "PROTECTION HELD",
    tone: "sky",
    priority: "medium",
    sound: "protected",
  },
  protectionSet: {
    icon: "🛡️",
    title: "SHIELD RAISED",
    tone: "sky",
    priority: "medium",
    sound: "select",
  },
  seerResult: {
    icon: "🔮",
    title: "THE VEIL PARTS",
    tone: "violet",
    priority: "medium",
    sound: null,
  },
  targeted: {
    icon: "⚠️",
    title: "YOU HAVE BEEN TARGETED",
    tone: "danger",
    priority: "high",
    sound: null,
  },
  gameOver: {
    icon: "✦",
    title: "GAME OVER",
    tone: "amber",
    priority: "critical",
    sound: "winner",
  },
};

export const PRIORITY_RANK = { medium: 1, high: 2, critical: 3 };

let sequence = 0;

/**
 * Build a queue-ready event from a kind plus optional server payload.
 * Returns null for unknown kinds so handlers can safely forward untrusted data.
 */
export function buildGameEvent(kind, { player = null, message = "", tone, priority } = {}) {
  const base = EVENT_KINDS[kind];
  if (!base) return null;

  return {
    id: `${kind}-${Date.now()}-${sequence++}`,
    kind,
    icon: base.icon,
    title: base.title,
    tone: tone || base.tone,
    priority: priority || base.priority,
    sound: base.sound,
    player,
    message,
  };
}
