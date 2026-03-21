import { AppStore } from "@/lib/domain/types";

export const seedStore: AppStore = {
  users: [
    {
      id: "user_demo",
      email: "jiawei@example.com",
      displayName: "Jiawei Chen",
      passwordHash:
        "trade_demo_seed:bbc394fd8cfa98a3b309e3a8f25c683e54f3124ac308e44b81ed3de6aa1436186f58e0407c78368941a855fbfeebc83e4b044dc3d8a0212221be84e5bb4fd14d",
      createdAt: "2026-03-01T09:00:00-05:00"
    }
  ],
  sessions: [],
  settings: [
    {
      userId: "user_demo",
      displayName: "Jiawei Chen",
      email: "jiawei@example.com",
      timezone: "America/New_York",
      defaultRisk: 350,
      defaultCapital: 6000,
      aiInsightsEnabled: true,
      insightMode: "local",
      privacyMode: "private-cloud",
      customTradeTypes: [],
      customSetupTypes: [],
      strategyTaxonomy: [
        "ORB",
        "Trend Pullback",
        "Failed Breakout",
        "Support Reclaim",
        "Gamma Momentum"
      ]
    }
  ],
  filterPresets: [
    {
      id: "preset_a_plus",
      userId: "user_demo",
      name: "A+ Momentum",
      setupType: "orb",
      direction: "long",
      result: "all",
      durationBucket: "all"
    },
    {
      id: "preset_review_losses",
      userId: "user_demo",
      name: "Loss Review",
      setupType: "all",
      direction: "all",
      result: "loss",
      durationBucket: "all"
    },
    {
      id: "preset_short_hold",
      userId: "user_demo",
      name: "Quick Scalps",
      setupType: "all",
      direction: "all",
      result: "all",
      durationBucket: "scalp"
    }
  ],
  insightReports: [],
  trades: [
    {
      id: "trade_nvda_0318",
      userId: "user_demo",
      symbol: "NVDA",
      assetClass: "stock",
      instrumentLabel: "NVIDIA Corp",
      direction: "long",
      tradeType: "opening-drive",
      setupType: "orb",
      status: "closed",
      openedAt: "2026-03-18T09:35:00-04:00",
      closedAt: "2026-03-18T10:24:00-04:00",
      thesis:
        "AI leaders were reclaiming the prior day high while QQQ held opening range support. Expected clean opening drive with room into intraday extension.",
      reasonForEntry: "5-minute opening range break with tape confirmation above 141.20.",
      reasonForExit: "Scaled into extension and sold final lot into rejection under VWAP extension band.",
      preTradePlan:
        "Risk 42 cents under opening range low. Add only if second push holds over 141.60.",
      postTradeReview:
        "Good patience on the initial hold. Could have pressed the second scale-out more instead of trimming too early.",
      capitalAllocated: 7800,
      plannedRisk: 420,
      fees: 14,
      notes:
        "Best trade of the week so far. Morning routine was strong and execution matched the plan.",
      fills: [
        {
          id: "fill_nvda_1",
          tradeId: "trade_nvda_0318",
          side: "entry",
          filledAt: "2026-03-18T09:35:00-04:00",
          quantity: 30,
          price: 141.24
        },
        {
          id: "fill_nvda_2",
          tradeId: "trade_nvda_0318",
          side: "entry",
          filledAt: "2026-03-18T09:42:00-04:00",
          quantity: 20,
          price: 141.61
        },
        {
          id: "fill_nvda_3",
          tradeId: "trade_nvda_0318",
          side: "exit",
          filledAt: "2026-03-18T09:58:00-04:00",
          quantity: 25,
          price: 142.44
        },
        {
          id: "fill_nvda_4",
          tradeId: "trade_nvda_0318",
          side: "exit",
          filledAt: "2026-03-18T10:24:00-04:00",
          quantity: 25,
          price: 142.95
        }
      ],
      attachments: [
        {
          id: "attachment_nvda_setup",
          tradeId: "trade_nvda_0318",
          kind: "setup",
          storagePath: "/placeholders/setup-grid.svg",
          caption: "Premarket levels and opening range marked before the break.",
          uploadedAt: "2026-03-18T11:10:00-04:00"
        },
        {
          id: "attachment_nvda_winner",
          tradeId: "trade_nvda_0318",
          kind: "winner",
          storagePath: "/placeholders/winner-wave.svg",
          caption: "Post-trade markup showing clean continuation after second entry.",
          uploadedAt: "2026-03-18T11:11:00-04:00"
        }
      ],
      tags: [
        { id: "tag_nvda_1", tradeId: "trade_nvda_0318", category: "setup", value: "A+ opening drive" },
        { id: "tag_nvda_2", tradeId: "trade_nvda_0318", category: "lesson", value: "Let second scale breathe" }
      ]
    },
    {
      id: "trade_tsla_0317",
      userId: "user_demo",
      symbol: "TSLA",
      assetClass: "stock",
      instrumentLabel: "Tesla Inc",
      direction: "short",
      tradeType: "reversal",
      setupType: "failed-breakout",
      status: "closed",
      openedAt: "2026-03-17T11:08:00-04:00",
      closedAt: "2026-03-17T12:02:00-04:00",
      thesis:
        "Late-morning failed breakout into daily supply after a weak sector tape. Looking for flush back through VWAP.",
      reasonForEntry: "Rejected 228.50 twice and lost 5-minute trend support.",
      reasonForExit: "Covered too early into first flush after seeing quick bounce.",
      preTradePlan: "Starter at failure, add only below VWAP reclaim failure.",
      postTradeReview:
        "Idea was correct but sizing was too conservative on the cleanest part of the move.",
      capitalAllocated: 6200,
      plannedRisk: 300,
      fees: 12,
      notes: "Good short bias. Need to stop paying myself before the real unwind completes.",
      fills: [
        {
          id: "fill_tsla_1",
          tradeId: "trade_tsla_0317",
          side: "entry",
          filledAt: "2026-03-17T11:08:00-04:00",
          quantity: 20,
          price: 227.94
        },
        {
          id: "fill_tsla_2",
          tradeId: "trade_tsla_0317",
          side: "exit",
          filledAt: "2026-03-17T11:42:00-04:00",
          quantity: 10,
          price: 225.88
        },
        {
          id: "fill_tsla_3",
          tradeId: "trade_tsla_0317",
          side: "exit",
          filledAt: "2026-03-17T12:02:00-04:00",
          quantity: 10,
          price: 225.34
        }
      ],
      attachments: [
        {
          id: "attachment_tsla_setup",
          tradeId: "trade_tsla_0317",
          kind: "setup",
          storagePath: "/placeholders/reversal-radar.svg",
          caption: "Supply zone and failed push over morning high.",
          uploadedAt: "2026-03-17T12:30:00-04:00"
        }
      ],
      tags: [
        { id: "tag_tsla_1", tradeId: "trade_tsla_0317", category: "setup", value: "Daily supply short" },
        { id: "tag_tsla_2", tradeId: "trade_tsla_0317", category: "lesson", value: "Keep core through VWAP flush" }
      ]
    },
    {
      id: "trade_spy_0316",
      userId: "user_demo",
      symbol: "SPY 540C",
      assetClass: "option",
      instrumentLabel: "SPY Mar 20 540 Call",
      direction: "long",
      tradeType: "options-premium",
      setupType: "gamma-momentum",
      status: "closed",
      openedAt: "2026-03-16T13:14:00-04:00",
      closedAt: "2026-03-16T14:06:00-04:00",
      thesis:
        "Index reclaimed noon balance and dealer flow suggested upside pressure into afternoon.",
      reasonForEntry: "Call premium accelerated above noon range high.",
      reasonForExit: "Closed when premium stalled near 3.80 and breadth stopped confirming.",
      preTradePlan: "Size to 3 contracts and cut if premium loses 2.60.",
      postTradeReview:
        "Clean trade. Could track breadth overlay inside the journal because it was key to conviction.",
      capitalAllocated: 960,
      plannedRisk: 180,
      fees: 8,
      notes: "Options momentum setup worked well after lunch.",
      fills: [
        {
          id: "fill_spy_1",
          tradeId: "trade_spy_0316",
          side: "entry",
          filledAt: "2026-03-16T13:14:00-04:00",
          quantity: 2,
          price: 2.88
        },
        {
          id: "fill_spy_2",
          tradeId: "trade_spy_0316",
          side: "entry",
          filledAt: "2026-03-16T13:18:00-04:00",
          quantity: 1,
          price: 3.02
        },
        {
          id: "fill_spy_3",
          tradeId: "trade_spy_0316",
          side: "exit",
          filledAt: "2026-03-16T13:48:00-04:00",
          quantity: 1,
          price: 3.52
        },
        {
          id: "fill_spy_4",
          tradeId: "trade_spy_0316",
          side: "exit",
          filledAt: "2026-03-16T14:06:00-04:00",
          quantity: 2,
          price: 3.78
        }
      ],
      attachments: [
        {
          id: "attachment_spy_setup",
          tradeId: "trade_spy_0316",
          kind: "entry",
          storagePath: "/placeholders/options-surge.svg",
          caption: "Premium expansion after range reclaim.",
          uploadedAt: "2026-03-16T14:20:00-04:00"
        }
      ],
      tags: [
        { id: "tag_spy_1", tradeId: "trade_spy_0316", category: "setup", value: "Gamma squeeze" },
        { id: "tag_spy_2", tradeId: "trade_spy_0316", category: "lesson", value: "Record breadth context" }
      ]
    },
    {
      id: "trade_aapl_0314",
      userId: "user_demo",
      symbol: "AAPL",
      assetClass: "stock",
      instrumentLabel: "Apple Inc",
      direction: "long",
      tradeType: "trend-continuation",
      setupType: "trend-pullback",
      status: "closed",
      openedAt: "2026-03-14T10:18:00-04:00",
      closedAt: "2026-03-14T11:46:00-04:00",
      thesis: "Strong relative strength name holding above VWAP in an uptrend morning.",
      reasonForEntry: "First higher low above VWAP after pullback.",
      reasonForExit: "Lost momentum and I anticipated lunch fade.",
      preTradePlan: "Add only if new high prints with breadth support.",
      postTradeReview:
        "Decent trade, but not aggressive enough on the ideal setup because prior day loss was still in mind.",
      capitalAllocated: 5400,
      plannedRisk: 280,
      fees: 10,
      notes: "Slight fear hangover from previous loss.",
      fills: [
        {
          id: "fill_aapl_1",
          tradeId: "trade_aapl_0314",
          side: "entry",
          filledAt: "2026-03-14T10:18:00-04:00",
          quantity: 35,
          price: 196.42
        },
        {
          id: "fill_aapl_2",
          tradeId: "trade_aapl_0314",
          side: "exit",
          filledAt: "2026-03-14T11:46:00-04:00",
          quantity: 35,
          price: 197.88
        }
      ],
      attachments: [],
      tags: [
        { id: "tag_aapl_1", tradeId: "trade_aapl_0314", category: "emotion", value: "hesitation" },
        { id: "tag_aapl_2", tradeId: "trade_aapl_0314", category: "lesson", value: "Separate prior loss from next setup" }
      ]
    },
    {
      id: "trade_meta_0313",
      userId: "user_demo",
      symbol: "META",
      assetClass: "stock",
      instrumentLabel: "Meta Platforms",
      direction: "long",
      tradeType: "breakout",
      setupType: "support-reclaim",
      status: "closed",
      openedAt: "2026-03-13T09:58:00-04:00",
      closedAt: "2026-03-13T10:33:00-04:00",
      thesis: "Premarket resistance flipped to support. Wanted reclaim then trend continuation.",
      reasonForEntry: "Reclaimed 522 and held above opening flush low.",
      reasonForExit: "Stopped out when second pullback lost the reclaim level.",
      preTradePlan: "Only risk 24 cents if reclaim fails. Keep size moderate.",
      postTradeReview:
        "Took the right stop. The real mistake was chasing the reclaim instead of waiting for confirmation.",
      capitalAllocated: 4800,
      plannedRisk: 250,
      fees: 10,
      notes: "Entry was early. Patience would have improved location.",
      fills: [
        {
          id: "fill_meta_1",
          tradeId: "trade_meta_0313",
          side: "entry",
          filledAt: "2026-03-13T09:58:00-04:00",
          quantity: 18,
          price: 522.16
        },
        {
          id: "fill_meta_2",
          tradeId: "trade_meta_0313",
          side: "exit",
          filledAt: "2026-03-13T10:33:00-04:00",
          quantity: 18,
          price: 520.92
        }
      ],
      attachments: [
        {
          id: "attachment_meta_loser",
          tradeId: "trade_meta_0313",
          kind: "loser",
          storagePath: "/placeholders/loser-cross.svg",
          caption: "Late entry into reclaim. Confirmation came after the initial chase.",
          uploadedAt: "2026-03-13T11:00:00-04:00"
        }
      ],
      tags: [
        { id: "tag_meta_1", tradeId: "trade_meta_0313", category: "mistake", value: "chased entry" },
        { id: "tag_meta_2", tradeId: "trade_meta_0313", category: "lesson", value: "Wait for reclaim hold" }
      ]
    },
    {
      id: "trade_amzn_0312",
      userId: "user_demo",
      symbol: "AMZN",
      assetClass: "stock",
      instrumentLabel: "Amazon.com",
      direction: "short",
      tradeType: "news-reaction",
      setupType: "supply-reversal",
      status: "closed",
      openedAt: "2026-03-12T09:47:00-04:00",
      closedAt: "2026-03-12T10:29:00-04:00",
      thesis:
        "Weak reaction after company commentary. Expected pop to fail into supply and unwind to premarket support.",
      reasonForEntry: "Failed to hold opening reclaim near 192.40.",
      reasonForExit: "Covered most into premarket low; final piece at trend extension.",
      preTradePlan: "Risk above opening high. Keep size under 35 shares.",
      postTradeReview: "A model short. Good location, clean risk, and patient exits.",
      capitalAllocated: 5100,
      plannedRisk: 260,
      fees: 9,
      notes: "Felt in rhythm with tape.",
      fills: [
        {
          id: "fill_amzn_1",
          tradeId: "trade_amzn_0312",
          side: "entry",
          filledAt: "2026-03-12T09:47:00-04:00",
          quantity: 30,
          price: 191.98
        },
        {
          id: "fill_amzn_2",
          tradeId: "trade_amzn_0312",
          side: "exit",
          filledAt: "2026-03-12T10:12:00-04:00",
          quantity: 20,
          price: 189.94
        },
        {
          id: "fill_amzn_3",
          tradeId: "trade_amzn_0312",
          side: "exit",
          filledAt: "2026-03-12T10:29:00-04:00",
          quantity: 10,
          price: 189.42
        }
      ],
      attachments: [],
      tags: [
        { id: "tag_amzn_1", tradeId: "trade_amzn_0312", category: "setup", value: "News fade" },
        { id: "tag_amzn_2", tradeId: "trade_amzn_0312", category: "lesson", value: "Scale on plan, not on fear" }
      ]
    },
    {
      id: "trade_qqq_0311",
      userId: "user_demo",
      symbol: "QQQ",
      assetClass: "stock",
      instrumentLabel: "Invesco QQQ Trust",
      direction: "long",
      tradeType: "trend-continuation",
      setupType: "trend-pullback",
      status: "closed",
      openedAt: "2026-03-11T10:41:00-04:00",
      closedAt: "2026-03-11T11:22:00-04:00",
      thesis: "Market held first higher low and semis were leading. Wanted continuation through VWAP curl.",
      reasonForEntry: "Second test of higher low held.",
      reasonForExit: "Stopped flat after breadth divergence showed up.",
      preTradePlan: "Keep risk tight because overall market was mixed.",
      postTradeReview: "Scratch was fine. Could have skipped given mixed breadth and unclear edge.",
      capitalAllocated: 6000,
      plannedRisk: 240,
      fees: 8,
      notes: "This felt more like a boredom trade than a clear edge.",
      fills: [
        {
          id: "fill_qqq_1",
          tradeId: "trade_qqq_0311",
          side: "entry",
          filledAt: "2026-03-11T10:41:00-04:00",
          quantity: 14,
          price: 504.18
        },
        {
          id: "fill_qqq_2",
          tradeId: "trade_qqq_0311",
          side: "exit",
          filledAt: "2026-03-11T11:22:00-04:00",
          quantity: 14,
          price: 504.26
        }
      ],
      attachments: [],
      tags: [
        { id: "tag_qqq_1", tradeId: "trade_qqq_0311", category: "mistake", value: "low conviction" },
        { id: "tag_qqq_2", tradeId: "trade_qqq_0311", category: "emotion", value: "boredom" }
      ]
    },
    {
      id: "trade_msft_0310",
      userId: "user_demo",
      symbol: "MSFT",
      assetClass: "stock",
      instrumentLabel: "Microsoft Corp",
      direction: "long",
      tradeType: "trend-continuation",
      setupType: "trend-pullback",
      status: "closed",
      openedAt: "2026-03-10T09:54:00-04:00",
      closedAt: "2026-03-10T10:11:00-04:00",
      thesis: "Strong trend day candidate, but I entered on the first pullback without enough confirmation.",
      reasonForEntry: "Bought first touch of VWAP extension band.",
      reasonForExit: "Stopped immediately when first pullback failed.",
      preTradePlan: "Wanted starter only, but oversized relative to uncertainty.",
      postTradeReview:
        "Loss came from forcing a fast scalp inside a trend idea. Wait for structure and stop chasing immediacy.",
      capitalAllocated: 9000,
      plannedRisk: 300,
      fees: 15,
      notes: "Oversized and rushed.",
      fills: [
        {
          id: "fill_msft_1",
          tradeId: "trade_msft_0310",
          side: "entry",
          filledAt: "2026-03-10T09:54:00-04:00",
          quantity: 22,
          price: 417.82
        },
        {
          id: "fill_msft_2",
          tradeId: "trade_msft_0310",
          side: "exit",
          filledAt: "2026-03-10T10:11:00-04:00",
          quantity: 22,
          price: 416.34
        }
      ],
      attachments: [
        {
          id: "attachment_msft_loser",
          tradeId: "trade_msft_0310",
          kind: "postmortem",
          storagePath: "/placeholders/postmortem-frame.svg",
          caption: "Oversized first pullback before real confirmation formed.",
          uploadedAt: "2026-03-10T11:00:00-04:00"
        }
      ],
      tags: [
        { id: "tag_msft_1", tradeId: "trade_msft_0310", category: "mistake", value: "oversized" },
        { id: "tag_msft_2", tradeId: "trade_msft_0310", category: "mistake", value: "rushed entry" }
      ]
    },
    {
      id: "trade_nflx_0309",
      userId: "user_demo",
      symbol: "NFLX",
      assetClass: "stock",
      instrumentLabel: "Netflix Inc",
      direction: "short",
      tradeType: "reversal",
      setupType: "supply-reversal",
      status: "closed",
      openedAt: "2026-03-09T13:02:00-04:00",
      closedAt: "2026-03-09T14:16:00-04:00",
      thesis: "Afternoon exhaustion after vertical move into prior swing high.",
      reasonForEntry: "Exhaustion wick plus heavy offer at 618.",
      reasonForExit: "Covered into support shelf because afternoon trend slowed.",
      preTradePlan: "Risk 1.10 above the wick. Add only below 613.",
      postTradeReview:
        "Well-executed fade. Nice patience waiting for confirmation before stepping in.",
      capitalAllocated: 7100,
      plannedRisk: 320,
      fees: 10,
      notes: "Stayed patient and let the setup come to me.",
      fills: [
        {
          id: "fill_nflx_1",
          tradeId: "trade_nflx_0309",
          side: "entry",
          filledAt: "2026-03-09T13:02:00-04:00",
          quantity: 14,
          price: 617.42
        },
        {
          id: "fill_nflx_2",
          tradeId: "trade_nflx_0309",
          side: "exit",
          filledAt: "2026-03-09T13:48:00-04:00",
          quantity: 8,
          price: 612.84
        },
        {
          id: "fill_nflx_3",
          tradeId: "trade_nflx_0309",
          side: "exit",
          filledAt: "2026-03-09T14:16:00-04:00",
          quantity: 6,
          price: 611.92
        }
      ],
      attachments: [],
      tags: [
        { id: "tag_nflx_1", tradeId: "trade_nflx_0309", category: "setup", value: "afternoon exhaustion" }
      ]
    },
    {
      id: "trade_amd_0308",
      userId: "user_demo",
      symbol: "AMD",
      assetClass: "stock",
      instrumentLabel: "Advanced Micro Devices",
      direction: "long",
      tradeType: "breakout",
      setupType: "orb",
      status: "closed",
      openedAt: "2026-03-08T09:39:00-04:00",
      closedAt: "2026-03-08T09:55:00-04:00",
      thesis: "Expected fast semiconductor continuation after gap over prior resistance.",
      reasonForEntry: "Bought immediate break instead of waiting for hold.",
      reasonForExit: "Stopped after breakout failed and flushed back into range.",
      preTradePlan: "Wanted confirmation candle, ignored it in the moment.",
      postTradeReview:
        "Classic chase. This is the loss profile I need the journal to shame me out of repeating.",
      capitalAllocated: 8700,
      plannedRisk: 310,
      fees: 13,
      notes: "Pure FOMO. Entered because NVDA was moving and I felt late.",
      fills: [
        {
          id: "fill_amd_1",
          tradeId: "trade_amd_0308",
          side: "entry",
          filledAt: "2026-03-08T09:39:00-04:00",
          quantity: 70,
          price: 169.84
        },
        {
          id: "fill_amd_2",
          tradeId: "trade_amd_0308",
          side: "exit",
          filledAt: "2026-03-08T09:55:00-04:00",
          quantity: 70,
          price: 168.22
        }
      ],
      attachments: [
        {
          id: "attachment_amd_loser",
          tradeId: "trade_amd_0308",
          kind: "loser",
          storagePath: "/placeholders/loser-cross.svg",
          caption: "Breakout buy without waiting for confirmation hold.",
          uploadedAt: "2026-03-08T10:20:00-04:00"
        }
      ],
      tags: [
        { id: "tag_amd_1", tradeId: "trade_amd_0308", category: "mistake", value: "fomo" },
        { id: "tag_amd_2", tradeId: "trade_amd_0308", category: "mistake", value: "chased entry" }
      ]
    },
    {
      id: "trade_shop_0307",
      userId: "user_demo",
      symbol: "SHOP",
      assetClass: "stock",
      instrumentLabel: "Shopify Inc",
      direction: "long",
      tradeType: "swing",
      setupType: "support-reclaim",
      status: "open",
      openedAt: "2026-03-19T14:08:00-04:00",
      closedAt: null,
      thesis: "Daily support reclaim with room for two-day continuation if market remains constructive.",
      reasonForEntry: "Strong close above reclaim level with improving relative strength.",
      reasonForExit: "",
      preTradePlan: "Half size into the close, add only on hold above 92.40 tomorrow.",
      postTradeReview: "",
      capitalAllocated: 4600,
      plannedRisk: 260,
      fees: 5,
      notes: "Swing position still active.",
      fills: [
        {
          id: "fill_shop_1",
          tradeId: "trade_shop_0307",
          side: "entry",
          filledAt: "2026-03-19T14:08:00-04:00",
          quantity: 40,
          price: 91.72
        }
      ],
      attachments: [
        {
          id: "attachment_shop_setup",
          tradeId: "trade_shop_0307",
          kind: "setup",
          storagePath: "/placeholders/setup-grid.svg",
          caption: "Daily reclaim setup to revisit if it follows through tomorrow.",
          uploadedAt: "2026-03-19T15:00:00-04:00"
        }
      ],
      tags: [{ id: "tag_shop_1", tradeId: "trade_shop_0307", category: "setup", value: "daily reclaim swing" }]
    },
    {
      id: "trade_iwm_0306",
      userId: "user_demo",
      symbol: "IWM 210P",
      assetClass: "option",
      instrumentLabel: "IWM Mar 27 210 Put",
      direction: "long",
      tradeType: "options-premium",
      setupType: "gamma-momentum",
      status: "open",
      openedAt: "2026-03-20T10:26:00-04:00",
      closedAt: null,
      thesis: "Small-cap weakness expanding while broader market churns. Looking for afternoon downside pressure.",
      reasonForEntry: "Put premium expanded on new intraday low.",
      reasonForExit: "",
      preTradePlan: "Keep size tiny and cut if premium loses 15%.",
      postTradeReview: "",
      capitalAllocated: 420,
      plannedRisk: 85,
      fees: 3,
      notes: "Open options probe.",
      fills: [
        {
          id: "fill_iwm_1",
          tradeId: "trade_iwm_0306",
          side: "entry",
          filledAt: "2026-03-20T10:26:00-04:00",
          quantity: 2,
          price: 1.98
        }
      ],
      attachments: [],
      tags: [{ id: "tag_iwm_1", tradeId: "trade_iwm_0306", category: "setup", value: "downside premium expansion" }]
    }
  ]
};
