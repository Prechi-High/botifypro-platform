NETWORKS = [
    ('USDT TRC20', 'USDT', 'TRC20'),
    ('USDT BEP20', 'USDT', 'BEP20'),
    ('USDT ERC20', 'USDT', 'ERC20'),
    ('USDT Polygon', 'USDT', 'POLYGON'),
    ('USDT Arbitrum', 'USDT', 'ARBITRUM'),
    ('USDT Solana', 'USDT', 'SOL'),
]

# Network selection keyboard helper (to be added to commands.ts)
NETWORK_KEYBOARD = """
export const DEPOSIT_NETWORKS = [
  { label: '\U0001f7e2 USDT TRC20 (Tron)', payCurrency: 'USDT', network: 'TRC20' },
  { label: '\U0001f7e1 USDT BEP20 (BSC)', payCurrency: 'USDT', network: 'BEP20' },
  { label: '\U0001f535 USDT ERC20 (Ethereum)', payCurrency: 'USDT', network: 'ERC20' },
  { label: '\U0001f7e3 USDT Polygon', payCurrency: 'USDT', network: 'POLYGON' },
  { label: '\u26aa USDT Arbitrum', payCurrency: 'USDT', network: 'ARBITRUM' },
  { label: '\U0001f534 USDT Solana', payCurrency: 'USDT', network: 'SOL' },
]

export const WITHDRAW_NETWORKS = [
  { label: '\U0001f7e2 TRC20 (Tron)', network: 'TRC20', hint: 'Starts with T, 34 chars' },
  { label: '\U0001f7e1 BEP20 (BSC)', network: 'BEP20', hint: 'Starts with 0x, 42 chars' },
  { label: '\U0001f535 ERC20 (Ethereum)', network: 'ERC20', hint: 'Starts with 0x, 42 chars' },
  { label: '\U0001f7e3 Polygon', network: 'POLYGON', hint: 'Starts with 0x, 42 chars' },
  { label: '\u26aa Arbitrum', network: 'ARBITRUM', hint: 'Starts with 0x, 42 chars' },
  { label: '\U0001f534 Solana', network: 'SOL', hint: 'Base58 address, 32-44 chars' },
]

export async function showNetworkSelection(botToken: string, chatId: number, purpose: 'deposit' | 'withdraw') {
  const networks = purpose === 'deposit' ? DEPOSIT_NETWORKS : WITHDRAW_NETWORKS
  const keyboard = networks.map(n => [{ text: n.label }])
  keyboard.push([{ text: '\u2b05\ufe0f Back' }])
  const title = purpose === 'deposit'
    ? '\U0001f4b3 <b>Select Deposit Network</b>\\n\\nChoose the network you will send from:'
    : '\U0001f4b3 <b>Select Withdrawal Network</b>\\n\\nChoose the network to receive your funds:'
  const { sendMessage } = await import('./commands')
  await sendMessage(botToken, chatId, title, {
    keyboard, resize_keyboard: true, persistent: true, one_time_keyboard: false
  })
}
"""

print("Network constants defined")
print("Networks:", [n[0] for n in NETWORKS])
