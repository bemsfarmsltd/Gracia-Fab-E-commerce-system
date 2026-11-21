import Groq from 'groq-sdk'
import Product from '../models/Product.js'
import logger from '../utils/logger.js'
import { sendServerError } from '../utils/httpErrors.js'
import { groqModel } from '../config/ai.js'

// Initialize lazily so dotenv loads first
let groqClient = null
const getGroq = () => {
  if (!groqClient) {
    groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY })
  }
  return groqClient
}
// Answers arrive as labels ("Oily Skin", "4C Coily & Tight Curls"); the
// catalogue uses single words ("oily", "coily"). Match on whole words.
const STOP_WORDS = new Set(['and', 'the', 'for', 'with', 'skin', 'hair', 'tight', 'care'])
const words = (text) =>
  String(text || '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !STOP_WORDS.has(w))
const mentions = (answer, value) => {
  const v = String(value || '').toLowerCase()
  return v && v !== 'all' && words(answer).some((w) => v.split(/\s+/).includes(w))
}

// Scoring engine as fallback
const scoreProduct = (product, userProfile) => {
  let score = 0
  const { skinType, skinConcerns, hairType, hairConcerns, budget, occasion } = userProfile
  const lookingFor = String(userProfile.lookingFor || '').toLowerCase()

  if (lookingFor?.includes('skincare') && product.category === 'skincare') score += 40
  if (lookingFor?.includes('haircare') && product.category === 'haircare') score += 40
  if (lookingFor?.includes('wig') && product.category === 'wig') score += 40
  if (lookingFor?.includes('bridal') && product.category === 'bridal') score += 40
  if (lookingFor?.includes('everything')) score += 15
  if (skinType && product.suitableFor?.skinType?.some((v) => mentions(skinType, v))) score += 25
  if (skinType && product.suitableFor?.skinType?.includes('all')) score += 15
  if (hairType && product.suitableFor?.hairType?.some((v) => mentions(hairType, v))) score += 25

  if (skinConcerns) {
    const concerns = words(skinConcerns)
    concerns.forEach(concern => {
      if (product.tags?.some(t => t.toLowerCase().includes(concern))) score += 15
      if (product.suitableFor?.concern?.some(c => c.toLowerCase().includes(concern))) score += 10
    })
  }

  if (hairConcerns) {
    const concerns = words(hairConcerns)
    concerns.forEach(concern => {
      if (product.tags?.some(t => t.toLowerCase().includes(concern))) score += 15
      if (product.suitableFor?.concern?.some(c => c.toLowerCase().includes(concern))) score += 10
    })
  }

  if (budget) {
    if (budget.includes('under 10000') && product?.price < 10000) score += 20
    if (budget.includes('10000 to 50000') && product?.price >= 10000 && product?.price <= 50000) score += 20
    if (budget.includes('50000 to 100000') && product?.price > 50000 && product?.price <= 100000) score += 20
    if (budget.includes('above 100000') && product?.price > 100000) score += 20
  }

  if (occasion?.includes('wedding') || occasion?.includes('bridal')) {
    if (product.category === 'bridal') score += 30
  }

  if (product.isFeatured) score += 10
  return score
}

// The reason states only what actually matched (no invented popularity or results).
const generateReason = (product, userProfile) => {
  const { skinType, hairType, skinConcerns, hairConcerns, occasion } = userProfile
  const sf = product.suitableFor || {}
  const parts = []
  const skin = (sf.skinType || []).find((v) => mentions(skinType, v))
  if (skin) parts.push(`Suited to ${skin} skin.`)
  else if ((sf.skinType || []).includes('all') && product.category === 'skincare') parts.push('Suits all skin types.')
  const hair = (sf.hairType || []).find((v) => mentions(hairType, v))
  if (hair) parts.push(`Made for ${hair} hair.`)
  const asked = [...words(skinConcerns), ...words(hairConcerns)]
  const listed = [...(sf.concern || []), ...(product.tags || [])].map((t) => String(t).toLowerCase())
  const hits = [...new Set(listed.filter((t) => asked.some((w) => t.split(/\s+/).includes(w))))].slice(0, 2)
  if (hits.length) parts.push(`Its listing mentions ${hits.join(' and ')}.`)
  if (product.category === 'bridal' && /wedding|bridal/i.test(String(occasion || ''))) parts.push('Chosen for your wedding.')
  if (parts.length) return parts.join(' ')
  const label = { skincare: 'skincare', haircare: 'haircare', wig: 'wig', bridal: 'bridal' }[product.category] || 'beauty'
  return `A ${label} product from our shelves that fits what you told us.`
}

const generateTip = (product) => {
  const tips = {
    skincare: [
      'Apply on freshly cleansed skin every morning and night for best results.',
      'Use consistently for at least 4 weeks to see visible improvements.',
      'Always follow with SPF during the day to protect your results.',
      'Start with a patch test if you have sensitive skin.'
    ],
    haircare: [
      'Apply to damp hair after washing for maximum absorption.',
      'Focus on the scalp and ends where your hair needs the most care.',
      'Use at least twice a week for noticeable results within a month.',
      'Seal in moisture by covering with a satin scarf overnight.'
    ],
    wig: [
      'Store on a wig stand to maintain its shape when not in use.',
      'Use a wig cap underneath for a more natural and secure fit.',
      'Detangle gently from ends to roots with a wide-tooth comb.',
      'Avoid sleeping in your wig to extend its lifespan.'
    ],
    bridal: [
      'Start your bridal skincare routine at least 4–6 weeks before your wedding day.',
      'Do a trial run with all products before the big day to avoid surprises.',
      'Keep blotting papers handy on your wedding day for a fresh look all day.',
      'Stay hydrated — it is the secret to a natural bridal glow!'
    ]
  }
  const categoryTips = tips[product.category] || tips.skincare
  return categoryTips[Math.floor(Math.random() * categoryTips.length)]
}

// @desc  Get AI beauty recommendations
// @route POST /api/recommend
export const getRecommendations = async (req, res) => {
  const { skinType, skinConcerns, hairType, hairConcerns, lookingFor, budget, occasion } = req.body

  try {
    const everything = await Product.find({})
    const inStock = (p) => Number(p.stock) > 0 && p.isInStock !== false
    const buyable = everything.filter(inStock)
    // Recommend what customers can actually buy; only widen to the whole
    // catalogue when fewer than 3 products are in stock.
    const allProducts = buyable.length >= 3
      ? buyable
      : [...buyable, ...everything.filter((p) => !inStock(p))]
    if (allProducts.length === 0) {
      return res.json({ success: true, recommendations: [], source: 'none' })
    }

    const productList = allProducts.map(p => ({
      id: p._id,
      name: p.name,
      category: p.category,
      price: p.price,
      brand: p.brand,
      tags: p.tags,
      suitableFor: p.suitableFor,
      description: String(p.description || '').substring(0, 120)
    }))

    const prompt = `You are Gracia Fab AI, an expert beauty advisor specializing in skincare, haircare, wigs and bridal beauty for African women.

A user has shared their beauty profile:
- Skin Type: ${skinType || 'Not specified'}
- Skin Concerns: ${skinConcerns || 'None'}
- Hair Type: ${hairType || 'Not specified'}
- Hair Concerns: ${hairConcerns || 'None'}
- Looking For: ${lookingFor || 'General recommendations'}
- Budget: ${budget || 'Any'}
- Occasion: ${occasion || 'Everyday'}

Available products:
${JSON.stringify(productList, null, 2)}

Recommend the 3 most suitable products from the list above based on the user profile. Base each reason only on the product data above (category, tags, suitableFor, description). Do not mention popularity, reviews, ratings, customer results, guarantees or medical claims.

Respond ONLY with a valid JSON object matching this structure:
{
  "recommendations": [
    {
      "productId": "the product id string",
      "reason": "warm 1-2 sentence explanation of why this suits this user",
      "tip": "practical pro beauty tip for using this product"
    }
  ]
}`

    logger.info('Calling Groq AI for recommendations')

    let recommendations = null

    try {
      const completion = await getGroq().chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: groqModel(),
        temperature: 0.7,
        max_tokens: 1024,
        response_format: { type: "json_object" }
      })

      const rawText = completion.choices[0]?.message?.content || ''
      logger.info('Groq responded')

      const parsed = JSON.parse(rawText.trim())
      if (parsed && Array.isArray(parsed.recommendations)) {
        recommendations = parsed.recommendations
        logger.info('AI recommendations parsed successfully')
      }
    } catch (aiError) {
      logger.warn({ err: aiError }, 'Groq AI failed, using rule-based fallback')
    }

    // Fallback to rule-based if AI fails
    if (!recommendations || recommendations.length === 0) {
      logger.info('Using rule-based recommendation engine')
      const scored = allProducts
        .map(product => ({ product, score: scoreProduct(product, { skinType, skinConcerns, hairType, hairConcerns, lookingFor, budget, occasion }) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)

      const results = scored.map(({ product }) => ({
        product,
        reason: generateReason(product, { skinType, hairType, skinConcerns, hairConcerns, occasion }),
        tip: generateTip(product)
      }))

      return res.json({ success: true, recommendations: results, source: 'rule-based' })
    }

    // Keep only picks that are real candidates (the AI can invent or repeat IDs).
    const byId = new Map(allProducts.map((p) => [String(p._id), p]))
    const seen = new Set()
    const validResults = recommendations
      .map((rec) => {
        const id = String(rec.productId || '')
        const product = byId.get(id)
        if (!product || seen.has(id)) return null
        seen.add(id)
        return { product, reason: String(rec.reason || '').slice(0, 400), tip: String(rec.tip || '').slice(0, 300) }
      })
      .filter(Boolean)
      .slice(0, 3)

    // If AI returned bad IDs, fall back
    if (validResults.length === 0) {
      const scored = allProducts
        .map(product => ({ product, score: scoreProduct(product, { skinType, skinConcerns, hairType, hairConcerns, lookingFor, budget, occasion }) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)

      return res.json({
        success: true,
        recommendations: scored.map(({ product }) => ({
          product,
          reason: generateReason(product, { skinType, hairType, skinConcerns, hairConcerns, occasion }),
          tip: generateTip(product)
        })),
        source: 'rule-based'
      })
    }

    res.json({ success: true, recommendations: validResults, source: 'groq-ai' })

  } catch (error) {
    return sendServerError(res, error, 'Recommendation error', 'We could not get your recommendations right now. Please try again.')
  }
}