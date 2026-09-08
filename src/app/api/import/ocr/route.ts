import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { classifyByKeywords } from '@/lib/classify'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

function extractProductObjects(text: string): any[] {
  const objects: any[] = []
  const regex = /\{[^{}]*\}/g
  let match
  while ((match = regex.exec(text)) !== null) {
    try {
      const obj = JSON.parse(match[0])
      if (obj && typeof obj === 'object') objects.push(obj)
    } catch (e) {
      // ignorar objetos malformados
    }
  }
  return objects
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')

    const prompt = `Lee la imagen de un remito/factura y extrae TODOS los productos. Normalizá los códigos de barras/SKU quitando espacios y guiones. Ejemplo: "7 797130-000101" -> "7797130000101". No omitas filas por códigos irregulares.

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

    const model = process.env.GROQ_VISION_MODEL || 'qwen/qwen3.8-27b'

    const completion = await groq.chat.completions.create({
      model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${base64}`,
              },
            },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 1000,
    })

    let content = completion.choices[0]?.message?.content || '{}'
    console.log('1. Respuesta cruda (primeros 1000):', content.slice(0, 1000))

    // Limpiar markdown
    content = content.trim()
    content = content.replace(/^```json\s*/i, '').replace(/\s*```$/i, '')
    content = content.replace(/^```\s*/i, '').replace(/\s*```$/i, '')

    // Intentar parseo directo
    try {
      const parsed = JSON.parse(content)
      if (parsed.products && Array.isArray(parsed.products)) {
        const classifiedProducts = parsed.products.map((p: any) => ({
          ...p,
          category: classifyByKeywords(p.name) || p.category || 'otros',
        }))
        return NextResponse.json({ products: classifiedProducts })
      }
    } catch (e) {
      console.log('Parseo directo falló, extrayendo objetos...')
    }

    // Extraer objetos individuales
    const objects = extractProductObjects(content)
    if (objects.length > 0) {
      console.log(`Se extrajeron ${objects.length} objetos individuales`)
      const products = objects
        .map(obj => ({
          name: obj.name || obj.nombre || obj.descripcion || 'Producto sin nombre',
          sku: obj.sku || obj.codigo || null,
          barcode: obj.barcode || obj.codigo_barras || null,
          quantity: parseFloat(obj.quantity || obj.cantidad) || 1,
          cost_price: parseFloat(obj.cost_price || obj.precio_costo) || 0,
          sale_price: parseFloat(obj.sale_price || obj.precio_venta) || 0,
          category: obj.category || obj.rubro || 'otros',
        }))
        .filter(p => p.name && p.name !== 'Producto sin nombre')
        .map(p => ({ ...p, category: classifyByKeywords(p.name) || p.category }))

      if (products.length > 0) {
        return NextResponse.json({ products })
      }
    }

    return NextResponse.json({
      raw: content,
      error: 'No se pudieron extraer productos',
      details: 'Ni el parseo directo ni la extracción de objetos funcionaron'
    }, { status: 422 })

  } catch (error: any) {
    console.error('Error en OCR:', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}