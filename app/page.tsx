'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface OrderItem {
  id?: number;
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
  status: 'PENDING' | 'IN_KITCHEN' | 'READY' | 'ON_THE_WAY' | 'DELIVERED';
  channel: string;
  total_amount: number;
  delivery_address?: string;
  created_at: string;
  order_items: OrderItem[];
}

export default function GastronomicSystem() {
  const [activeTab, setActiveTab] = useState<'kds' | 'pos'>('kds');
  const [orders, setOrders] = useState<Order[]>([]);
  
  const [customerName, setCustomerName] = useState('');
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
      .select('id, daily_order_number, order_type, status, channel, total_amount, delivery_address, created_at, order_items(id, product_name, quantity, special_notes, unit_price, subtotal)')
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
    const updatePayload: any = { status: nextStatus };
    if (nextStatus === 'IN_KITCHEN') updatePayload.kitchen_started_at = new Date().toISOString();
    if (nextStatus === 'READY') updatePayload.ready_at = new Date().toISOString();

    await supabase.from('orders').update(updatePayload).eq('id', orderId);
    fetchOrders();
  };

  const addItemToCart = () => {
    const newItem: OrderItem = {
      product_name: selectedProduct,
      quantity: Number(quantity),
      unit_price: productPrice,
      subtotal: productPrice * Number(quantity),
      special_notes: notes
    };
    setCart([...cart, newItem]);
    setNotes('');
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) {
      alert('Debes agregar al menos un producto al pedido.');
      return;
    }
    setIsSubmitting(true);

    try {
      const total = cart.reduce((acc, item) => acc + item.subtotal, 0);
      const dailyNumber = Math.floor(Math.random() * 900) + 100;

      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert([
          {
            daily_order_number: dailyNumber,
            order_type: orderType,
            status: 'PENDING',
            channel: 'LOCAL_POS',
            delivery_address: orderType === 'DELIVERY' ? deliveryAddress : 'Retiro en Local',
            total_amount: total,
            payment_method: 'CASH',
            payment_status: 'PAID'
          }
        ])
        .select()
        .single();

      if (orderError) throw orderError;

      const itemsPayload = cart.map(item => ({
        order_id: orderData.id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.subtotal,
        special_notes: item.special_notes
      }));

      await supabase.from('order_items').insert(itemsPayload);

      setCart([]);
      setCustomerName('');
      setDeliveryAddress('');
      setActiveTab('kds');
      fetchOrders();
    } catch (err: any) {
      alert('Error al guardar comanda: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', color: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', backgroundColor: '#1e293b', borderBottom: '1px solid #334155' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '24px' }}>🍣</span>
          <h1 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0 }}>Sistema Gastronómico Live</h1>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setActiveTab('kds')}
            style={{
              padding: '10px 18px',
              borderRadius: '8px',
              fontWeight: 'bold',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: activeTab === 'kds' ? '#3b82f6' : '#334155',
              color: '#fff'
            }}
          >
            🔥 Pantalla Cocina ({orders.length})
          </button>
          <button
            onClick={() => setActiveTab('pos')}
            style={{
              padding: '10px 18px',
              borderRadius: '8px',
              fontWeight: 'bold',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: activeTab === 'pos' ? '#10b981' : '#334155',
              color: '#fff'
            }}
          >
            ➕ Nueva Comanda (POS)
          </button>
        </div>
      </header>

      {activeTab === 'kds' && (
        <main style={{ padding: '24px' }}>
          {orders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>
              <h2>🎉 No hay comandas pendientes</h2>
              <p>Las nuevas órdenes aparecerán aquí automáticamente en tiempo real.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
              {orders.map((order) => {
                const isPending = order.status === 'PENDING';
                const isInKitchen = order.status === 'IN_KITCHEN';

                return (
                  <div
                    key={order.id}
                    style={{
                      backgroundColor: '#1e293b',
                      borderRadius: '12px',
                      borderTop: isPending ? '6px solid #eab308' : isInKitchen ? '6px solid #3b82f6' : '6px solid #10b981',
                      padding: '18px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '26px', fontWeight: 'bold', color: '#38bdf8' }}>#{order.daily_order_number}</span>
                        <span style={{ fontSize: '12px', backgroundColor: '#334155', padding: '4px 8px', borderRadius: '6px', fontWeight: 'bold' }}>
                          {order.order_type}
                        </span>
                      </div>

                      {order.delivery_address && (
                        <p style={{ fontSize: '13px', color: '#94a3b8', margin: '6px 0 12px 0' }}>📍 {order.delivery_address}</p>
                      )}

                      <hr style={{ borderColor: '#334155', margin: '10px 0' }} />

                      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                        {order.order_items?.map((item, idx) => (
                          <li key={idx} style={{ marginBottom: '12px' }}>
                            <div style={{ fontSize: '17px', fontWeight: 'bold' }}>
                              <span style={{ color: '#fbbf24' }}>{item.quantity}x</span> {item.product_name}
                            </div>
                            {item.special_notes && (
                              <div style={{ fontSize: '13px', color: '#f87171', marginTop: '3px', fontWeight: '600' }}>
                                ⚠️ {item.special_notes}
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div style={{ marginTop: '20px' }}>
                      {isPending && (
                        <button
                          onClick={() => updateOrderStatus(order.id, 'IN_KITCHEN')}
                          style={{ width: '100%', padding: '14px', backgroundColor: '#eab308', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer' }}
                        >
                          ▶ Empezar a Preparar
                        </button>
                      )}
                      {isInKitchen && (
                        <button
                          onClick={() => updateOrderStatus(order.id, 'READY')}
                          style={{ width: '100%', padding: '14px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer' }}
                        >
                          ✓ Listo para Empaque
                        </button>
                      )}
                      {order.status === 'READY' && (
                        <button
                          onClick={() => updateOrderStatus(order.id, 'DELIVERED')}
                          style={{ width: '100%', padding: '14px', backgroundColor: '#475569', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer' }}
                        >
                          Entregar / Despachado
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      )}

      {activeTab === 'pos' && (
        <main style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
          <div style={{ backgroundColor: '#1e293b', padding: '24px', borderRadius: '12px' }}>
            <h2 style={{ fontSize: '20px', marginBottom: '20px' }}>📝 Registrar Nuevo Pedido</h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ fontSize: '13px', color: '#94a3b8' }}>Tipo de Entrega</label>
                <select
                  value={orderType}
                  onChange={(e: any) => setOrderType(e.target.value)}
                  style={{ width: '100%', padding: '10px', marginTop: '6px', borderRadius: '6px', backgroundColor: '#0f172a', color: '#fff', border: '1px solid #334155' }}
                >
                  <option value="DELIVERY">Delivery</option>
                  <option value="PICKUP">Retiro en Local</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '13px', color: '#94a3b8' }}>Dirección / Referencia</label>
                <input
                  type="text"
                  placeholder="Ej: Pasaje Los Aromos 123"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  style={{ width: '100%', padding: '10px', marginTop: '6px', borderRadius: '6px', backgroundColor: '#0f172a', color: '#fff', border: '1px solid #334155' }}
                />
              </div>
            </div>

            <hr style={{ borderColor: '#334155', margin: '20px 0' }} />

            <h3 style={{ fontSize: '16px', marginBottom: '12px' }}>Agregar Producto</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '10px', alignItems: 'end' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#94a3b8' }}>Producto</label>
                <select
                  value={selectedProduct}
                  onChange={(e) => {
                    setSelectedProduct(e.target.value);
                    if (e.target.value.includes('50')) setProductPrice(21990);
                    else if (e.target.value.includes('30')) setProductPrice(14990);
                    else if (e.target.value.includes('Camarón')) setProductPrice(4200);
                    else setProductPrice(3500);
                  }}
                  style={{ width: '100%', padding: '10px', marginTop: '4px', borderRadius: '6px', backgroundColor: '#0f172a', color: '#fff', border: '1px solid #334155' }}
                >
                  <option value="Promo 30 Piezas Mixtas">Promo 30 Piezas Mixtas ($14.990)</option>
                  <option value="Promo 50 Piezas Tempura">Promo 50 Piezas Tempura ($21.990)</option>
                  <option value="Handroll Pollo Teriyaki Queso">Handroll Pollo Teriyaki ($3.500)</option>
                  <option value="Handroll Camarón Panko">Handroll Camarón Panko ($4.200)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#94a3b8' }}>Cantidad</label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  style={{ width: '100%', padding: '10px', marginTop: '4px', borderRadius: '6px', backgroundColor: '#0f172a', color: '#fff', border: '1px solid #334155' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#94a3b8' }}>Notas / Salsas</label>
                <input
                  type="text"
                  placeholder="Ej: 2 Teriyaki, sin sésamo"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  style={{ width: '100%', padding: '10px', marginTop: '4px', borderRadius: '6px', backgroundColor: '#0f172a', color: '#fff', border: '1px solid #334155' }}
                />
              </div>

              <button
                type="button"
                onClick={addItemToCart}
                style={{ padding: '10px 16px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                + Añadir
              </button>
            </div>

            <div style={{ marginTop: '24px', backgroundColor: '#0f172a', padding: '16px', borderRadius: '8px' }}>
              <h4 style={{ margin: '0 0 10px 0' }}>Detalle de la Comanda:</h4>
              {cart.length === 0 ? (
                <p style={{ color: '#64748b', fontSize: '14px' }}>No hay productos añadidos todavía.</p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {cart.map((item, i) => (
                    <li key={i} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1e293b', padding: '8px 0' }}>
                      <div>
                        <strong>{item.quantity}x {item.product_name}</strong>
                        {item.special_notes && <div style={{ fontSize: '12px', color: '#f87171' }}>• {item.special_notes}</div>}
                      </div>
                      <span>${item.subtotal.toLocaleString('es-CL')}</span>
                    </li>
                  ))}
                </ul>
              )}

              <div style={{ marginTop: '16px', textAlign: 'right', fontSize: '18px', fontWeight: 'bold' }}>
                Total: ${cart.reduce((acc, it) => acc + it.subtotal, 0).toLocaleString('es-CL')}
              </div>
            </div>

            <button
              onClick={handleCreateOrder}
              disabled={isSubmitting || cart.length === 0}
              style={{
                width: '100%',
                padding: '14px',
                marginTop: '20px',
                backgroundColor: cart.length > 0 ? '#10b981' : '#475569',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: cart.length > 0 ? 'pointer' : 'not-allowed'
              }}
            >
              {isSubmitting ? 'Enviando comanda...' : '🚀 Enviar Comanda a Cocina'}
            </button>
          </div>
        </main>
      )}
    </div>
  );
}
