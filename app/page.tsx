'use client';

import React, { useEffect, useState, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface Product {
  id?: number | string;
  name: string;
  price?: number;
  unit_price?: number;
  base_price?: number;
  category?: string;
}

interface OrderItem {
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  special_notes?: string;
}

export default function GastronomicPOS() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerAddress, setCustomerAddress] = useState<string>('');
  const [orderType, setOrderType] = useState<string>('Delivery');
  const [paymentMethod, setPaymentMethod] = useState<string>('Efectivo');
  const [orderNotes, setOrderNotes] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');

  // Cargar productos desde Supabase
  useEffect(() => {
    async function fetchMenu() {
      if (!supabaseUrl || !supabaseAnonKey) return;
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .order('name', { ascending: true });

        if (!error && data && data.length > 0) {
          setProducts(data);
          const cats = Array.from(new Set(data.map((p: any) => p.category).filter(Boolean))) as string[];
          setCategories(['Todos', ...cats]);
        } else {
          // Respaldo de productos
          const fallback: Product[] = [
            { id: 1, name: 'Promo 30 Piezas', price: 14990, category: 'Promociones' },
            { id: 2, name: 'Promo 40 Piezas', price: 18990, category: 'Promociones' },
            { id: 3, name: 'Promo 60 Piezas', price: 24990, category: 'Promociones' },
            { id: 4, name: 'Handroll Pollo', price: 3500, category: 'Handrolls' },
            { id: 5, name: 'Handroll Camarón', price: 4000, category: 'Handrolls' },
            { id: 6, name: 'Bebida 1.5L', price: 2500, category: 'Bebidas' },
          ];
          setProducts(fallback);
          setCategories(['Todos', 'Promociones', 'Handrolls', 'Bebidas']);
        }
      } catch (err) {
        console.error('Error cargando menú:', err);
      }
    }
    fetchMenu();
  }, []);

  const getProductPrice = (item: Product): number => {
    return Number(item.price || item.unit_price || item.base_price || 0);
  };

  const addToOrder = (product: Product) => {
    const price = getProductPrice(product);
    setOrderItems((prev) => {
      const index = prev.findIndex((i) => i.product_name === product.name);
      if (index > -1) {
        const updated = [...prev];
        const newQty = updated[index].quantity + 1;
        updated[index] = {
          ...updated[index],
          quantity: newQty,
          subtotal: newQty * price,
        };
        return updated;
      }
      return [
        ...prev,
        {
          product_name: product.name,
          quantity: 1,
          unit_price: price,
          subtotal: price,
        },
      ];
    });
  };

  const updateQuantity = (index: number, delta: number) => {
    setOrderItems((prev) => {
      const updated = [...prev];
      const newQty = updated[index].quantity + delta;
      if (newQty <= 0) {
        return updated.filter((_, i) => i !== index);
      }
      updated[index] = {
        ...updated[index],
        quantity: newQty,
        subtotal: newQty * updated[index].unit_price,
      };
      return updated;
    });
  };

  const totalAmount = orderItems.reduce((acc, item) => acc + item.subtotal, 0);

  const filteredProducts = products.filter((p) => {
    const matchCategory = selectedCategory === 'Todos' || p.category === selectedCategory;
    const matchSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchCategory && matchSearch;
  });

  const sendPointPayment = async (amount: number, orderId: string) => {
    try {
      const res = await fetch('/api/point', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, orderId }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert('Aviso Maquinita: ' + (data.error || 'Error al conectar con la Point Smart'));
      } else {
        alert('¡Monto enviado a la Point Smart 2! Pasa la tarjeta en la terminal.');
      }
    } catch (err: any) {
      console.error('Error al conectar con Point:', err);
    }
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (orderItems.length === 0) {
      alert('Debes agregar al menos un producto a la comanda.');
      return;
    }

    setIsSubmitting(true);
    setStatusMessage('');
    const orderNumber = Date.now().toString().slice(-6);

    try {
      if (supabaseUrl && supabaseAnonKey) {
        await supabase.from('orders').insert([
          {
            order_number: orderNumber,
            customer_name: customerName || 'Cliente General',
            customer_phone: customerPhone,
            delivery_address: customerAddress,
            order_type: orderType,
            payment_method: paymentMethod,
            items: orderItems,
            total_amount: totalAmount,
            notes: orderNotes,
            status: 'pending',
          },
        ]);
      }

      if (paymentMethod === 'Mercado Pago Point') {
        await sendPointPayment(totalAmount, orderNumber);
      }

      setStatusMessage(`¡Comanda #${orderNumber} creada con éxito!`);
      setOrderItems([]);
      setCustomerName('');
      setCustomerPhone('');
      setCustomerAddress('');
      setOrderNotes('');
    } catch (err: any) {
      alert('Error guardando la orden: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', minHeight: '100vh', backgroundColor: '#0a0a0a', color: '#ffffff', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Panel Izquierdo: Catálogo de Productos */}
      <div style={{ flex: '1 1 600px', padding: '24px', borderRight: '1px solid #262626' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '26px', fontWeight: '900', letterSpacing: '0.5px' }}>
              SAKESU <span style={{ color: '#dc2626' }}>SUSHI</span>
            </h1>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#a3a3a3', fontStyle: 'italic' }}>
              "Cada bocado, una tentación"
            </p>
          </div>
          <input
            type="text"
            placeholder="Buscar producto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ padding: '8px 14px', backgroundColor: '#171717', border: '1px solid #333333', borderRadius: '8px', color: '#fff', fontSize: '13px', outline: 'none', width: '180px' }}
          />
        </div>

        {/* Categorías */}
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '12px', marginBottom: '16px' }}>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                border: 'none',
                backgroundColor: selectedCategory === cat ? '#dc2626' : '#1f1f1f',
                color: '#fff',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Grilla de Productos */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '14px' }}>
          {filteredProducts.map((product, idx) => {
            const price = getProductPrice(product);
            return (
              <button
                key={product.id || idx}
                onClick={() => addToOrder(product)}
                style={{
                  backgroundColor: '#141414',
                  border: '1px solid #262626',
                  borderRadius: '12px',
                  padding: '16px 12px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  minHeight: '85px',
                  transition: 'border 0.2s',
                }}
              >
                <span style={{ fontSize: '14px', fontWeight: '600', color: '#f3f4f6' }}>{product.name}</span>
                <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#ef4444', marginTop: '12px' }}>
                  ${price.toLocaleString('es-CL')}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Panel Derecho: Comanda Actual */}
      <div style={{ width: '390px', backgroundColor: '#121212', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 'bold', color: '#ef4444', borderBottom: '1px solid #262626', paddingBottom: '8px' }}>
            Comanda Actual
          </h2>

          {/* Lista de Items */}
          <div style={{ maxHeight: '230px', overflowY: 'auto', marginBottom: '16px' }}>
            {orderItems.length === 0 ? (
              <p style={{ fontSize: '13px', color: '#666666', textAlign: 'center', margin: '30px 0' }}>
                Selecciona productos del menú
              </p>
            ) : (
              orderItems.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0a0a0a', padding: '8px 12px', borderRadius: '8px', marginBottom: '8px', border: '1px solid #262626' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: '600' }}>{item.product_name}</p>
                    <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#ef4444' }}>${item.subtotal.toLocaleString('es-CL')}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button type="button" onClick={() => updateQuantity(idx, -1)} style={{ width: '24px', height: '24px', backgroundColor: '#262626', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>-</button>
                    <span style={{ fontSize: '13px', fontWeight: 'bold', minWidth: '18px', textAlign: 'center' }}>{item.quantity}</span>
                    <button type="button" onClick={() => updateQuantity(idx, 1)} style={{ width: '24px', height: '24px', backgroundColor: '#262626', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>+</button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Formulario de Pedido */}
          <form onSubmit={handleSubmitOrder} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="Nombre Cliente"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                style={{ width: '100%', padding: '8px', backgroundColor: '#0a0a0a', border: '1px solid #262626', borderRadius: '6px', color: '#fff', fontSize: '13px', outline: 'none' }}
              />
              <input
                type="text"
                placeholder="Teléfono"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                style={{ width: '100%', padding: '8px', backgroundColor: '#0a0a0a', border: '1px solid #262626', borderRadius: '6px', color: '#fff', fontSize: '13px', outline: 'none' }}
              />
            </div>

            <input
              type="text"
              placeholder="Dirección de entrega"
              value={customerAddress}
              onChange={(e) => setCustomerAddress(e.target.value)}
              style={{ width: '100%', padding: '8px', backgroundColor: '#0a0a0a', border: '1px solid #262626', borderRadius: '6px', color: '#fff', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
            />

            <div style={{ display: 'flex', gap: '8px' }}>
              <select
                value={orderType}
                onChange={(e) => setOrderType(e.target.value)}
                style={{ width: '100%', padding: '8px', backgroundColor: '#0a0a0a', border: '1px solid #262626', borderRadius: '6px', color: '#fff', fontSize: '13px', outline: 'none' }}
              >
                <option value="Delivery">Delivery</option>
                <option value="Retiro">Retiro</option>
                <option value="Local">Local</option>
              </select>

              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                style={{ width: '100%', padding: '8px', backgroundColor: '#0a0a0a', border: '1px solid #262626', borderRadius: '6px', color: '#fff', fontSize: '13px', outline: 'none' }}
              >
                <option value="Efectivo">Efectivo</option>
                <option value="Débito">Débito</option>
                <option value="Transferencia">Transferencia</option>
                <option value="Mercado Pago Point">💳 Point Smart 2</option>
              </select>
            </div>

            <input
              type="text"
              placeholder="Notas del pedido (opcional)"
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
              style={{ width: '100%', padding: '8px', backgroundColor: '#0a0a0a', border: '1px solid #262626', borderRadius: '6px', color: '#fff', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
            />

            <div style={{ borderTop: '1px solid #262626', paddingTop: '12px', marginTop: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '18px', fontWeight: 'bold' }}>
              <span>Total:</span>
              <span style={{ color: '#ef4444' }}>${totalAmount.toLocaleString('es-CL')}</span>
            </div>

            {statusMessage && (
              <p style={{ margin: '4px 0', fontSize: '12px', color: '#22c55e', textAlign: 'center' }}>
                {statusMessage}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting || orderItems.length === 0}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: isSubmitting || orderItems.length === 0 ? '#404040' : '#b91c1c',
                color: '#ffffff',
                fontWeight: 'bold',
                fontSize: '14px',
                border: 'none',
                borderRadius: '8px',
                cursor: isSubmitting || orderItems.length === 0 ? 'not-allowed' : 'pointer',
                marginTop: '6px',
              }}
            >
              {isSubmitting ? 'Procesando...' : 'Confirmar y Cobrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
