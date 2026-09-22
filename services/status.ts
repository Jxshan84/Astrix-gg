import {
  ActivityType,
  Client,
  PresenceStatusData,
} from "discord.js";

export type AstrixActivityType =
  | ActivityType.Playing
  | ActivityType.Watching
  | ActivityType.Listening
  | ActivityType.Competing
  | ActivityType.Streaming;

export interface AstrixStatus {
  type: AstrixActivityType;
  text: string;
  url?: string;
}

export interface AstrixStatusConfig {
  interval?: number;
  shuffle?: boolean;
  rotatePresence?: boolean;
  presenceStatuses?: PresenceStatusData[];
  streamingUrl?: string;
}

export const DEFAULT_INTERVAL = 30_000;

export const DEFAULT_STREAMING_URL =
  "https://twitch.tv/jxshan84";

export const DEFAULT_PRESENCE_STATUSES: PresenceStatusData[] = [
  "online",
  "idle",
  "dnd",
];

/**
 * ============================================================
 * ASTRIX STATUS DATABASE
 * ============================================================
 *
 * Part 1 contains the main Astrix, server, security,
 * moderation, economy and premium activities.
 *
 * Part 2 continues the same array and contains the manager.
 */

export const ASTRIX_STATUSES: AstrixStatus[] = [
  // ==========================================================
  // ASTRIX
  // ==========================================================

  {
    type: ActivityType.Playing,
    text: "Astrix • At Your Service",
  },
  {
    type: ActivityType.Playing,
    text: "Astrix • Beyond Expectations",
  },
  {
    type: ActivityType.Playing,
    text: "Astrix • Command With Elegance",
  },
  {
    type: ActivityType.Playing,
    text: "Astrix • Excellence In Every Command",
  },
  {
    type: ActivityType.Playing,
    text: "Astrix • Crafted For Communities",
  },
  {
    type: ActivityType.Playing,
    text: "Astrix • Power, Refined",
  },
  {
    type: ActivityType.Playing,
    text: "Astrix • Built Around You",
  },
  {
    type: ActivityType.Playing,
    text: "Astrix • Your Digital Concierge",
  },
  {
    type: ActivityType.Playing,
    text: "Astrix • The Premium Standard",
  },
  {
    type: ActivityType.Playing,
    text: "Astrix • Designed For Discord",
  },
  {
    type: ActivityType.Playing,
    text: "Astrix • Command At Your Fingertips",
  },
  {
    type: ActivityType.Playing,
    text: "Astrix • Precision In Every Command",
  },
  {
    type: ActivityType.Playing,
    text: "Astrix • Your Community, Elevated",
  },
  {
    type: ActivityType.Playing,
    text: "Astrix • The House Is Open",
  },
  {
    type: ActivityType.Playing,
    text: "Astrix • Where Power Meets Precision",
  },

  // ==========================================================
  // SERVER / COMMUNITY
  // ==========================================================

  {
    type: ActivityType.Watching,
    text: "Over Your Community",
  },
  {
    type: ActivityType.Watching,
    text: "Over Your Digital Estate",
  },
  {
    type: ActivityType.Watching,
    text: "Your Server",
  },
  {
    type: ActivityType.Watching,
    text: "Your Community",
  },
  {
    type: ActivityType.Watching,
    text: "The Community Lounge",
  },
  {
    type: ActivityType.Watching,
    text: "Your Server's Finest Moments",
  },
  {
    type: ActivityType.Watching,
    text: "The Community Floor",
  },
  {
    type: ActivityType.Watching,
    text: "Your Server's Inner Circle",
  },
  {
    type: ActivityType.Watching,
    text: "The Astrix Estate",
  },
  {
    type: ActivityType.Watching,
    text: "Your Community's Next Move",
  },
  {
    type: ActivityType.Watching,
    text: "The House Rules",
  },
  {
    type: ActivityType.Watching,
    text: "Your Server, In Style",
  },
  {
    type: ActivityType.Watching,
    text: "The Community Experience",
  },
  {
    type: ActivityType.Watching,
    text: "Your Digital Community",
  },
  {
    type: ActivityType.Watching,
    text: "The Server Lounge",
  },

  // ==========================================================
  // SECURITY / MODERATION
  // ==========================================================

  {
    type: ActivityType.Watching,
    text: "Guarding Your Digital Estate",
  },
  {
    type: ActivityType.Watching,
    text: "Security Without Compromise",
  },
  {
    type: ActivityType.Watching,
    text: "Keeping The House Secure",
  },
  {
    type: ActivityType.Watching,
    text: "Over The Security Desk",
  },
  {
    type: ActivityType.Watching,
    text: "Your Community's Security",
  },
  {
    type: ActivityType.Playing,
    text: "Precision Meets Protection",
  },
  {
    type: ActivityType.Playing,
    text: "Protecting What Matters",
  },
  {
    type: ActivityType.Playing,
    text: "Keeping The Empire Secure",
  },
  {
    type: ActivityType.Playing,
    text: "Security, Perfected",
  },
  {
    type: ActivityType.Playing,
    text: "The Watch Never Ends",
  },
  {
    type: ActivityType.Watching,
    text: "The Security Suite",
  },
  {
    type: ActivityType.Watching,
    text: "Your Moderation Desk",
  },
  {
    type: ActivityType.Watching,
    text: "The Guardian Desk",
  },
  {
    type: ActivityType.Playing,
    text: "Protecting Your Community",
  },
  {
    type: ActivityType.Playing,
    text: "Moderation With Precision",
  },
  {
    type: ActivityType.Playing,
    text: "Keeping Order, Refined",
  },

  // ==========================================================
  // ECONOMY / MARKET
  // ==========================================================

  {
    type: ActivityType.Playing,
    text: "Managing Your Private Market",
  },
  {
    type: ActivityType.Watching,
    text: "The Market Floor",
  },
  {
    type: ActivityType.Playing,
    text: "Managing The Treasury",
  },
  {
    type: ActivityType.Watching,
    text: "The Astrix Market",
  },
  {
    type: ActivityType.Playing,
    text: "Your Economy, Refined",
  },
  {
    type: ActivityType.Watching,
    text: "The Marketplace",
  },
  {
    type: ActivityType.Playing,
    text: "Fortune At Your Command",
  },
  {
    type: ActivityType.Playing,
    text: "The Treasury Is Open",
  },
  {
    type: ActivityType.Watching,
    text: "Market Opportunities",
  },
  {
    type: ActivityType.Playing,
    text: "Your Digital Fortune",
  },
  {
    type: ActivityType.Watching,
    text: "The Private Exchange",
  },
  {
    type: ActivityType.Playing,
    text: "Commerce, Elevated",
  },
  {
    type: ActivityType.Playing,
    text: "The Economy Desk",
  },
  {
    type: ActivityType.Watching,
    text: "The Next Opportunity",
  },
  {
    type: ActivityType.Playing,
    text: "Building Digital Fortunes",
  },

  // ==========================================================
  // PREMIUM
  // ==========================================================

  {
    type: ActivityType.Watching,
    text: "The Inner Circle",
  },
  {
    type: ActivityType.Playing,
    text: "Premium Access",
  },
  {
    type: ActivityType.Watching,
    text: "The Upper Tier",
  },
  {
    type: ActivityType.Playing,
    text: "Exclusive Features",
  },
  {
    type: ActivityType.Watching,
    text: "The Premium Lounge",
  },
  {
    type: ActivityType.Playing,
    text: "Prestige Access",
  },
  {
    type: ActivityType.Watching,
    text: "The Private Suite",
  },
  {
    type: ActivityType.Playing,
    text: "Sovereign Access",
  },
  {
    type: ActivityType.Watching,
    text: "The Imperial Suite",
  },
  {
    type: ActivityType.Playing,
    text: "Royale Access",
  },
  {
    type: ActivityType.Watching,
    text: "The Exclusive Floor",
  },
  {
    type: ActivityType.Playing,
    text: "The Astrix Experience",
  },
  {
    type: ActivityType.Watching,
    text: "The VIP Lounge",
  },
  {
    type: ActivityType.Playing,
    text: "The Finest Features",
  },
  {
    type: ActivityType.Watching,
    text: "By Invitation",
  },
  // ==========================================================
  // SUPPORT / TICKETS
  // ==========================================================

  {
    type: ActivityType.Listening,
    text: "To Your Requests",
  },
  {
    type: ActivityType.Watching,
    text: "The Support Desk",
  },
  {
    type: ActivityType.Listening,
    text: "Your Concierge",
  },
  {
    type: ActivityType.Listening,
    text: "To The Community",
  },
  {
    type: ActivityType.Watching,
    text: "The Concierge Lounge",
  },
  {
    type: ActivityType.Playing,
    text: "Assistance, Perfected",
  },
  {
    type: ActivityType.Listening,
    text: "For Your Next Request",
  },
  {
    type: ActivityType.Watching,
    text: "The Help Desk",
  },
  {
    type: ActivityType.Listening,
    text: "At Your Service",
  },
  {
    type: ActivityType.Listening,
    text: "Your Support Experience",
  },
  {
    type: ActivityType.Playing,
    text: "Handling With Care",
  },
  {
    type: ActivityType.Listening,
    text: "For The Community",
  },

  // ==========================================================
  // INFORMATION / COMMANDS
  // ==========================================================

  {
    type: ActivityType.Listening,
    text: "To Your Commands",
  },
  {
    type: ActivityType.Playing,
    text: "Commands At Your Fingertips",
  },
  {
    type: ActivityType.Watching,
    text: "The Command Center",
  },
  {
    type: ActivityType.Listening,
    text: "Knowledge At Your Command",
  },
  {
    type: ActivityType.Playing,
    text: "For Your Next Move",
  },
  {
    type: ActivityType.Watching,
    text: "The Information Desk",
  },
  {
    type: ActivityType.Playing,
    text: "Everything In One Place",
  },
  {
    type: ActivityType.Watching,
    text: "The Command Suite",
  },
  {
    type: ActivityType.Listening,
    text: "Your Digital Concierge",
  },
  {
    type: ActivityType.Playing,
    text: "For The Finest Requests",
  },

  // ==========================================================
  // FUTURE / TECHNOLOGY
  // ==========================================================

  {
    type: ActivityType.Playing,
    text: "The Future Of Discord",
  },
  {
    type: ActivityType.Playing,
    text: "The Next Generation",
  },
  {
    type: ActivityType.Watching,
    text: "Beyond The Ordinary",
  },
  {
    type: ActivityType.Playing,
    text: "Intelligence, Refined",
  },
  {
    type: ActivityType.Watching,
    text: "The Future Unfold",
  },
  {
    type: ActivityType.Playing,
    text: "The Next Standard",
  },
  {
    type: ActivityType.Watching,
    text: "Beyond Expectations",
  },
  {
    type: ActivityType.Playing,
    text: "Built For Tomorrow",
  },
  {
    type: ActivityType.Watching,
    text: "What Comes Next",
  },
  {
    type: ActivityType.Playing,
    text: "Where Innovation Lives",
  },

  // ==========================================================
  // STREAMING
  // ==========================================================

  {
    type: ActivityType.Streaming,
    text: "Astrix Live",
    url: DEFAULT_STREAMING_URL,
  },
  {
    type: ActivityType.Streaming,
    text: "From The Astrix House",
    url: DEFAULT_STREAMING_URL,
  },
  {
    type: ActivityType.Streaming,
    text: "From Astrix HQ",
    url: DEFAULT_STREAMING_URL,
  },
  {
    type: ActivityType.Streaming,
    text: "The Empire Is Live",
    url: DEFAULT_STREAMING_URL,
  },
  {
    type: ActivityType.Streaming,
    text: "After Hours",
    url: DEFAULT_STREAMING_URL,
  },
  {
    type: ActivityType.Streaming,
    text: "The Astrix Experience",
    url: DEFAULT_STREAMING_URL,
  },
  {
    type: ActivityType.Streaming,
    text: "Live From The Lounge",
    url: DEFAULT_STREAMING_URL,
  },
  {
    type: ActivityType.Streaming,
    text: "The House Is Live",
    url: DEFAULT_STREAMING_URL,
  },
  {
    type: ActivityType.Streaming,
    text: "Astrix After Dark",
    url: DEFAULT_STREAMING_URL,
  },
  {
    type: ActivityType.Streaming,
    text: "Live From The Empire",
    url: DEFAULT_STREAMING_URL,
  },

  // ==========================================================
  // COMPETING
  // ==========================================================

  {
    type: ActivityType.Competing,
    text: "For The Crown",
  },
  {
    type: ActivityType.Competing,
    text: "For The Next Level",
  },
  {
    type: ActivityType.Competing,
    text: "In Astrix Royale",
  },
  {
    type: ActivityType.Competing,
    text: "For Community Excellence",
  },
  {
    type: ActivityType.Competing,
    text: "For The Finest Experience",
  },
  {
    type: ActivityType.Competing,
    text: "Against The Ordinary",
  },
  {
    type: ActivityType.Competing,
    text: "For The Top Floor",
  },
  {
    type: ActivityType.Competing,
    text: "For The Next Standard",
  },
];


