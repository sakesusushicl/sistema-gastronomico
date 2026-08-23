'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface Product {
  id?: number | string;
  name?: string;
  nombre?: string;
  title?: string;
  product_name?: string;
  price?: number;
  precio?: number;
  unit_price?: number;
  base_price?: number;
  category?: string;
  categoria?: string;
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
  const [orderType, setOrderType] = useState<string>('DELIVERY');
  const [paymentMethod, setPaymentMethod] = useState<string>('EFECTIVO');
  const [orderNotes, setOrderNotes] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [lastOrder, setLastOrder] = useState<any>(null);

  const getProductName = (p: Product): string => {
    return p.name || p.nombre || p.title || p.product_name || 'Producto';
  };

  const getProductPrice = (p: Product): number => {
    return Number(p.price || p.precio || p.unit_price || p.base_price || 0);
  };

  const getProductCategory = (p: Product): string => {
    return p.category || p.categoria || 'Varios';
  };

  useEffect(() => {
    async function fetchMenu() {
      if (!supabaseUrl || !supabaseAnonKey) return;
      try {
        const { data, error } = await supabase.from('products').select('*');
        if (!error && data && data.length > 0) {
          setProducts(data);
          const rawCats = data.map((p: any) => p.category || p.categoria).filter(Boolean);
          const cats = Array.from(new Set(rawCats)) as string[];
          setCategories(['Todos', ...cats]);
        } else {
          const fallback: Product[] = [
            { id: 1, name: 'Envuelto en Palta', price: 6500, category: 'Rolls' },
            { id: 2, name: 'Envuelto en Panko', price: 6000, category: 'Rolls' },
            { id: 3, name: 'Ciboulette o Sesamo', price: 5500, category: 'Rolls' },
            { id: 4, name: 'Promo 30 Piezas', price: 14990, category: 'Promociones' },
            { id: 5, name: 'Handroll Pollo', price: 3500, category: 'Handrolls' },
            { id: 6, name: 'Bebida 1.5L', price: 2500, category: 'Bebidas' },
          ];
          setProducts(fallback);
          setCategories(['Todos', 'Rolls', 'Promociones', 'Handrolls', 'Bebidas']);
        }
      } catch (err) {
        console.error('Error cargando menú:', err);
      }
    }
    fetchMenu();
  }, []);

  const addToOrder = (product: Product) => {
    const name = getProductName(product);
    const price = getProductPrice(product);

    setOrderItems((prev) => {
      const index = prev.findIndex((i) => i.product_name === name);
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
          product_name: name,
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

  const removeItem = (index: number) => {
    setOrderItems((prev) => prev.filter((_, i) => i !== index));
  };

  const totalAmount = orderItems.reduce((acc, item) => acc + item.subtotal, 0);

  const filteredProducts = products.filter((p) => {
    const cat = getProductCategory(p);
    const name = getProductName(p);
    const matchCategory = selectedCategory === 'Todos' || cat === selectedCategory;
    const matchSearch = name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchCategory && matchSearch;
  });

  const printProfessionalTicket = (order: any) => {
    const w = window.open('', '_blank', 'width=380,height=600');
    if (!w) {
      alert('Habilita las ventanas emergentes para la impresión del ticket.');
      return;
    }

    const now = new Date();
    const dia = String(now.getDate()).padStart(2, '0');
    const mes = String(now.getMonth() + 1).padStart(2, '0');
    const anio = now.getFullYear();
    const fecha = `${dia}-${mes}-${anio}`;

    let horas = now.getHours();
    const minutos = String(now.getMinutes()).padStart(2, '0');
    const ampm = horas >= 12 ? 'p. m.' : 'a. m.';
    horas = horas % 12;
    horas = horas ? horas : 12;
    const horaFormateada = `${String(horas).padStart(2, '0')}:${minutos} ${ampm}`;

    const itemsRows = order.items
      .map(
        (it: any) => `
        <div style="margin-bottom: 8px;">
          <div style="font-size: 15px; font-weight: 900; letter-spacing: 0.3px;">
            [ ${it.quantity} ] ${it.product_name.toUpperCase()}
          </div>
          ${
            order.notes
              ? `<div style="font-size: 13px; font-weight: bold; margin-top: 2px; padding-left: 12px;">>> NOTA: ${order.notes.toUpperCase()}</div>`
              : ''
          }
        </div>
      `
      )
      .join('');

    w.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Comanda #${order.order_number}</title>
        <style>
          @page { margin: 0; size: auto; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            width: 290px;
            margin: 0 auto;
            padding: 12px 6px;
            color: #000;
            background: #fff;
          }
          .center { text-align: center; }
          .bold { font-weight: 900; }
          .divider-solid { border-bottom: 2px solid #000; margin: 8px 0; }
          .divider-dashed { border-bottom: 1.5px dashed #000; margin: 8px 0; }
          .row { display: flex; justify-content: space-between; align-items: center; }
        </style>
      </head>
      <body>
        <div class="center bold" style="font-size: 18px; letter-spacing: 1px;">SAKESU SUSHI</div>
        <div class="center" style="font-size: 11px; margin-top: 1px; font-weight: bold; letter-spacing: 0.5px;">COMANDA DE PRODUCCIÓN</div>
        <div class="divider-solid"></div>

        <div class="center bold" style="font-size: 24px; margin: 6px 0;">ORDEN #${order.order_number}</div>
        <div class="center bold" style="font-size: 14px; letter-spacing: 0.5px;">
          *** ${order.order_type === 'DELIVERY' ? 'SERVICIO DELIVERY' : 'RETIRO EN LOCAL'} ***
        </div>
        <div class="divider-dashed"></div>

        <div style="font-size: 13px; line-height: 1.45;">
          <div><strong style="font-weight: 900;">FECHA:</strong> ${fecha} &nbsp;&nbsp;<strong style="font-weight: 900;">HORA:</strong> ${horaFormateada}</div>
          <div style="margin-top: 4px; font-weight: 900;">
            CLIENTE: ${order.customer_name ? order.customer_name.toUpperCase() : 'CLIENTE GENERAL'} ${order.customer_phone ? `(${order.customer_phone})` : ''}
          </div>
          
          ${
            order.delivery_address
              ? `
          <div style="margin-top: 8px; border: 2px solid #000; padding: 6px 8px; font-size: 15px; font-weight: 900; line-height: 1.25;">
            DIR: ${order.delivery_address.toUpperCase()}
          </div>
          `
              : ''
          }

          <div style="margin-top: 8px; font-size: 14px; font-weight: 900;">
            MÉTODO DE PAGO: ${order.payment_method.toUpperCase()}
          </div>
        </div>

        <div class="divider-solid"></div>
        <div style="font-size: 13px; font-weight: 900; margin-bottom: 8px; letter-spacing: 0.3px;">DETALLE DE PRODUCTOS:</div>
        <div>${itemsRows}</div>

        <div class="divider-solid"></div>
        <div class="row bold" style="font-size: 19px; padding: 4px 0;">
          <span>TOTAL:</span>
          <span>$${Number(order.total_amount).toLocaleString('es-CL')}</span>
        </div>
        <div class="divider-dashed"></div>
        <div class="center" style="font-size: 11px; font-weight: bold; margin-top: 6px;">- FIN DE COMANDA -</div>

        <script>
          window.onload = function() {
            window.focus();
            window.print();
            setTimeout(function() { window.close(); }, 500);
          };
        </script>
      </body>
      </html>
    `);
    w.document.close();
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (orderItems.length === 0) {
      alert('Debes agregar al menos un producto a la comanda.');
      return;
    }

    setIsSubmitting(true);
    setStatusMessage('');
    const orderNumber = Math.floor(Math.random() * 900) + 100;

    const orderData = {
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
    };

    try {
      if (supabaseUrl && supabaseAnonKey) {
        await supabase.from('orders').insert([orderData]);
      }

      setLastOrder(orderData);
      printProfessionalTicket(orderData);

      setStatusMessage(`¡Comanda #${orderNumber} confirmada e impresa!`);
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
      {/* Catálogo */}
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
              type="button"
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
            const name = getProductName(product);
            const price = getProductPrice(product);
            return (
              <button
                key={product.id || idx}
                type="button"
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
                }}
              >
                <span style={{ fontSize: '14px', fontWeight: '600', color: '#f3f4f6' }}>{name}</span>
                <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#ef4444', marginTop: '12px' }}>
                  ${price.toLocaleString('es-CL')}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Comanda Actual */}
      <div style={{ width: '400px', backgroundColor: '#121212', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #262626', paddingBottom: '8px', marginBottom: '16px' }}>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#ef4444' }}>
              Comanda Actual
            </h2>
            {lastOrder && (
              <button
                type="button"
                onClick={() => printProfessionalTicket(lastOrder)}
                style={{ padding: '4px 10px', backgroundColor: '#262626', border: '1px solid #404040', color: '#fff', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}
              >
                🖨️ Re-imprimir #{lastOrder.order_number}
              </button>
            )}
          </div>

          {/* Lista de Items */}
          <div style={{ maxHeight: '230px', overflowY: 'auto', marginBottom: '16px' }}>
            {orderItems.length === 0 ? (
              <p style={{ fontSize: '13px', color: '#666666', textAlign: 'center', margin: '30px 0' }}>
                Selecciona productos del menú
              </p>
            ) : (
              orderItems.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0a0a0a', padding: '8px 12px', borderRadius: '8px', marginBottom: '8px', border: '1px solid #262626' }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: '600' }}>{item.product_name}</p>
                    <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#ef4444' }}>${item.subtotal.toLocaleString('es-CL')}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button type="button" onClick={() => updateQuantity(idx, -1)} style={{ width: '26px', height: '26px', backgroundColor: '#262626', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>-</button>
                    <span style={{ fontSize: '13px', fontWeight: 'bold', minWidth: '18px', textAlign: 'center' }}>{item.quantity}</span>
                    <button type="button" onClick={() => updateQuantity(idx, 1)} style={{ width: '26px', height: '26px', backgroundColor: '#262626', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>+</button>
                    <button type="button" onClick={() => removeItem(idx)} style={{ width: '26px', height: '26px', backgroundColor: '#3b1111', color: '#f87171', border: 'none', borderRadius: '4px', cursor: 'pointer', marginLeft: '4px', fontSize: '11px' }}>🗑️</button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Formulario */}
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
                <option value="DELIVERY">Delivery</option>
                <option value="RETIRO">Retiro en Local</option>
              </select>

              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                style={{ width: '100%', padding: '8px', backgroundColor: '#0a0a0a', border: '1px solid #262626', borderRadius: '6px', color: '#fff', fontSize: '13px', outline: 'none' }}
              >
                <option value="EFECTIVO">Efectivo</option>
                <option value="DÉBITO">Débito</option>
                <option value="TRANSFERENCIA">Transferencia</option>
              </select>
            </div>

            <input
              type="text"
              placeholder="Notas / Salsas (ej: SOYA, SOYA)"
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
              {isSubmitting ? 'Guardando...' : '🖨️ Confirmar e Imprimir'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
