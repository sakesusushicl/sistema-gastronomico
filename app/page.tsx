'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Inicialización de Supabase con tus variables de entorno
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Product {
  id: string;
  name: string;
  price: number;
}

interface CartItem extends Product {
  quantity: number;
}

interface Shift {
  id: string;
  opened_at: string;
  initial_cash: number;
  status: 'OPEN' | 'CLOSED';
}

export default function POSPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [currentShift, setCurrentShift] = useState<Shift | null>(null);
  const [initialAmount, setInitialAmount] = useState<number>(0);
  const [customerName, setCustomerName] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [loading, setLoading] = useState<boolean>(false);

  // 1. Cargar turno activo y productos al iniciar
  useEffect(() => {
    checkActiveShift();
    fetchProducts();
  }, []);

  const checkActiveShift = async () => {
    const { data, error } = await supabase
      .from('cash_shifts')
      .select('*')
      .eq('status', 'OPEN')
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      setCurrentShift(data);
    }
  };

  const fetchProducts = async () => {
    const { data, error } = await supabase.from('products').select('*');
    if (!error && data) {
      setProducts(data);
    }
  };

  // 2. Abrir turno de caja
  const handleOpenShift = async () => {
    if (initialAmount < 0) return alert('Monto inicial inválido');
    setLoading(true);

    const { data, error } = await supabase
      .from('cash_shifts')
      .insert([
        {
          initial_cash: initialAmount,
          status: 'OPEN',
          opened_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    setLoading(false);
    if (error) {
      alert('Error al abrir turno: ' + error.message);
    } else {
      setCurrentShift(data);
    }
  };

  // 3. Cerrar turno de caja
  const handleCloseShift = async () => {
    if (!currentShift) return;
    if (!confirm('¿Seguro que deseas cerrar la caja actual?')) return;
    setLoading(true);

    const { error } = await supabase
      .from('cash_shifts')
      .update({
        status: 'CLOSED',
        closed_at: new Date().toISOString(),
      })
      .eq('id', currentShift.id);

    setLoading(false);
    if (error) {
      alert('Error al cerrar turno: ' + error.message);
    } else {
      setCurrentShift(null);
      alert('Turno cerrado con éxito');
    }
  };

  // 4. Manejo del carrito
  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const totalAmount = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);

  // 5. Crear pedido asociando el shift_id
  const handleCheckout = async () => {
    if (!currentShift) {
      return alert('Debes tener una caja abierta para procesar ventas.');
    }
    if (cart.length === 0) {
      return alert('El carrito está vacío.');
    }

    setLoading(true);

    const { error } = await supabase.from('orders').insert([
      {
        customer_name: customerName || 'Cliente General',
        payment_method: paymentMethod,
        total_amount: totalAmount,
        shift_id: currentShift.id, // Conexión directa con la caja activa
        created_at: new Date().toISOString(),
      },
    ]);

    setLoading(false);

    if (error) {
      alert('Error al procesar el pedido: ' + error.message);
    } else {
      alert('¡Pedido guardado con éxito!');
      setCart([]);
      setCustomerName('');
    }
  };

  return (
    <div style={{ padding: '24px', fontFamily: 'sans-serif', maxWidth: '1000px', margin: '0 auto' }}>
      <h1>Punto de Venta (POS)</h1>

      {/* Control de Caja */}
      <div style={{ padding: '16px', background: '#f4f4f5', borderRadius: '8px', marginBottom: '20px' }}>
        <h3>Control de Caja</h3>
        {currentShift ? (
          <div>
            <p><strong>Caja abierta</strong> | ID Turno: {currentShift.id}</p>
            <p>Monto Apertura: ${currentShift.initial_cash}</p>
            <button onClick={handleCloseShift} disabled={loading} style={{ background: '#ef4444', color: '#fff', padding: '8px 16px', border: 'none', borderRadius: '4px' }}>
              Cerrar Turno de Caja
            </button>
          </div>
        ) : (
          <div>
            <p>No hay una caja abierta actualmente.</p>
            <input
              type="number"
              placeholder="Monto inicial"
              value={initialAmount}
              onChange={(e) => setInitialAmount(Number(e.target.value))}
              style={{ padding: '8px', marginRight: '8px' }}
            />
            <button onClick={handleOpenShift} disabled={loading} style={{ background: '#22c55e', color: '#fff', padding: '8px 16px', border: 'none', borderRadius: '4px' }}>
              Abrir Caja
            </button>
          </div>
        )}
      </div>

      {/* POS - Productos y Carrito */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <div>
          <h3>Productos</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {products.map((prod) => (
              <div key={prod.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}>
                <span>{prod.name} - ${prod.price}</span>
                <button onClick={() => addToCart(prod)} disabled={!currentShift}>
                  Agregar
                </button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3>Detalle de Venta</h3>
          {cart.map((item) => (
            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span>{item.name} x {item.quantity}</span>
              <span>${item.price * item.quantity}</span>
            </div>
          ))}
          <hr />
          <h4>Total: ${totalAmount}</h4>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
            <input
              type="text"
              placeholder="Nombre del cliente"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              style={{ padding: '8px' }}
            />
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              style={{ padding: '8px' }}
            >
              <option value="cash">Efectivo</option>
              <option value="card">Tarjeta / Débito</option>
              <option value="transfer">Transferencia</option>
            </select>
            <button
              onClick={handleCheckout}
              disabled={loading || !currentShift || cart.length === 0}
              style={{ background: '#2563eb', color: '#fff', padding: '10px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              {loading ? 'Guardando...' : 'Confirmar Pedido'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