// ============================================================
// HELPERS
// ============================================================

function shuffleStatuses(
  statuses: AstrixStatus[],
): AstrixStatus[] {
  const result = [...statuses];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}


// ============================================================
// STATUS MANAGER
// ============================================================

export function createAstrixStatusManager(
  client: Client,
  config: AstrixStatusConfig = {},
) {
  const interval =
    config.interval ?? DEFAULT_INTERVAL;

  const shuffle =
    config.shuffle ?? true;

  const rotatePresence =
    config.rotatePresence ?? true;

  const presenceStatuses =
    config.presenceStatuses ??
    DEFAULT_PRESENCE_STATUSES;

  const streamingUrl =
    config.streamingUrl ??
    DEFAULT_STREAMING_URL;

  let statuses = [...ASTRIX_STATUSES];

  if (shuffle) {
    statuses = shuffleStatuses(statuses);
  }

  let activityIndex = 0;
  let presenceIndex = 0;

  let timer: ReturnType<typeof setInterval> | null =
    null;

  let running = false;

  function getNextActivity(): AstrixStatus {
    if (activityIndex >= statuses.length) {
      activityIndex = 0;

      if (shuffle) {
        statuses = shuffleStatuses(statuses);
      }
    }

    const activity = {
      ...statuses[activityIndex++],
    };

    // Always use the configured Twitch URL
    // for streaming activities.
    if (activity.type === ActivityType.Streaming) {
      activity.url = streamingUrl;
    }

    return activity;
  }

  function getNextPresence(): PresenceStatusData {
    if (!rotatePresence) {
      return presenceStatuses[0] ?? "online";
    }

    const status =
      presenceStatuses[presenceIndex] ??
      "online";

    presenceIndex++;

    if (
      presenceIndex >=
      presenceStatuses.length
    ) {
      presenceIndex = 0;
    }

    return status;
  }

  async function update(): Promise<void> {
    if (!client.user) {
      return;
    }

    const activity = getNextActivity();
    const status = getNextPresence();

    try {
      client.user.setPresence({
        status,
        activities: [
          {
            name: activity.text,
            type: activity.type,
            ...(activity.type === ActivityType.Streaming
              ? {
                  url:
                    activity.url ??
                    streamingUrl,
                }
              : {}),
          },
        ],
      });
    } catch (error) {
      console.error(
        "[Astrix Status] Failed to update presence:",
        error,
      );
    }
  }

  function start(): void {
    if (running) {
      return;
    }

    running = true;

    void update();

    timer = setInterval(() => {
      void update();
    }, interval);

    console.log(
      `[Astrix Status] Started • ${statuses.length} activities • ${interval}ms rotation`,
    );
  }

  function stop(): void {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }

    running = false;

    console.log(
      "[Astrix Status] Rotation stopped.",
    );
  }

  async function rotateNow(): Promise<void> {
    await update();
  }

  function destroy(): void {
    stop();

    activityIndex = 0;
    presenceIndex = 0;
  }

  return {
    start,
    stop,
    update,
    rotateNow,
    destroy,

    get running() {
      return running;
    },

    get count() {
      return statuses.length;
    },

    get interval() {
      return interval;
    },
  };
}


// ============================================================
// DEFAULT EXPORT
// ============================================================

export default createAstrixStatusManager;