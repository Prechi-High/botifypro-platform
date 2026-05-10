with open('apps/bot-engine/src/webhook.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Find where to insert network handlers — after the Back button handler
# Look for the withdraw state handling section
anchor = "      if (text === '\u2b05\ufe0f Back') { const freshUser = await prisma.botUser.findUnique({ where: { id: botUser.id } }); await handleStart(bot, freshUser || botUser, chatId); return }"

new_handlers = """      if (text === '\u2b05\ufe0f Back') { const freshUser = await prisma.botUser.findUnique({ where: { id: botUser.id } }); await handleStart(bot, freshUser || botUser, chatId); return }

      // Network selection for deposit
      const depositNetworkPending = await redisGet(`deposit_network_pending:\${botUser.id}`)
      if (depositNetworkPending) {
        const depositNet = DEPOSIT_NETWORKS.find(n => n.label === text)
        if (depositNet) {
          await redisDel(`deposit_network_pending:\${botUser.id}`)
          const settings = bot.settings as any
          const selectedPlanId = await redisGet(`invest_selected_plan:\${botUser.id}`)
          const plan = selectedPlanId ? await (prisma as any).investmentPlan.findUnique({ where: { id: selectedPlanId } }) : null
          const depositAmount = plan ? Number(plan.activationAmount) : Number(settings.proPlanDepositMin || 10)
          try {
            const response = await axios.post(
              'https://api.oxapay.com/v1/payment/white-label',
              {
                amount: depositAmount, currency: 'USD',
                pay_currency: depositNet.payCurrency, network: depositNet.network,
                lifetime: 30, fee_paid_by_payer: 0, under_paid_coverage: 2,
                callback_url: `\${process.env.WEBHOOK_BASE_URL}/webhooks/oxapay-pro/\${bot.id}`,
                description: `VIP botId:\${bot.id} userId:\${botUser.id} planId:\${selectedPlanId || ''}`
              },
              { headers: { 'merchant_api_key': settings.proOxapayMerchantKey, 'Content-Type': 'application/json' } }
            )
            if (response.data?.status === 200) {
              const inv = response.data.data
              await redisSet(`pro_deposit:\${bot.id}:\${inv.track_id}`, JSON.stringify({ botUserId: botUser.id, chatId, botToken: bot.botToken, planId: selectedPlanId || '' }), 1800)
              const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=\${encodeURIComponent(inv.address)}`
              await sendMessage(bot.botToken, chatId,
                `\U0001f4b3 <b>VIP Activation Deposit</b>\\n\\nNetwork: <b>\${depositNet.label}</b>\\nSend exactly <b>\${inv.pay_amount} \${depositNet.payCurrency}</b> to:\\n<code>\${inv.address}</code>\\n\\n\u23f1 Expires in: <b>30 minutes</b>\\n\U0001f4f7 QR: \${qrUrl}\\n\\n\u2705 VIP activates automatically once confirmed.`,
                { keyboard: [[{ text: '\u2b05\ufe0f Back to Plans' }]], resize_keyboard: true, persistent: true, one_time_keyboard: false }
              )
            } else {
              await sendMessage(bot.botToken, chatId, '\u274c Could not generate deposit address. Try again later.')
            }
          } catch {
            await sendMessage(bot.botToken, chatId, '\u274c Deposit failed. Try again later.')
          }
          return
        }
      }

      // Network selection for withdrawal
      const withdrawNetworkState = await redisGet('withdraw_state:' + botUser.id)
      if (withdrawNetworkState === 'awaiting_network') {
        const withdrawNet = WITHDRAW_NETWORKS.find(n => n.label === text)
        if (withdrawNet) {
          await redisSet('withdraw_network:' + botUser.id, withdrawNet.network, 600)
          await redisSet('withdraw_state:' + botUser.id, 'awaiting_address', 600)
          const savedAddress = await redisGet(`withdraw_saved_address:\${botUser.id}`) || null
          const sym = bot.settings?.currencySymbol || '\U0001fa99'
          const savedAmount = await redisGet('withdraw_amount:' + botUser.id)
          const amount = savedAmount ? Number(savedAmount) : 0
          const rate = Number(bot.settings?.usdToCurrencyRate || 1000)
          const netUsd = (amount / rate) * (1 - Number(bot.settings?.withdrawFeePercent || 0) / 100)
          if (savedAddress) {
            await sendMessage(bot.botToken, chatId,
              `\U0001f4e4 <b>Withdrawal: \${amount.toLocaleString()} \${sym}</b>\\n\u2248 \${netUsd.toFixed(4)} USD\\nNetwork: <b>\${withdrawNet.label}</b>\\n\\nYou have a saved address:\\n<code>\${savedAddress}</code>\\n\\nUse this address or enter a new one?`,
              { inline_keyboard: [
                [{ text: '\u2705 Use Saved Address', callback_data: 'withdraw_use_saved' }],
                [{ text: '\u270f\ufe0f Enter New Address', callback_data: 'withdraw_new_address' }],
                [{ text: '\u274c Cancel', callback_data: 'cmd_cancel_withdraw' }]
              ]}
            )
          } else {
            await sendMessage(bot.botToken, chatId,
              `\U0001f4e4 <b>Withdrawal: \${amount.toLocaleString()} \${sym}</b>\\n\u2248 \${netUsd.toFixed(4)} USD\\nNetwork: <b>\${withdrawNet.label}</b>\\n\\nEnter your <b>\${withdrawNet.label}</b> wallet address:\\n<i>\${withdrawNet.hint}</i>\\n\\n\u23f1 You have 10 minutes.`,
              { inline_keyboard: [[{ text: '\u274c Cancel', callback_data: 'cmd_cancel_withdraw' }]] }
            )
          }
          return
        }
      }"""

if anchor in content:
    content = content.replace(anchor, new_handlers, 1)
    with open('apps/bot-engine/src/webhook.ts', 'w', encoding='utf-8') as f:
        f.write(content)
    print('SUCCESS: network handlers added')
else:
    print('Anchor not found')
    idx = content.find('\u2b05\ufe0f Back')
    print(f'Back button at: {idx}')
    if idx > -1:
        print(repr(content[idx-10:idx+100]))
