with open('apps/bot-engine/src/webhook.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the deposit to activate handler to show network selection first
idx = content.find("// Investment plan deposit button")
end_idx = content.find("return\n      }\n      // Investment plan selection", idx)
old_block = content[idx:end_idx + len("return\n      }")]

new_block = """// Investment plan deposit button — show network selection first
      if (text.startsWith('\U0001f4b3 Deposit ') && text.endsWith('to Activate')) {
        const settings = bot.settings as any
        if (!settings?.proOxapayConfigured || !settings?.proOxapayMerchantKey) {
          await sendMessage(bot.botToken, chatId, '\u274c VIP deposit not configured. Contact bot owner.')
          return
        }
        // Store that we're in deposit flow, then show network selection
        await redisSet(`deposit_network_pending:\${botUser.id}`, 'pro', 600)
        await showDepositNetworkSelection(bot.botToken, chatId)
        return
      }"""

content = content.replace(old_block, new_block)
with open('apps/bot-engine/src/webhook.ts', 'w', encoding='utf-8') as f:
    f.write(content)
print('SUCCESS: deposit handler updated to show network selection')
