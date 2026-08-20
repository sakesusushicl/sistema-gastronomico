'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface OrderItem {
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  special_notes?: string;
}

interface Order {
  id: number;
  daily_order_number: number;
  order_type: string;
  status: 'PENDING' | 'IN_KITCHEN' | 'READY' | 'DELIVERED';
  total_amount: number;
  delivery_address?: string;
  created_at: string;
  order_items: OrderItem[];
}

export default function GastronomicSystem() {
  const [activeTab, setActiveTab] = useState<'kds' | 'pos'>('kds');
  const [orders, setOrders] = useState<Order[]>([]);

  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [orderType, setOrderType] = useState<'DELIVERY' | 'PICKUP'>('DELIVERY');
  const [selectedProduct, setSelectedProduct] = useState('Promo 30 Piezas Mixtas');
  const [productPrice, setProductPrice] = useState(14990);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchOrders = async () => {
    const { data } = await supabase
      .from('orders')
      .select('id, daily_order_number, order_type, status, total_amount, delivery_address, created_at, order_items(product_name, quantity, special_notes, unit_price, subtotal)')
      .in('status', ['PENDING', 'IN_KITCHEN', 'READY'])
      .order('created_at', { ascending: true });
    if (data) setOrders(data as Order[]);
  };

  useEffect(() => {
    fetchOrders();
    const channel = supabase
      .channel('kds-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchOrders();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const updateOrderStatus = async (orderId: number, nextStatus: string) => {
    await supabase.from('orders').update({ status: nextStatus }).eq('id', orderId);
    fetchOrders();
  };

  // Impresión mediante iframe nativo
  const printOrderDirect = (order: Order) => {
    const existingIframe = document.getElementById('receipt-print-iframe');
    if (existingIframe) existingIframe.remove();

    const iframe = document.createElement('iframe');
    iframe.id = 'receipt-print-iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const itemsHtml = (order.order_items || [])
      .map(
        (it) => `
        <div style="margin-bottom: 6px;">
          <div style="font-size: 15px; font-weight: bold;">${it.quantity}x ${it.product_name}</div>
          ${it.special_notes ? `<div style="font-size: 12px; font-style: italic; padding-left: 6px;">** ${it.special_notes}</div>` : ''}
        </div>
      `
      )
      .join('');

    const formattedDate = new Date(order.created_at || Date.now()).toLocaleDateString('es-CL');
    const formattedTime = new Date(order.created_at || Date.now()).toLocaleTimeString('es-CL', {
      hour: '2-digit',
      minute: '2-digit'
    });

    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            @page {
              margin: 0;
              size: auto;
            }
            body {
              font-family: 'Courier New', Courier, monospace;
              width: 72mm;
              margin: 0 auto;
              padding: 4mm;
              color: #000;
              background: #fff;
              font-size: 13px;
              line-height: 1.25;
            }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .divider { border-top: 1px dashed #000; margin: 6px 0; }
            .row { display: flex; justify-content: space-between; }
          </style>
        </head>
        <body>
          <div class="center bold" style="font-size: 17px;">SAKESU SUSHI</div>
          <div class="center" style="font-size: 11px; margin-top: 2px;">${formattedDate} - ${formattedTime}</div>
          <div class="divider"></div>
          <div class="bold" style="font-size: 17px;">ORDEN: #${order.daily_order_number}</div>
          <div class="bold" style="font-size: 13px;">TIPO: ${order.order_type}</div>
          ${order.delivery_address ? `<div style="font-size: 12px; margin-top: 3px;">DIR: ${order.delivery_address}</div>` : ''}
          <div class="divider"></div>
          <div style="margin: 6px 0;">${itemsHtml}</div>
          <div class="divider"></div>
          <div class="row bold" style="font-size: 15px;">
            <span>TOTAL:</span>
            <span>$${order.total_amount?.toLocaleString('es-CL')}</span>
          </div>
          <div class="center" style="margin-top: 10px; font-size: 11px;">- Comanda de Cocina -</div>
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    }, 400);
  };

  const addItemToCart = () => {
    setCart([
      ...cart,
      {
        product_name: selectedProduct,
        quantity,
        unit_price: productPrice,
        subtotal: productPrice * quantity,
        special_notes: notes
      }
    ]);
    setNotes('');
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;
    setIsSubmitting(true);
    const total = cart.reduce((acc, item) => acc + item.subtotal, 0);
    const dailyNum = Math.floor(Math.random() * 900) + 100;

    const { data: orderData } = await supabase
      .from('orders')
      .insert([
        {
          daily_order_number: dailyNum,
          order_type: orderType,
          status: 'PENDING',
          delivery_address: orderType === 'DELIVERY' ? deliveryAddress : 'Retiro en Local',
          total_amount: total
        }
      ])
      .select()
      .single();

    if (orderData) {
      await supabase.from('order_items').insert(
        cart.map((item) => ({
          order_id: orderData.id,
          ...item
        }))
      );
      const fullOrder: Order = { ...orderData, order_items: cart };
      setCart([]);
      setDeliveryAddress('');
      setActiveTab('kds');
      fetchOrders();
      printOrderDirect(fullOrder);
    }
    setIsSubmitting(false);
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', color: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', backgroundColor: '#1e293b', borderBottom: '1px solid #334155' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '22px' }}>🍣</span>
          <h1 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>Sakesu Sushi Delivery</h1>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setActiveTab('kds')}
            style={{ padding: '8px 14px', borderRadius: '6px', fontWeight: 'bold', border: 'none', cursor: 'pointer', backgroundColor: activeTab === 'kds' ? '#3b82f6' : '#334155', color: '#fff' }}
          >
            🔥 Cocina ({orders.length})
          </button>
          <button
            onClick={() => setActiveTab('pos')}
            style={{ padding: '8px 14px', borderRadius: '6px', fontWeight: 'bold', border: 'none', cursor: 'pointer', backgroundColor: activeTab === 'pos' ? '#10b981' : '#334155', color: '#fff' }}
          >
            ➕ POS (Nuevo Pedido)
          </button>
        </div>
      </header>

      {activeTab === 'kds' && (
        <main style={{ padding: '20px' }}>
          {orders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px', color: '#94a3b8' }}>
              <h2>No hay pedidos pendientes</h2>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
              {orders.map((order) => (
                <div key={order.id} style={{ backgroundColor: '#1e293b', borderRadius: '10px', padding: '16px', borderTop: order.status === 'PENDING' ? '5px solid #eab308' : '5px solid #3b82f6' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '22px', fontWeight: 'bold', color: '#38bdf8' }}>#{order.daily_order_number}</span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => printOrderDirect(order)} style={{ backgroundColor: '#334155', color: '#fff', border: '1px solid #475569', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '12px' }}>
                        🖨️ Imprimir
                      </button>
                      <span style={{ fontSize: '11px', backgroundColor: '#334155', padding: '4px 6px', borderRadius: '4px' }}>{order.order_type}</span>
                    </div>
                  </div>
                  {order.delivery_address && <p style={{ fontSize: '12px', color: '#94a3b8', margin: '4px 0 10px 0' }}>📍 {order.delivery_address}</p>}
                  <hr style={{ borderColor: '#334155', margin: '8px 0' }} />
                  <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 14px 0' }}>
                    {order.order_items?.map((item, idx) => (
                      <li key={idx} style={{ marginBottom: '6px' }}>
                        <span style={{ color: '#fbbf24', fontWeight: 'bold' }}>{item.quantity}x</span> <strong>{item.product_name}</strong>
                        {item.special_notes && <div style={{ fontSize: '12px', color: '#f87171' }}>• {item.special_notes}</div>}
                      </li>
                    ))}
                  </ul>
                  {order.status === 'PENDING' && (
                    <button onClick={() => updateOrderStatus(order.id, 'IN_KITCHEN')} style={{ width: '100%', padding: '10px', backgroundColor: '#eab308', color: '#000', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                      ▶ Empezar
                    </button>
                  )}
                  {order.status === 'IN_KITCHEN' && (
                    <button onClick={() => updateOrderStatus(order.id, 'READY')} style={{ width: '100%', padding: '10px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                      ✓ Listo para Empaque
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </main>
      )}

      {activeTab === 'pos' && (
        <main style={{ padding: '20px', maxWidth: '650px', margin: '0 auto' }}>
          <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '10px' }}>
            <h2 style={{ fontSize: '18px', marginBottom: '16px' }}>Nuevo Pedido</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#94a3b8' }}>Tipo</label>
                <select value={orderType} onChange={(e: any) => setOrderType(e.target.value)} style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: '6px', backgroundColor: '#0f172a', color: '#fff', border: '1px solid #334155' }}>
                  <option value="DELIVERY">Delivery</option>
                  <option value="PICKUP">Retiro</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#94a3b8' }}>Dirección</label>
                <input type="text" placeholder="Ej: Pasaje Lomas Coloradas" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: '6px', backgroundColor: '#0f172a', color: '#fff', border: '1px solid #334155' }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '8px', alignItems: 'end', marginTop: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', color: '#94a3b8' }}>Producto</label>
                <select value={selectedProduct} onChange={(e) => { setSelectedProduct(e.target.value); setProductPrice(e.target.value.includes('50') ? 21990 : e.target.value.includes('30') ? 14990 : 3500); }} style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: '6px', backgroundColor: '#0f172a', color: '#fff', border: '1px solid #334155' }}>
                  <option value="Promo 30 Piezas Mixtas">Promo 30 ($14.990)</option>
                  <option value="Promo 50 Piezas Tempura">Promo 50 ($21.990)</option>
                  <option value="Handroll Pollo Teriyaki">Handroll Pollo ($3.500)</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '11px', color: '#94a3b8' }}>Cant.</label>
                <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: '6px', backgroundColor: '#0f172a', color: '#fff', border: '1px solid #334155' }} />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: '#94a3b8' }}>Salsas/Notas</label>
                <input type="text" placeholder="2 Teriyaki..." value={notes} onChange={(e) => setNotes(e.target.value)} style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: '6px', backgroundColor: '#0f172a', color: '#fff', border: '1px solid #334155' }} />
              </div>
              <button type="button" onClick={addItemToCart} style={{ padding: '8px 12px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>+ Añadir</button>
            </div>

            <div style={{ marginTop: '16px', backgroundColor: '#0f172a', padding: '12px', borderRadius: '6px' }}>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {cart.map((item, i) => (
                  <li key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #1e293b' }}>
                    <span>{item.quantity}x {item.product_name} {item.special_notes && `(${item.special_notes})`}</span>
                    <span>${item.subtotal.toLocaleString('es-CL')}</span>
                  </li>
                ))}
              </ul>
              <div style={{ marginTop: '10px', textAlign: 'right', fontWeight: 'bold' }}>
                Total: ${cart.reduce((acc, it) => acc + it.subtotal, 0).toLocaleString('es-CL')}
              </div>
            </div>

            <button onClick={handleCreateOrder} disabled={isSubmitting || cart.length === 0} style={{ width: '100%', padding: '12px', marginTop: '14px', backgroundColor: cart.length > 0 ? '#10b981' : '#475569', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: cart.length > 0 ? 'pointer' : 'not-allowed' }}>
              {isSubmitting ? 'Enviando...' : '🚀 Enviar e Imprimir Comanda'}
            </button>
          </div>
        </main>
      )}
    </div>
  );
}
