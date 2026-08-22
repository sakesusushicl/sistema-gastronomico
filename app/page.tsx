'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface ItemMenu {
  id: string | number;
  nombre: string;
  precio: number;
  categoria?: string;
}

interface ItemPedido extends ItemMenu {
  cantidad: number;
  nota?: string;
}

export default function POSPage() {
  const [menu, setMenu] = useState<ItemMenu[]>([]);
  const [cargandoMenu, setCargandoMenu] = useState(true);
  const [pedido, setPedido] = useState<ItemPedido[]>([]);
  const [cliente, setCliente] = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [tipoEntrega, setTipoEntrega] = useState<'Delivery' | 'Retiro' | 'Local'>('Delivery');
  const [metodoPago, setMetodoPago] = useState('Efectivo');
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState('');

  // Cargar productos desde Supabase
  useEffect(() => {
    async function obtenerProductos() {
      try {
        if (supabaseUrl && supabaseAnonKey) {
          const { data, error } = await supabase.from('productos').select('*').order('nombre');
          if (error) throw error;
          if (data && data.length > 0) {
            setMenu(data);
          } else {
            // Menú de respaldo si la tabla está vacía
            setMenu([
              { id: '1', nombre: 'Promo 30 Piezas', precio: 14990, categoria: 'Promociones' },
              { id: '2', nombre: 'Promo 40 Piezas', precio: 18990, categoria: 'Promociones' },
              { id: '3', nombre: 'Promo 60 Piezas', precio: 24990, categoria: 'Promociones' },
              { id: '4', Handroll Pollo: '', nombre: 'Handroll Pollo', precio: 3500, categoria: 'Handrolls' },
              { id: '5', nombre: 'Handroll Camarón', precio: 4000, categoria: 'Handrolls' },
              { id: '6', nombre: 'Bebida 1.5L', precio: 2500, categoria: 'Bebidas' },
            ]);
          }
        }
      } catch (err) {
        console.error('Error cargando productos:', err);
      } finally {
        setCargandoMenu(false);
      }
    }
    obtenerProductos();
  }, []);

  const agregarAlPedido = (item: ItemMenu) => {
    setPedido((prev) => {
      const existe = prev.find((p) => p.id === item.id);
      if (existe) {
        return prev.map((p) =>
          p.id === item.id ? { ...p, cantidad: p.cantidad + 1 } : p
        );
      }
      return [...prev, { ...item, cantidad: 1 }];
    });
  };

  const modificarCantidad = (id: string | number, delta: number) => {
    setPedido((prev) =>
      prev
        .map((p) => {
          if (p.id === id) {
            const nuevaCantidad = p.cantidad + delta;
            return nuevaCantidad > 0 ? { ...p, cantidad: nuevaCantidad } : null;
          }
          return p;
        })
        .filter(Boolean) as ItemPedido[]
    );
  };

  const total = pedido.reduce((acc, item) => acc + item.precio * item.cantidad, 0);

  const procesarCobroPoint = async (monto: number, nroOrden: number) => {
    try {
      const res = await fetch('/api/point', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: monto, orderId: nroOrden }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert('Aviso Maquinita: ' + (data.error || 'No se pudo conectar a la Point Smart'));
      } else {
        alert('¡Monto enviado a la Point Smart 2! Pasa la tarjeta en la terminal.');
      }
    } catch (err: any) {
      console.error('Error Point:', err);
    }
  };

  const handleCrearPedido = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pedido.length === 0) {
      alert('Agrega al menos un producto al pedido');
      return;
    }

    setCargando(true);
    setMensaje('');

    const nroOrden = Date.now().toString().slice(-6);

    try {
      if (supabaseUrl && supabaseAnonKey) {
        const { error } = await supabase.from('pedidos').insert([
          {
            numero_orden: nroOrden,
            cliente: cliente || 'Cliente General',
            telefono: telefono,
            direccion: direccion,
            tipo_entrega: tipoEntrega,
            metodo_pago: metodoPago,
            items: pedido,
            total: total,
            estado: 'Pendiente',
          },
        ]);

        if (error) throw error;
      }

      if (metodoPago === 'Mercado Pago Point') {
        await procesarCobroPoint(total, Number(nroOrden));
      }

      setMensaje(`¡Orden #${nroOrden} generada exitosamente!`);
      setPedido([]);
      setCliente('');
      setTelefono('');
      setDireccion('');
    } catch (err: any) {
      alert('Error al procesar pedido: ' + err.message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0d0d0d', color: '#f3f4f6', fontFamily: 'sans-serif', display: 'flex', flexWrap: 'wrap' }}>
      {/* Catálogo de Productos */}
      <div style={{ flex: '1 1 500px', padding: '24px', borderRight: '1px solid #262626' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h1 style={{ fontSize: '26px', fontWeight: '900', letterSpacing: '1px', margin: 0 }}>
            SAKESU <span style={{ color: '#dc2626' }}>SUSHI</span>
          </h1>
          <span style={{ fontSize: '13px', color: '#a3a3a3', fontStyle: 'italic' }}>"Cada bocado, una tentación"</span>
        </div>

        {cargandoMenu ? (
          <p style={{ color: '#a3a3a3' }}>Cargando catálogo de productos...</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px' }}>
            {menu.map((item) => (
              <button
                key={item.id}
                onClick={() => agregarAlPedido(item)}
                style={{
                  backgroundColor: '#171717',
                  border: '1px solid #262626',
                  borderRadius: '12px',
                  padding: '16px',
                  cursor: 'pointer',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  color: '#fff',
                  minHeight: '90px'
                }}
              >
                <span style={{ fontWeight: '600', fontSize: '14px' }}>{item.nombre}</span>
                <span style={{ color: '#ef4444', fontWeight: 'bold', marginTop: '10px', fontSize: '15px' }}>
                  ${Number(item.precio).toLocaleString('es-CL')}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Panel Lateral de Comanda */}
      <div style={{ width: '380px', backgroundColor: '#141414', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#ef4444', borderBottom: '1px solid #262626', paddingBottom: '8px', margin: '0 0 16px 0' }}>
            Comanda Actual
          </h2>

          <div style={{ maxHeight: '220px', overflowY: 'auto', marginBottom: '16px' }}>
            {pedido.length === 0 ? (
              <p style={{ fontSize: '13px', color: '#737373', textAlign: 'center', margin: '30px 0' }}>No hay productos añadidos</p>
            ) : (
              pedido.map((item) => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0a0a0a', padding: '8px 12px', borderRadius: '8px', marginBottom: '8px', border: '1px solid #262626' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: '600' }}>{item.nombre}</p>
                    <p style={{ margin: 0, fontSize: '12px', color: '#ef4444' }}>${(item.precio * item.cantidad).toLocaleString('es-CL')}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button type="button" onClick={() => modificarCantidad(item.id, -1)} style={{ width: '24px', height: '24px', backgroundColor: '#262626', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>-</button>
                    <span style={{ fontSize: '13px', fontWeight: 'bold' }}>{item.cantidad}</span>
                    <button type="button" onClick={() => modificarCantidad(item.id, 1)} style={{ width: '24px', height: '24px', backgroundColor: '#262626', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>+</button>
                  </div>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleCrearPedido} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="Cliente"
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
                style={{ width: '100%', padding: '8px', backgroundColor: '#0a0a0a', border: '1px solid #262626', color: '#fff', borderRadius: '6px', fontSize: '13px', outline: 'none' }}
              />
              <input
                type="text"
                placeholder="Teléfono"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                style={{ width: '100%', padding: '8px', backgroundColor: '#0a0a0a', border: '1px solid #262626', color: '#fff', borderRadius: '6px', fontSize: '13px', outline: 'none' }}
              />
            </div>

            <input
              type="text"
              placeholder="Dirección (si es Delivery)"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              style={{ width: '100%', padding: '8px', backgroundColor: '#0a0a0a', border: '1px solid #262626', color: '#fff', borderRadius: '6px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
            />

            <div style={{ display: 'flex', gap: '8px' }}>
              <select
                value={tipoEntrega}
                onChange={(e: any) => setTipoEntrega(e.target.value)}
                style={{ width: '100%', padding: '8px', backgroundColor: '#0a0a0a', border: '1px solid #262626', color: '#fff', borderRadius: '6px', fontSize: '13px', outline: 'none' }}
              >
                <option value="Delivery">Delivery</option>
                <option value="Retiro">Retiro</option>
                <option value="Local">Local</option>
              </select>

              <select
                value={metodoPago}
                onChange={(e) => setMetodoPago(e.target.value)}
                style={{ width: '100%', padding: '8px', backgroundColor: '#0a0a0a', border: '1px solid #262626', color: '#fff', borderRadius: '6px', fontSize: '13px', outline: 'none' }}
              >
                <option value="Efectivo">Efectivo</option>
                <option value="Débito">Débito</option>
                <option value="Transferencia">Transferencia</option>
                <option value="Mercado Pago Point">💳 Point Smart 2</option>
              </select>
            </div>

            <div style={{ borderTop: '1px solid #262626', paddingTop: '12px', marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '18px', fontWeight: 'bold' }}>
              <span>Total:</span>
              <span style={{ color: '#ef4444' }}>${total.toLocaleString('es-CL')}</span>
            </div>

            {mensaje && <p style={{ fontSize: '12px', color: '#22c55e', textAlign: 'center', margin: 0 }}>{mensaje}</p>}

            <button
              type="submit"
              disabled={cargando || pedido.length === 0}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: cargando || pedido.length === 0 ? '#525252' : '#991b1b',
                color: '#ffffff',
                fontWeight: 'bold',
                border: 'none',
                borderRadius: '8px',
                cursor: cargando || pedido.length === 0 ? 'not-allowed' : 'pointer',
                marginTop: '8px',
                fontSize: '14px'
              }}
            >
              {cargando ? 'Procesando...' : 'Confirmar y Cobrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
