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
  const [selectedOrderToPrint, setSelectedOrderToPrint] = useState<Order | null>(null);
  
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
    const channel = supabase.channel('kds-live').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => { fetchOrders(); }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const updateOrderStatus = async (orderId: number, nextStatus: string) => {
    await supabase.from('orders').update({ status: nextStatus }).eq('id', orderId);
    fetchOrders();
  };

  const handlePrint = (order: Order) => {
    setSelectedOrderToPrint(order);
    setTimeout(() => {
      window.print();
    }, 500);
  };

  const addItemToCart = () => {
    setCart([...cart, { product_name: selectedProduct, quantity, unit_price: productPrice, subtotal: productPrice * quantity, special_notes: notes }]);
    setNotes('');
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const total = cart.reduce((acc, item) => acc + item.subtotal, 0);
    const { data: orderData } = await supabase.from('orders').insert([{ daily_order_number: Math.floor(Math.random() * 900) + 100, order_type: orderType, status: 'PENDING', delivery_address: deliveryAddress, total_amount: total }]).select().single();
    if (orderData) {
      await supabase.from('order_items').insert(cart.map(item => ({ order_id: orderData.id, ...item })));
      setCart([]);
      setActiveTab('kds');
      fetchOrders();
      handlePrint({ ...orderData, order_items: cart });
    }
    setIsSubmitting(false);
  };

  return (
    <>
      <style jsx global>{`
        @media print {
          body * { visibility: hidden !important; }
          #thermal-receipt, #thermal-receipt * { visibility: visible !important; display: block !important; }
          #thermal-receipt { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>

      {selectedOrderToPrint && (
        <div id="thermal-receipt" style={{ padding: '10px', width: '250px', fontFamily: 'monospace' }}>
          <h2 style={{ textAlign: 'center' }}>SAKESU SUSHI</h2>
          <p style={{ textAlign: 'center' }}>ORDEN #{selectedOrderToPrint.daily_order_number}</p>
          <hr />
          {selectedOrderToPrint.order_items?.map((item, i) => (
            <div key={i} style={{ fontSize: '14px' }}>
              {item.quantity}x {item.product_name} <br/>
              {item.special_notes && <i>* {item.special_notes}</i>}
            </div>
          ))}
          <hr />
          <p>Total: ${selectedOrderToPrint.total_amount.toLocaleString()}</p>
        </div>
      )}

      <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', color: '#fff', padding: '20px' }}>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <button onClick={() => setActiveTab('kds')}>🔥 Cocina</button>
          <button onClick={() => setActiveTab('pos')}>➕ POS</button>
        </div>

        {activeTab === 'kds' ? (
          <div style={{ display: 'grid', gap: '20px' }}>
            {orders.map(order => (
              <div key={order.id} style={{ border: '1px solid #334', padding: '15px' }}>
                <h3>#{order.daily_order_number} - {order.order_type}</h3>
                {order.order_items.map((it, i) => <p key={i}>{it.quantity}x {it.product_name}</p>)}
                <button onClick={() => handlePrint(order)}>🖨️ Imprimir Ticket</button>
                {order.status === 'PENDING' && <button onClick={() => updateOrderStatus(order.id, 'IN_KITCHEN')}>Empezar</button>}
              </div>
            ))}
          </div>
        ) : (
          <div>
            <h2>Registrar Pedido</h2>
            <select onChange={(e) => { setSelectedProduct(e.target.value); setProductPrice(e.target.value.includes('50') ? 21990 : 14990); }}>
              <option value="Promo 30 Piezas Mixtas">Promo 30 ($14.990)</option>
              <option value="Promo 50 Piezas Tempura">Promo 50 ($21.990)</option>
            </select>
            <input type="number" value={quantity} onChange={e => setQuantity(Number(e.target.value))} />
            <button onClick={addItemToCart}>Añadir</button>
            <button onClick={handleCreateOrder} disabled={isSubmitting}>🚀 Enviar e Imprimir</button>
          </div>
        )}
      </div>
    </>
  );
}
