import { NextRequest, NextResponse } from 'next/server'
import { MercadoPagoConfig, Preference } from 'mercadopago'

export async function POST(req: NextRequest) {
  try {
    const { sale_id, amount, description } = await req.json()
    if (!sale_id || !amount) {
      return NextResponse.json({ error: 'Faltan sale_id o amount' }, { status: 400 })
    }

    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN
    if (!accessToken) {
      return NextResponse.json({ error: 'MERCADOPAGO_ACCESS_TOKEN no configurado' }, { status: 500 })
    }

    const client = new MercadoPagoConfig({ accessToken })
    const preference = new Preference(client)

    const result = await preference.create({
      body: {
        items: [
          {
            id: sale_id,
            title: description || 'Compra Mega Shop',
            quantity: 1,
            unit_price: Number(amount),
            currency_id: 'ARS',
          },
        ],
        external_reference: sale_id,
        notification_url: `${process.env.NEXT_PUBLIC_SITE_URL}/api/mercadopago/webhook`,
        back_urls: {
          success: `${process.env.NEXT_PUBLIC_SITE_URL}/pos?status=approved`,
          pending: `${process.env.NEXT_PUBLIC_SITE_URL}/pos?status=pending`,
          failure: `${process.env.NEXT_PUBLIC_SITE_URL}/pos?status=rejected`,
        },
        auto_return: 'approved',
      },
    })

    return NextResponse.json({ init_point: result.init_point })
  } catch (error: any) {
    console.error('Error creando preferencia:', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}