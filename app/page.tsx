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
  customer_name?: string;
  payment_method?: string;
  created_at: string;
  order_items: OrderItem[];
}

export default function GastronomicSystem() {
  const [activeTab, setActiveTab] = useState<'kds' | 'pos'>('kds');
  const [orders, setOrders] = useState<Order[]>([]);

  // Estados del POS
  const [customerName, setCustomerName] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Efectivo');
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
      .select('id, daily_order_number, order_type, status, total_amount, delivery_address, customer_name, payment_method, created_at, order_items(product_name, quantity, special_notes, unit_price, subtotal)')
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
    return () => { supabase.removeChannel(channel); };
  }, []);

  const updateOrderStatus = async (orderId: number, nextStatus: string) => {
    await supabase.from('orders').update({ status: nextStatus }).eq('id', orderId);
    fetchOrders();
  };

  const printProfessionalTicket = (order: Order) => {
    const w = window.open('', '_blank', 'width=380,height=600');
    if (!w) return;

    const itemsRows = (order.order_items || [])
      .map(it => `
        <div style="margin-bottom: 8px;">
          <div style="font-size: 15px; font-weight: 800;">[ ${it.quantity} ] ${it.product_name.toUpperCase()}</div>
          ${it.special_notes ? `<div style="font-size: 13px; font-weight: bold; padding-left: 10px;">>> ${it.special_notes.toUpperCase()}</div>` : ''}
        </div>
      `).join('');

    w.document.write(`
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; width: 72mm; padding: 4mm; }
            .center { text-align: center; }
            .bold { font-weight: 900; }
            .divider { border-top: 2px solid #000; margin: 6px 0; }
            .large-text { font-size: 18px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="center bold" style="font-size: 18px;">SAKESU SUSHI</div>
          <div class="divider"></div>
          <div class="center bold" style="font-size: 22px;">ORDEN #${order.daily_order_number}</div>
          <div class="center bold" style="font-size: 16px;">${order.order_type === 'DELIVERY' ? 'DELIVERY' : 'RETIRO'}</div>
          <div class="divider"></div>
          <div style="font-size: 14px; margin-bottom: 4px;"><strong>CLIENTE:</strong> ${order.customer_name || 'N/A'}</div>
          <div class="large-text">DIR: ${order.delivery_address || 'N/A'}</div>
          <div style="font-size: 14px; margin-top: 4px;"><strong>PAGO:</strong> ${order.payment_method || 'Efectivo'}</div>
          <div class="divider"></div>
          ${itemsRows}
          <div class="divider"></div>
          <div class="large-text">TOTAL: $${order.total_amount?.toLocaleString('es-CL')}</div>
          <script>window.onload = () => { window.print(); window.close(); }</script>
        </body>
      </html>
    `);
    w.document.close();
  };

  const addItemToCart = () => {
    setCart([...cart, { product_name: selectedProduct, quantity, unit_price: productPrice, subtotal: productPrice * quantity, special_notes: notes }]);
    setNotes('');
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;
    setIsSubmitting(true);
    const total = cart.reduce((acc, item) => acc + item.subtotal, 0);
    const dailyNum = Math.floor(Math.random() * 900) + 100;

    const { data: orderData } = await supabase.from('orders').insert([{ 
        daily_order_number: dailyNum, order_type: orderType, status: 'PENDING', 
        delivery_address: deliveryAddress, customer_name: customerName, payment_method: paymentMethod,
        total_amount: total 
    }]).select().single();

    if (orderData) {
      await supabase.from('order_items').insert(cart.map(item => ({ order_id: orderData.id, ...item })));
      setCart([]); setDeliveryAddress(''); setCustomerName(''); setActiveTab('kds');
      fetchOrders();
      printProfessionalTicket({ ...orderData, order_items: cart });
    }
    setIsSubmitting(false);
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', color: '#fff', padding: '20px' }}>
      <button onClick={() => setActiveTab('kds')}>🔥 Cocina</button>
      <button onClick={() => setActiveTab('pos')}>➕ Nuevo Pedido</button>
      
      {activeTab === 'pos' && (
        <div style={{ maxWidth: '500px', marginTop: '20px', backgroundColor: '#1e293b', padding: '20px', borderRadius: '10px' }}>
          <input placeholder="Nombre Cliente" value={customerName} onChange={e => setCustomerName(e.target.value)} style={{ width: '100%', marginBottom: '10px', padding: '8px' }} />
          <input placeholder="Dirección" value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} style={{ width: '100%', marginBottom: '10px', padding: '8px' }} />
          <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} style={{ width: '100%', marginBottom: '10px', padding: '8px' }}>
            <option>Efectivo</option><option>Transferencia</option><option>Débito</option>
          </select>
          {/* ... resto de tu formulario igual ... */}
          <button onClick={handleCreateOrder} style={{ width: '100%', padding: '15px', backgroundColor: '#10b981' }}>ENVIAR E IMPRIMIR</button>
        </div>
      )}
      
      {/* ... visualización de cocina igual ... */}
    </div>
  );
}
