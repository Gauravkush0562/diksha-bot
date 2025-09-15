import { createBot, createProvider, createFlow, addKeyword, MemoryDB } from '@builderbot/bot'
import { BaileysProvider } from '@builderbot/provider-baileys'
import productsData from './products.json' // Make sure path is correct

const START_CHAT_IMAGE = 'https://i.postimg.cc/t7K1KvGB/startchat.png'
const categoryImages: Record<string, string> = {
  'Construction Material': 'https://i.postimg.cc/rz00YX3d/construction-material.jpg',
  'निर्माण सामग्री': 'https://i.postimg.cc/rz00YX3d/construction-material.jpg'
}

const ADMIN_NUMBER = '918218939069@s.whatsapp.net' // Your WhatsApp ID

const adapterDB = new MemoryDB()

// --- Step 1: Start Chat ---
const startChatFlow = addKeyword<BaileysProvider, MemoryDB>(['*'])
  .addAction(async (ctx, { flowDynamic, state }) => {
    const sessionStarted = await state.get('sessionStarted')
    if (!sessionStarted) {
      await flowDynamic([{
        body: '👋 Welcome to Diksha Steel & Building Materials!\n\nनमस्ते! दीक्षा स्टील एंड बिल्डिंग मटेरियल में आपका स्वागत है।',
        media: START_CHAT_IMAGE,
        buttons: ['Start Chat']
      }])
    }
  })

// --- Step 2: Language Selection ---
const languageFlow = addKeyword<BaileysProvider, MemoryDB>(['Start Chat'])
  .addAction(async (ctx, { flowDynamic }) => {
    await flowDynamic([{
      body: 'Please select your preferred language / कृपया अपनी पसंदीदा भाषा चुनें',
      buttons: ['English / अंग्रेज़ी', 'Hindi / हिन्दी']
    }])
  })

// --- Step 3: Capture Language and Show Category ---
const captureLanguageFlow = addKeyword<BaileysProvider, MemoryDB>(['English / अंग्रेज़ी', 'Hindi / हिन्दी'])
  .addAction(async (ctx, { flowDynamic, state }) => {
    const language = ctx.body
    await state.update({ sessionStarted: true, language })

    const categoryButtons = language.startsWith('English')
      ? ['Construction Material']
      : ['निर्माण सामग्री']

    await flowDynamic([{
      body: language.startsWith('English') ? 'What are you interested in? 🤔' : 'आप किसमें रुचि रखते हैं? 🤔',
      media: categoryImages[categoryButtons[0]],
      buttons: categoryButtons
    }])
  })

// --- Step 4: Product Selection ---
const productFlow = addKeyword<BaileysProvider, MemoryDB>(
  productsData.construction_material.flatMap(p => [p.name_en, p.name_hi])
)
.addAction(async (ctx, { flowDynamic, state }) => {
  const { language } = await state.get()
  const product = productsData.construction_material.find(p =>
    p.name_en === ctx.body || p.name_hi === ctx.body
  )

  if (product) {
    await state.update({ lastSelectedProduct: ctx.body })
    await flowDynamic([{
      body: language.startsWith('English')
        ? `You selected ${product.name_en}. Choose an option below:`
        : `आपने ${product.name_hi} चुना है। नीचे विकल्प चुनें:`,
      media: product.image,
      buttons: [
        'Get Latest Price',
        'Request Quote / कोटेशन मांगें',
        'Delivery Info / डिलीवरी जानकारी',
        'Product Details / उत्पाद विवरण',
        'Back to Categories / पिछली सूची'
      ]
    }])
  }
})

// --- Step 5a: Request Price (manual approval) ---
const requestPriceFlow = addKeyword<BaileysProvider, MemoryDB>(['Get Latest Price'])
.addAction(async (ctx, { flowDynamic, state, provider }) => {
  const { lastSelectedProduct, language } = await state.get()
  await flowDynamic([{
    body: language.startsWith('English')
      ? `Your request for the latest price has been sent. Please wait for approval.`
      : `आपकी नवीनतम कीमत के लिए अनुरोध भेज दिया गया है। कृपया अनुमोदन की प्रतीक्षा करें।`
  }])

  // Notify admin
  await provider.sendMessage(ADMIN_NUMBER, {
    text: `⚠️ ALERT: User ${ctx.from} requested price for ${lastSelectedProduct}. Reply with /price ${ctx.from} <product> <approved_price> to approve.`
  })
})

// --- Step 5b: Admin sends approved price ---
addKeyword(['/price'], { capture: true })
  .addAction(async (ctx, { provider }) => {
    const parts = ctx.body.split(' ')
    const userId = parts[1]
    const productName = parts[2]
    const approvedPrice = parts.slice(3).join(' ')

    await provider.sendMessage(userId, {
      text: `💰 Approved price for ${productName}: ${approvedPrice}`
    })

    await provider.sendMessage(ADMIN_NUMBER, {
      text: `✅ Price sent to ${userId} for ${productName}: ${approvedPrice}`
    })
  })

