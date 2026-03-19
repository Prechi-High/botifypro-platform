export const PREBUILT_COMMANDS = [
  
  // ═══ UNIVERSAL (every bot type) ═══
  {
    key: 'about',
    category: 'Universal',
    categoryIcon: '⭐',
    command: '/about',
    defaultResponse: 'This bot is powered by BotifyPro. 🤖',
    description: 'Tell users about your bot',
    needsSetup: false,
    setupInstructions: null
  },
  {
    key: 'rules',
    category: 'Universal',
    categoryIcon: '⭐',
    command: '/rules',
    defaultResponse: '📋 Rules:\n\n1. Be respectful\n2. No spam\n3. Follow channel guidelines',
    description: 'Show bot/community rules',
    needsSetup: false,
    setupInstructions: null
  },
  {
    key: 'links',
    category: 'Universal',
    categoryIcon: '⭐',
    command: '/links',
    defaultResponse: '🔗 Our Links:\n\nChannel: @yourchannel\nWebsite: https://yoursite.com\nSupport: @yoursupport',
    description: 'Show important links',
    needsSetup: false,
    setupInstructions: null
  },
  {
    key: 'contact',
    category: 'Universal',
    categoryIcon: '⭐',
    command: '/contact',
    defaultResponse: '📬 Contact us:\n\nSupport: @yoursupport\nEmail: support@yoursite.com',
    description: 'Show contact information',
    needsSetup: false,
    setupInstructions: null
  },
  {
    key: 'website',
    category: 'Universal',
    categoryIcon: '⭐',
    command: '/website',
    defaultResponse: '🌐 Visit our website: https://yourwebsite.com',
    description: 'Share your website link',
    needsSetup: false,
    setupInstructions: null
  },
  {
    key: 'social',
    category: 'Universal',
    categoryIcon: '⭐',
    command: '/social',
    defaultResponse: '📱 Follow us:\n\nTelegram: @yourchannel\nTwitter: @yourtwitter\nInstagram: @yourinsta',
    description: 'Show social media links',
    needsSetup: false,
    setupInstructions: null
  },

  // ═══ MARKETING & GROWTH ═══
  {
    key: 'referral',
    category: 'Marketing & Growth',
    categoryIcon: '📣',
    command: '/referral',
    defaultResponse: '👥 Share your referral link and earn coins!\n\nYour referral link: [REFERRAL_LINK]\n\nEarned so far: [REFERRAL_COUNT] referrals',
    description: 'Show user their referral link',
    needsSetup: true,
    setupInstructions: 'Enable Referral System toggle in Payments settings first.'
  },
  {
    key: 'invite',
    category: 'Marketing & Growth',
    categoryIcon: '📣',
    command: '/invite',
    defaultResponse: '📨 Invite your friends and earn rewards!\n\nClick here to get your invite link: [REFERRAL_LINK]',
    description: 'Alternative referral command',
    needsSetup: true,
    setupInstructions: 'Enable Referral System toggle in Payments settings first.'
  },
  {
    key: 'promo',
    category: 'Marketing & Growth',
    categoryIcon: '📣',
    command: '/promo',
    defaultResponse: '🎁 Current Promotions:\n\nNo active promotions right now. Stay tuned!',
    description: 'Show current promotions',
    needsSetup: false,
    setupInstructions: null
  },
  {
    key: 'giveaway',
    category: 'Marketing & Growth',
    categoryIcon: '📣',
    command: '/giveaway',
    defaultResponse: '🎉 Giveaway Info:\n\nNo active giveaway right now.\n\nJoin our channel @yourchannel to be notified!',
    description: 'Show giveaway information',
    needsSetup: false,
    setupInstructions: null
  },

  // ═══ COMMUNITY ═══
  {
    key: 'group',
    category: 'Community',
    categoryIcon: '👥',
    command: '/group',
    defaultResponse: '👥 Join our community group:\n\nhttps://t.me/yourcommunity',
    description: 'Share community group link',
    needsSetup: false,
    setupInstructions: null
  },
  {
    key: 'channel',
    category: 'Community',
    categoryIcon: '👥',
    command: '/channel',
    defaultResponse: '📢 Join our main channel:\n\nhttps://t.me/yourchannel',
    description: 'Share channel link',
    needsSetup: false,
    setupInstructions: null
  },
  {
    key: 'support',
    category: 'Community',
    categoryIcon: '👥',
    command: '/support',
    defaultResponse: '🆘 Need help?\n\nContact our support team: @yoursupport\n\nResponse time: within 24 hours',
    description: 'Direct users to support',
    needsSetup: false,
    setupInstructions: null
  },
  {
    key: 'faq',
    category: 'Community',
    categoryIcon: '👥',
    command: '/faq',
    defaultResponse: '❓ Frequently Asked Questions:\n\nQ: How do I get started?\nA: Type /start\n\nQ: How do I contact support?\nA: Type /support',
    description: 'Show frequently asked questions',
    needsSetup: false,
    setupInstructions: null
  },
  {
    key: 'report',
    category: 'Community',
    categoryIcon: '👥',
    command: '/report',
    defaultResponse: '🚨 To report an issue, contact: @yoursupport\n\nPlease describe problem clearly.',
    description: 'Allow users to report issues',
    needsSetup: false,
    setupInstructions: null
  },

  // ═══ EARNINGS & PAYMENTS ═══
  {
    key: 'earn',
    category: 'Earnings & Payments',
    categoryIcon: '💰',
    command: '/earn',
    defaultResponse: '💰 Ways to earn coins:\n\n1. /referral — Invite friends\n2. Watch for daily bonuses\n3. Participate in giveaways',
    description: 'Show ways to earn coins',
    needsSetup: false,
    setupInstructions: null
  },
  {
    key: 'daily',
    category: 'Earnings & Payments',
    categoryIcon: '💰',
    command: '/daily',
    defaultResponse: '🎁 Daily bonus coming soon!\n\nCheck back tomorrow.',
    description: 'Daily reward command',
    needsSetup: false,
    setupInstructions: null
  },
  {
    key: 'leaderboard',
    category: 'Earnings & Payments',
    categoryIcon: '💰',
    command: '/leaderboard',
    defaultResponse: '🏆 Top earners leaderboard coming soon!',
    description: 'Show top earners',
    needsSetup: false,
    setupInstructions: null
  },
  {
    key: 'wallet',
    category: 'Earnings & Payments',
    categoryIcon: '💰',
    command: '/wallet',
    defaultResponse: '👛 Your Wallet:\n\nUse /balance to check your balance\nUse /deposit to add funds\nUse /withdraw to cash out',
    description: 'Show wallet overview',
    needsSetup: false,
    setupInstructions: null
  },
  {
    key: 'rates',
    category: 'Earnings & Payments',
    categoryIcon: '💰',
    command: '/rates',
    defaultResponse: '💱 Exchange Rates:\n\n1 USD = [CURRENCY_RATE] [CURRENCY_SYMBOL]\n1 [CURRENCY_SYMBOL] = [USD_RATE] USD',
    description: 'Show exchange rates',
    needsSetup: true,
    setupInstructions: 'Make sure your currency settings are configured in Currency tab.'
  },

  // ═══ CONTENT & MEDIA ═══
  {
    key: 'latest',
    category: 'Content & Media',
    categoryIcon: '📰',
    command: '/latest',
    defaultResponse: '📰 Latest Updates:\n\nFollow our channel for latest news: @yourchannel',
    description: 'Direct to latest content',
    needsSetup: false,
    setupInstructions: null
  },
  {
    key: 'news',
    category: 'Content & Media',
    categoryIcon: '📰',
    command: '/news',
    defaultResponse: '📢 Latest News:\n\nStay updated by joining our channel: @yourchannel',
    description: 'Show latest news',
    needsSetup: false,
    setupInstructions: null
  },
  {
    key: 'updates',
    category: 'Content & Media',
    categoryIcon: '📰',
    command: '/updates',
    defaultResponse: '🔔 Get the latest updates!\n\nJoin our channel: @yourchannel\nEnable notifications to never miss anything.',
    description: 'Show update notifications info',
    needsSetup: false,
    setupInstructions: null
  },
  {
    key: 'media',
    category: 'Content & Media',
    categoryIcon: '📰',
    command: '/media',
    defaultResponse: '🎬 Our Media:\n\nYouTube: https://youtube.com/yourchannel\nTelegram: @yourchannel',
    description: 'Share media links',
    needsSetup: false,
    setupInstructions: null
  },

  // ═══ E-COMMERCE & PRODUCTS ═══
  {
    key: 'shop',
    category: 'E-commerce',
    categoryIcon: '🛒',
    command: '/shop',
    defaultResponse: '🛒 Welcome to our shop!\n\nVisit: https://yourshop.com\nOr contact: @yoursupport to order',
    description: 'Direct users to your shop',
    needsSetup: false,
    setupInstructions: null
  },
  {
    key: 'products',
    category: 'E-commerce',
    categoryIcon: '🛒',
    command: '/products',
    defaultResponse: '📦 Our Products:\n\nVisit our website to see all products: https://yourshop.com',
    description: 'Show product catalogue',
    needsSetup: false,
    setupInstructions: null
  },
  {
    key: 'order',
    category: 'E-commerce',
    categoryIcon: '🛒',
    command: '/order',
    defaultResponse: '🛍️ To place an order:\n\n1. Visit: https://yourshop.com\n2. Or contact: @yoursupport\n3. We will get back to you within 24 hours',
    description: 'How to place an order',
    needsSetup: false,
    setupInstructions: null
  },
  {
    key: 'price',
    category: 'E-commerce',
    categoryIcon: '🛒',
    command: '/price',
    defaultResponse: '💲 Price List:\n\nVisit our website for full pricing: https://yourshop.com\nOr contact: @yoursupport',
    description: 'Show price list',
    needsSetup: false,
    setupInstructions: null
  },
  {
    key: 'track',
    category: 'E-commerce',
    categoryIcon: '🛒',
    command: '/track',
    defaultResponse: '📦 Track your order:\n\nContact support with your order ID: @yoursupport',
    description: 'Order tracking info',
    needsSetup: false,
    setupInstructions: null
  },

  // ═══ GAMES & ENTERTAINMENT ═══
  {
    key: 'play',
    category: 'Games & Entertainment',
    categoryIcon: '🎮',
    command: '/play',
    defaultResponse: '🎮 Games coming soon!\n\nStay tuned for exciting games and prizes.',
    description: 'Show games menu',
    needsSetup: false,
    setupInstructions: null
  },
  {
    key: 'score',
    category: 'Games & Entertainment',
    categoryIcon: '🎮',
    command: '/score',
    defaultResponse: '🏆 Your Score:\n\nGame scores coming soon!',
    description: 'Show user score',
    needsSetup: false,
    setupInstructions: null
  },
  {
    key: 'spin',
    category: 'Games & Entertainment',
    categoryIcon: '🎮',
    command: '/spin',
    defaultResponse: '🎰 Spin wheel coming soon!\n\nCheck back later for your chance to win.',
    description: 'Spin the wheel game',
    needsSetup: false,
    setupInstructions: null
  },
  {
    key: 'trivia',
    category: 'Games & Entertainment',
    categoryIcon: '🎮',
    command: '/trivia',
    defaultResponse: '🧠 Trivia games coming soon!\n\nJoin our channel for updates: @yourchannel',
    description: 'Trivia game',
    needsSetup: false,
    setupInstructions: null
  },

  // ═══ CUSTOMER SERVICE ═══
  {
    key: 'feedback',
    category: 'Customer Service',
    categoryIcon: '⭐',
    command: '/feedback',
    defaultResponse: '📝 We value your feedback!\n\nPlease send your feedback to: @yoursupport\n\nOr email: feedback@yoursite.com',
    description: 'Collect user feedback',
    needsSetup: false,
    setupInstructions: null
  },
  {
    key: 'complaint',
    category: 'Customer Service',
    categoryIcon: '⭐',
    command: '/complaint',
    defaultResponse: '📢 To submit a complaint:\n\nContact: @yoursupport\nWe respond within 24 hours.',
    description: 'Handle complaints',
    needsSetup: false,
    setupInstructions: null
  },
  {
    key: 'status',
    category: 'Customer Service',
    categoryIcon: '⭐',
    command: '/status',
    defaultResponse: '✅ Bot Status: Online\n\nAll systems operational.',
    description: 'Show bot/service status',
    needsSetup: false,
    setupInstructions: null
  },
  {
    key: 'book',
    category: 'Customer Service',
    categoryIcon: '⭐',
    command: '/book',
    defaultResponse: '📅 Book an appointment:\n\nContact: @yoursupport\nOr visit: https://yoursite.com/book',
    description: 'Booking/appointment info',
    needsSetup: false,
    setupInstructions: null
  },
]

export const COMMAND_CATEGORIES = [
  'Universal',
  'Marketing & Growth', 
  'Community',
  'Earnings & Payments',
  'Content & Media',
  'E-commerce',
  'Games & Entertainment',
  'Customer Service'
]

export function getCommandsByCategory(category: string) {
  return PREBUILT_COMMANDS.filter(cmd => cmd.category === category)
}
