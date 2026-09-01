import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

function normalizeNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') return value
  // Reemplazar puntos de miles y comas decimales
  let normalized = value.replace(/\./g, '').replace(',', '.')
  const parsed = parseFloat(normalized)
  return isNaN(parsed) ? 0 : parsed
}

function extractProductObjects(text: string): any[] {
  const objects: any[] = []
  const regex = /\{[^{}]*\}/g
  let match
  while ((match = regex.exec(text)) !== null) {
    try {
      const obj = JSON.parse(match[0])
      if (obj && typeof obj === 'object') objects.push(obj)
    } catch (e) {}
  }
  return objects
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })

    const arrayBuffer = await file.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')

    const prompt = `Lee la imagen del remito/factura. Extrae cada fila de la tabla de productos. La tabla tiene columnas: Código (o Código de barras), Descripción, Rubro, Cant., Precio unit., Subtotal.

Reglas estrictas:
1. Devuelve EXCLUSIVAMENTE un JSON válido, sin markdown.
2. Estructura:
{
  "products": [
    {
      "name": "descripción exacta del producto",
      "sku": "código o SKU",
      "barcode": "código de barras si hay",
      "quantity": 4,
      "cost_price": 8500.59,
      "sale_price": 0,
      "category": "bazar|jugueteria|ropa|regaleria|otros"
    }
  ]
}
3. La columna "Rubro" debe ser leída y mapeada a category. Si dice "Juguetería" -> "jugueteria", "Bazar" -> "bazar", "Ropa" -> "ropa", "Regalería" -> "regaleria". Si no hay columna Rubro, clasifica según el producto.
4. La cantidad es obligatoria; si no está, usa 1.
5. El precio unitario (costo de compra) debe ser numérico, respetando el formato argentino: 8.500,59 se interpreta como 8500.59. Si no hay, 0.
6. No agrupes productos. Cada fila de la tabla es un producto.
7. Solo devuelve JSON válido.`

    const model = process.env.GROQ_VISION_MODEL || 'qwen/qwen3.8-27b'
    const completion = await groq.chat.completions.create({
      model,
      messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } }] }],
      temperature: 0.1,
      max_tokens: 4000,
    })

    let content = completion.choices[0]?.message?.content || '{}'
    console.log('1. Respuesta cruda:', content.slice(0, 1000))

    content = content.trim().replace(/^```json\s*/i, '').replace(/\s*```$/i, '')
    content = content.replace(/^```\s*/i, '').replace(/\s*```$/i, '')

    let parsed
    try {
      parsed = JSON.parse(content)
      if (parsed.products && Array.isArray(parsed.products)) {
        // Normalizar números y category
        parsed.products = parsed.products.map((p: any) => ({
          ...p,
          quantity: parseInt(p.quantity || p.cantidad || 1),
          cost_price: normalizeNumber(p.cost_price || p.precio_unitario || 0),
          sale_price: normalizeNumber(p.sale_price || 0),
          category: p.category || p.rubro || 'otros',
        }))
        console.log('Parseo directo exitoso y normalizado')
        return NextResponse.json(parsed)
      }
    } catch (e) {
      console.log('Parseo directo falló, extrayendo objetos...')
    }

    const objects = extractProductObjects(content)
    if (objects.length > 0) {
      const products = objects.map(obj => ({
        name: obj.name || obj.descripcion || 'Producto',
        sku: obj.sku || obj.codigo || null,
        barcode: obj.barcode || null,
        quantity: parseInt(obj.quantity || obj.cantidad || 1),
        cost_price: normalizeNumber(obj.cost_price || obj.precio_unitario || 0),
        sale_price: normalizeNumber(obj.sale_price || 0),
        category: obj.category || obj.rubro || 'otros',
      })).filter(p => p.name !== 'Producto')

      if (products.length > 0) return NextResponse.json({ products })
    }

    return NextResponse.json({ raw: content, error: 'No se pudieron extraer productos' }, { status: 422 })
  } catch (error: any) {
    console.error('Error en OCR:', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}