// --- Step 5c: Request Quote ---
const quoteFlow = addKeyword<BaileysProvider, MemoryDB>(['Request Quote / कोटेशन मांगें'])
.addAnswer('Please enter the quantity / कृपया मात्रा दर्ज करें:', { capture: true }, async (ctx, { state, flowDynamic, provider }) => {
  const { lastSelectedProduct, language } = await state.get()
  await flowDynamic([{
    body: language.startsWith('English')
      ? `✅ Quote request received for ${ctx.body} units of ${lastSelectedProduct}`
      : `✅ ${lastSelectedProduct} के ${ctx.body} यूनिट के लिए कोटेशन अनुरोध प्राप्त हुआ`
  }])

  await provider.sendMessage(ADMIN_NUMBER, {
    text: `⚠️ ALERT: User ${ctx.from} requested a quote for ${lastSelectedProduct}, Quantity: ${ctx.body}`
  })
})

// --- Step 5d: Delivery Info ---
const deliveryFlow = addKeyword<BaileysProvider, MemoryDB>(['Delivery Info / डिलीवरी जानकारी'])
.addAnswer('Please enter your delivery location / कृपया अपनी डिलीवरी लोकेशन दर्ज करें:', { capture: true }, async (ctx, { state, flowDynamic, provider }) => {
  const { lastSelectedProduct, language } = await state.get()
  await flowDynamic([{
    body: language.startsWith('English')
      ? `✅ Delivery info received for ${lastSelectedProduct}. We will contact you soon.`
      : `✅ ${lastSelectedProduct} के लिए डिलीवरी जानकारी प्राप्त हुई। हम जल्द ही आपसे संपर्क करेंगे।`
  }])

  await provider.sendMessage(ADMIN_NUMBER, {
    text: `⚠️ ALERT: User ${ctx.from} entered delivery info for ${lastSelectedProduct}: ${ctx.body}`
  })
})

// --- Step 5e: Product Details ---
const detailsFlow = addKeyword<BaileysProvider, MemoryDB>(['Product Details / उत्पाद विवरण'])
  .addAction(async (ctx, { flowDynamic, state }) => {
    const { lastSelectedProduct, language } = await state.get()
    const product = productsData.construction_material.find(p =>
      p.name_en === lastSelectedProduct || p.name_hi === lastSelectedProduct
    )

    if (product) {
      await flowDynamic([{
        body: language.startsWith('English')
          ? `📄 Details for ${product.name_en}:\n- Price: ${product.price}\n- Promotion: ${product.promotion}`
          : `📄 ${product.name_hi} का विवरण:\n- कीमत: ${product.price}\n- प्रचार: ${product.promotion}`,
        media: product.image,
        buttons: ['Get Latest Price', 'Request Quote / कोटेशन मांगें', 'Delivery Info / डिलीवरी जानकारी', 'Back to Categories / पिछली सूची']
      }])
    }
  })

// --- Step 6: Back to Categories ---
addKeyword(['Back to Categories / पिछली सूची'])
  .addAction(async (ctx, { flowDynamic, state }) => {
    const { language } = await state.get()
    const categoryButtons = language.startsWith('English') ? ['Construction Material'] : ['निर्माण सामग्री']
    await flowDynamic([{
      body: language.startsWith('English') ? 'Please select a category:' : 'कृपया एक श्रेणी चुनें:',
      buttons: categoryButtons
    }])
  })

// --- Step 7: FAQ ---
const faqFlow = addKeyword(['FAQ', 'सामान्य प्रश्न'])
  .addAction(async (ctx, { flowDynamic, state }) => {
    const { language } = await state.get()
    const faqButtons = language.startsWith('English')
      ? ['Payment Options', 'Delivery Time', 'Stock Availability']
      : ['भुगतान विकल्प', 'डिलीवरी समय', 'स्टॉक उपलब्धता']

    await flowDynamic([{
      body: language.startsWith('English') ? 'Please select a question:' : 'कृपया एक प्रश्न चुनें:',
      buttons: faqButtons
    }])
  })

addKeyword(['Payment Options', 'भुगतान विकल्प'])
  .addAnswer('We accept cash, UPI, and bank transfer / हम नकद, यूपीआई और बैंक ट्रांसफर स्वीकार करते हैं।')
addKeyword(['Delivery Time', 'डिलीवरी समय'])
  .addAnswer('Delivery takes 2-5 days depending on your location / आपके स्थान के अनुसार डिलीवरी में 2-5 दिन लगते हैं।')
addKeyword(['Stock Availability', 'स्टॉक उपलब्धता'])
  .addAnswer('All items are available in stock / सभी वस्तुएँ स्टॉक में उपलब्ध हैं।')

// --- Create bot ---
const main = async () => {
  const adapterFlow = createFlow([
    startChatFlow,
    languageFlow,
    captureLanguageFlow,
    productFlow,
    requestPriceFlow,
    quoteFlow,
    deliveryFlow,
    detailsFlow,
    faqFlow
  ])

  const adapterProvider = createProvider(BaileysProvider)
  adapterProvider.initHttpServer(3000)

  await createBot({
    flow: adapterFlow,
    provider: adapterProvider,
    database: adapterDB,
  })
}

main()
