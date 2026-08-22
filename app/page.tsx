import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { amount, orderId } = await req.json();

    const MP_ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN;
    const TARGET_DEVICE_ID = process.env.POINT_DEVICE_ID;

    if (!MP_ACCESS_TOKEN || !TARGET_DEVICE_ID) {
      return NextResponse.json(
        { error: 'Faltan credenciales de Mercado Pago o Device ID en Vercel' },
        { status: 400 }
      );
    }

    // Enviar cobro directo a la Point Smart 2
    const response = await fetch(
      `https://api.mercadopago.com/point/integration-api/devices/${TARGET_DEVICE_ID}/payment-intents`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: Math.round(Number(amount)),
          description: `Orden #${orderId} - Sakesu Sushi`,
          additional_info: {
            external_reference: `orden_${orderId}`,
            print_on_terminal: true, // Imprime comprobante de pago en la Point Smart
          },
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.message || 'Error al conectar con la maquinita' },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true, paymentIntent: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
