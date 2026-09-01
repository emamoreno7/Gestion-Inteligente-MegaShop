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

    const prompt = `Eres un asistente experto en digitalizar listas de productos de remitos, facturas o inventarios. Debes extraer cada producto con su cantidad exacta y detalles. Sigue estas reglas estrictamente:

1. Devuelve EXCLUSIVAMENTE un JSON válido, sin markdown, sin texto adicional.
2. El formato debe ser exactamente este:
{
  "products": [
    {
      "name": "nombre del producto",
      "sku": "código si existe",
      "barcode": "código de barras si existe",
      "quantity": 1,
      "cost_price": 0.0,
      "sale_price": 0.0,
      "category": "bazar|jugueteria|ropa|regaleria|otros"
    }
  ]
}
3. La cantidad (quantity) es crítica. Si en la imagen aparece una cantidad explícita para ese producto, úsala. Si no hay cantidad, asume 1.
4. El precio unitario debe ir en "cost_price". Si hay una columna "Precio unit." o "Unitario", extrae su valor numérico, ignorando puntos de miles y usando coma decimal. Por ejemplo: "8.500,00" se convierte en 8500.00. Si no hay precio, usa 0.
5. No agrupes productos diferentes en un solo registro. Cada variante (talle, color) debe ser un registro separado si se especifica.
6. Si la lista es muy larga (más de 50 productos), devuelve solo los primeros 50.
7. Si no puedes leer algún campo, deja null o 0 según corresponda.
7. Solo devuelve JSON válido.`

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
      max_tokens: 4000,
    })

    let content = completion.choices[0]?.message?.content || '{}'
    console.log('1. Respuesta cruda de Groq (primeros 1000):', content.slice(0, 1000))

    content = content.trim()
    content = content.replace(/^```json\s*/i, '').replace(/\s*```$/i, '')
    content = content.replace(/^```\s*/i, '').replace(/\s*```$/i, '')

    let parsed
    try {
      parsed = JSON.parse(content)
      if (parsed.products && Array.isArray(parsed.products)) {
        console.log('Parseo directo exitoso')
        // Clasificar con palabras clave
        const classifiedProducts = parsed.products.map((p: any) => ({
          ...p,
          category: classifyByKeywords(p.name) || p.category || 'otros',
        }))
        return NextResponse.json({ products: classifiedProducts })
      }
    } catch (e) {
      console.log('Parseo directo falló, intentando extraer objetos individuales...')
    }

    const objects = extractProductObjects(content)
    if (objects.length > 0) {
      console.log(`Se extrajeron ${objects.length} objetos individuales`)
      const products = objects.map(obj => {
        if (obj.name) return obj
        return {
          name: obj.nombre || obj.producto || obj.descripcion || 'Producto sin nombre',
          sku: obj.sku || obj.codigo || null,
          barcode: obj.barcode || obj.codigo_barras || null,
          quantity: obj.quantity || obj.cantidad || 1,
          cost_price: obj.cost_price || obj.precio_costo || 0,
          sale_price: obj.sale_price || obj.precio_venta || 0,
          category: obj.category || obj.rubro || 'otros',
        }
      }).filter(p => p.name && p.name !== 'Producto sin nombre')

      if (products.length > 0) {
        const classifiedProducts = products.map((p: any) => ({
          ...p,
          category: classifyByKeywords(p.name) || p.category || 'otros',
        }))
        return NextResponse.json({ products: classifiedProducts })
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