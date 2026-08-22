'use client';

import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface ItemMenu {
  id: string;
  nombre: string;
  precio: number;
  categoria: string;
}

interface ItemPedido extends ItemMenu {
  cantidad: number;
  nota?: string;
}

export default function POSPage() {
  const [menu, setMenu] = useState<ItemMenu[]>([
    { id: '1', nombre: 'Promo 30 Piezas', precio: 14990, categoria: 'Promociones' },
    { id: '2', nombre: 'Promo 40 Piezas', precio: 18990, categoria: 'Promociones' },
    { id: '3', nombre: 'Promo 60 Piezas', precio: 24990, categoria: 'Promociones' },
    { id: '4', nombre: 'Handroll Pollo', precio: 3500, categoria: 'Handrolls' },
    { id: '5', nombre: 'Handroll Camarón', precio: 4000, categoria: 'Handrolls' },
    { id: '6', nombre: 'Bebida 1.5L', precio: 2500, categoria: 'Bebidas' },
  ]);

  const [pedido, setPedido] = useState<ItemPedido[]>([]);
  const [cliente, setCliente] = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [tipoEntrega, setTipoEntrega] = useState<'Delivery' | 'Retiro' | 'Local'>('Delivery');
  const [metodoPago, setMetodoPago] = useState('Efectivo');
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState('');

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

  const modificarCantidad = (id: string, delta: number) => {
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row">
      {/* Menú de Productos */}
      <div className="flex-1 p-6 border-r border-slate-800">
        <h1 className="text-2xl font-bold mb-6 text-yellow-400">SAKESU SUSHI - POS</h1>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {menu.map((item) => (
            <button
              key={item.id}
              onClick={() => agregarAlPedido(item)}
              className="p-4 bg-slate-900 border border-slate-800 hover:border-yellow-500 rounded-xl flex flex-col items-center justify-between text-center transition active:scale-95 shadow-md"
            >
              <span className="font-semibold text-slate-200">{item.nombre}</span>
              <span className="text-yellow-400 font-bold mt-2">
                ${item.precio.toLocaleString('es-CL')}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Comanda Actual */}
      <div className="w-full md:w-96 p-6 bg-slate-900 flex flex-col justify-between">
        <div>
          <h2 className="text-xl font-bold mb-4 border-b border-slate-800 pb-2">Comanda Actual</h2>

          {/* Lista de Items */}
          <div className="space-y-3 max-h-56 overflow-y-auto mb-4 pr-1">
            {pedido.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-6">No hay productos añadidos</p>
            ) : (
              pedido.map((item) => (
                <div key={item.id} className="flex justify-between items-center bg-slate-950 p-2 rounded-lg border border-slate-800">
                  <div className="text-sm">
                    <p className="font-medium">{item.nombre}</p>
                    <p className="text-xs text-yellow-500">${(item.precio * item.cantidad).toLocaleString('es-CL')}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => modificarCantidad(item.id, -1)}
                      className="w-6 h-6 bg-slate-800 rounded text-slate-300 flex items-center justify-center font-bold"
                    >
                      -
                    </button>
                    <span className="text-sm font-semibold">{item.cantidad}</span>
                    <button
                      type="button"
                      onClick={() => modificarCantidad(item.id, 1)}
                      className="w-6 h-6 bg-slate-800 rounded text-slate-300 flex items-center justify-center font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Formulario Cliente y Pago */}
          <form onSubmit={handleCrearPedido} className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Cliente"
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
                className="w-full p-2 bg-slate-950 border border-slate-800 rounded text-sm text-white"
              />
              <input
                type="text"
                placeholder="Teléfono"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className="w-full p-2 bg-slate-950 border border-slate-800 rounded text-sm text-white"
              />
            </div>

            <input
              type="text"
              placeholder="Dirección (si es Delivery)"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              className="w-full p-2 bg-slate-950 border border-slate-800 rounded text-sm text-white"
            />

            <div className="grid grid-cols-2 gap-2">
              <select
                value={tipoEntrega}
                onChange={(e: any) => setTipoEntrega(e.target.value)}
                className="w-full p-2 bg-slate-950 border border-slate-800 rounded text-sm text-white"
              >
                <option value="Delivery">Delivery</option>
                <option value="Retiro">Retiro</option>
                <option value="Local">Local</option>
              </select>

              <select
                value={metodoPago}
                onChange={(e) => setMetodoPago(e.target.value)}
                className="w-full p-2 bg-slate-950 border border-slate-800 rounded text-sm text-white"
              >
                <option value="Efectivo">Efectivo</option>
                <option value="Débito">Débito</option>
                <option value="Transferencia">Transferencia</option>
                <option value="Mercado Pago Point">💳 Point Smart 2</option>
              </select>
            </div>

            <div className="border-t border-slate-800 pt-3 mt-3 flex justify-between items-center text-lg font-bold">
              <span>Total:</span>
              <span className="text-yellow-400">${total.toLocaleString('es-CL')}</span>
            </div>

            {mensaje && <p className="text-xs text-green-400 text-center">{mensaje}</p>}

            <button
              type="submit"
              disabled={cargando || pedido.length === 0}
              className="w-full py-3 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl shadow-lg transition active:scale-95 mt-2"
            >
              {cargando ? 'Procesando...' : 'Confirmar y Cobrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
