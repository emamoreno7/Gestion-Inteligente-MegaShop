import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { products } = await req.json()
    if (!products || !Array.isArray(products) || products.length === 0) {
      return NextResponse.json({ error: 'No products provided' }, { status: 400 })
    }

    const productList = products.map((p: any, idx: number) => `${idx + 1}. ${p.name}`).join('\n')

    const prompt = `Clasifica cada producto en UNA de estas categorías exactas: "bazar", "jugueteria", "ropa", "regaleria", "otros".

REGLAS ESTRICTAS:
- NUNCA clasifiques juguetes, muñecas, autos de juguete, pelotas, rompecabezas, juegos didácticos o artículos infantiles como "bazar". Esos son SIEMPRE "jugueteria".
- "bazar" es SOLO artículos de cocina, vajilla, ollas, vasos, termos, limpieza, decoración, ferretería menor.
- "ropa" incluye remeras, buzos, medias, camperas, pantalones, calzado, etc.
- "regaleria" incluye regalos, bijouterie, peluches, velas aromáticas.
- "otros" SOLO si no encaja claramente en ninguna categoría anterior.

Productos:
${productList}

Devuelve EXCLUSIVAMENTE un JSON válido con este formato:
{
  "classified": [
    { "index": 1, "category": "bazar" },
    { "index": 2, "category": "jugueteria" }
  ]
}
Solo devuelve JSON válido, sin markdown, sin texto adicional.`

    const model = process.env.GROQ_TEXT_MODEL || 'qwen/qwen3.8-27b'
    const completion = await groq.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.0,
      max_tokens: 2000,
    })

    let content = completion.choices[0]?.message?.content || '{}'
    console.log('Respuesta cruda de clasificación:', content)

    content = content.trim().replace(/^```json\s*/i, '').replace(/\s*```$/i, '')
    content = content.replace(/^```\s*/i, '').replace(/\s*```$/i, '')

    let parsed
    try {
      parsed = JSON.parse(content)
    } catch (e) {
      const start = content.indexOf('{')
      const end = content.lastIndexOf('}')
      if (start !== -1 && end !== -1 && end > start) {
        try {
          parsed = JSON.parse(content.slice(start, end + 1))
        } catch (e2) {
          return NextResponse.json({ raw: content, error: 'No se pudo parsear automáticamente' }, { status: 422 })
        }
      } else {
        return NextResponse.json({ raw: content, error: 'No se pudo parsear automáticamente' }, { status: 422 })
      }
    }

    return NextResponse.json(parsed)
  } catch (error: any) {
    console.error('Error en clasificación:', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}