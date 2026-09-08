import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { classifyByKeywords } from '@/lib/classify'

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY no configurada' }, { status: 500 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    const mimeType = file.type || 'image/jpeg'

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' })

    const prompt = `Lee la imagen de un remito/factura y extrae TODOS los productos. Normalizá los códigos de barras/SKU quitando espacios y guiones. No omitas filas por códigos irregulares.

Devuelve EXCLUSIVAMENTE un JSON válido con este formato:
{
  "products": [
    {
      "name": "nombre del producto",
      "sku": "código limpio si existe",
      "barcode": "código limpio si existe",
      "quantity": 1,
      "cost_price": 0.0,
      "sale_price": 0.0,
      "category": "bazar|regaleria|ropa|jugueteria|otros"
    }
  ]
}
Si no podés leer un campo, usá null. No uses markdown. Solo JSON válido.`

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64,
          mimeType,
        },
      },
    ])

    const response = await result.response
    const text = response.text()

    console.log('Respuesta Gemini (primeros 800):', text.slice(0, 800))

    let content = text.trim().replace(/^```json\s*/i, '').replace(/\s*```$/i, '')
    content = content.replace(/^```\s*/i, '').replace(/\s*```$/i, '')

    const parsed = JSON.parse(content)

    if (!parsed.products || !Array.isArray(parsed.products)) {
      return NextResponse.json({ error: 'Respuesta inválida de Gemini' }, { status: 422 })
    }

    const products = parsed.products.map((p: any) => ({
      ...p,
      category: classifyByKeywords(p.name) || p.category || 'otros',
    }))

    return NextResponse.json({ products })
  } catch (error: any) {
    console.error('Error en OCR Gemini:', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}