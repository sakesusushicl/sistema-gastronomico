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
  const [activeTab, setActiveTab] = useState<'pos' | 'caja'>('pos');
  
  // POS States
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

  // Caja & Historial States
  const [salesHistory, setSalesHistory] = useState<any[]>([]);
  const [cashEntries, setCashEntries] = useState<{ amount: number; reason: string; time: string }[]>([]);
  const [entryAmount, setEntryAmount] = useState<string>('');
  const [entryReason, setEntryReason] = useState<string>('Fondo Inicial');

  const getProductName = (p: Product): string => {
    return p.name || p.nombre || p.title || p.product_name || 'Producto';
  };

  const getProductPrice = (p: Product): number => {
    return Number(p.price || p.precio || p.unit_price || p.base_price || 0);
  };

  const getProductCategory = (p: Product): string => {
    return p.category || p.categoria || 'Varios';
  };

  // Cargar Menú y Ventas
  const fetchMenu = async () => {
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
  };

  const fetchSales = async () => {
    if (!supabaseUrl || !supabaseAnonKey) return;
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setSalesHistory(data);
      }
    } catch (err) {
      console.error('Error cargando ventas:', err);
    }
  };

  useEffect(() => {
    fetchMenu();
    fetchSales();
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

    const items = order.items || [];
    const itemsRows = items
      .map(
        (it: any) => `
        <div style="margin-bottom: 10px;">
          <div style="font-size: 18px; font-weight: 900; letter-spacing: -0.2px;">
            [ ${it.quantity} ] ${(it.product_name || '').toUpperCase()}
          </div>
          ${
            order.notes
              ? `<div style="font-size: 15px; font-weight: 900; margin-top: 3px; padding-left: 10px;">>> NOTA: ${order.notes.toUpperCase()}</div>`
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
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
            width: 300px;
            margin: 0 auto;
            padding: 10px 4px;
            color: #000;
            background: #fff;
            font-weight: 900;
            -webkit-text-stroke: 0.35px #000;
          }
          .center { text-align: center; }
          .divider-solid { border-bottom: 3px solid #000; margin: 8px 0; }
          .divider-dashed { border-bottom: 2px dashed #000; margin: 8px 0; }
          .row { display: flex; justify-content: space-between; align-items: center; }
        </style>
      </head>
      <body>
        <div class="center" style="font-size: 22px; font-weight: 900; letter-spacing: 0.5px;">SAKESU SUSHI</div>
        <div class="center" style="font-size: 13px; margin-top: 1px; font-weight: 900;">COMANDA DE PRODUCCIÓN</div>
        <div class="divider-solid"></div>

        <div class="center" style="font-size: 28px; font-weight: 900; margin: 4px 0;">ORDEN #${order.order_number}</div>
        <div class="center" style="font-size: 16px; font-weight: 900;">
          *** ${order.order_type === 'DELIVERY' ? 'SERVICIO DELIVERY' : 'RETIRO EN LOCAL'} ***
        </div>
        <div class="divider-dashed"></div>

        <div style="font-size: 15px; line-height: 1.4; font-weight: 900;">
          <div>FECHA: ${fecha} &nbsp;&nbsp;HORA: ${horaFormateada}</div>
          <div style="margin-top: 5px;">
            CLIENTE: ${order.customer_name ? order.customer_name.toUpperCase() : 'CLIENTE GENERAL'} ${order.customer_phone ? `(${order.customer_phone})` : ''}
          </div>
          
          ${
            order.delivery_address
              ? `
          <div style="margin-top: 8px; border: 3px solid #000; padding: 6px 8px; font-size: 17px; font-weight: 900; line-height: 1.2;">
            DIR: ${order.delivery_address.toUpperCase()}
          </div>
          `
              : ''
          }

          <div style="margin-top: 8px; font-size: 16px; font-weight: 900;">
            MÉTODO DE PAGO: ${(order.payment_method || 'EFECTIVO').toUpperCase()}
          </div>
        </div>

        <div class="divider-solid"></div>
        <div style="font-size: 15px; font-weight: 900; margin-bottom: 8px;">DETALLE DE PRODUCTOS:</div>
        <div>${itemsRows}</div>

        <div class="divider-solid"></div>
        <div class="row" style="font-size: 22px; font-weight: 900; padding: 4px 0;">
          <span>TOTAL:</span>
          <span>$${Number(order.total_amount).toLocaleString('es-CL')}</span>
        </div>
        <div class="divider-dashed"></div>
        <div class="center" style="font-size: 12px; font-weight: 900; margin-top: 6px;">- FIN DE COMANDA -</div>

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

  const printZReport = () => {
    const w = window.open('', '_blank', 'width=380,height=600');
    if (!w) {
      alert('Habilita las ventanas emergentes para la impresión del cierre.');
      return;
    }

    const now = new Date();
    const dia = String(now.getDate()).padStart(2, '0');
    const mes = String(now.getMonth() + 1).padStart(2, '0');
    const anio = now.getFullYear();
    const fecha = `${dia}-${mes}-${anio}`;
    const hora = now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });

    const totalCashSales = salesHistory
      .filter((s) => (s.payment_method || '').toUpperCase() === 'EFECTIVO')
      .reduce((acc, s) => acc + Number(s.total_amount || 0), 0);

    const totalDebitSales = salesHistory
      .filter((s) => (s.payment_method || '').toUpperCase().includes('DÉBITO') || (s.payment_method || '').toUpperCase().includes('DEBITO'))
      .reduce((acc, s) => acc + Number(s.total_amount || 0), 0);

    const totalTransferSales = salesHistory
      .filter((s) => (s.payment_method || '').toUpperCase() === 'TRANSFERENCIA')
      .reduce((acc, s) => acc + Number(s.total_amount || 0), 0);

    const totalCashInEntries = cashEntries.reduce((acc, e) => acc + e.amount, 0);
    const grandTotalSales = totalCashSales + totalDebitSales + totalTransferSales;
    const totalCashInDrawer = totalCashInEntries + totalCashSales;

    w.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Cierre de Caja - Sakesu Sushi</title>
        <style>
          @page { margin: 0; size: auto; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
            width: 300px;
            margin: 0 auto;
            padding: 10px 4px;
            color: #000;
            background: #fff;
            font-weight: 900;
            -webkit-text-stroke: 0.35px #000;
          }
          .center { text-align: center; }
          .divider-solid { border-bottom: 3px solid #000; margin: 8px 0; }
          .divider-dashed { border-bottom: 2px dashed #000; margin: 8px 0; }
          .row { display: flex; justify-content: space-between; align-items: center; font-size: 15px; margin: 4px 0; }
        </style>
      </head>
      <body>
        <div class="center" style="font-size: 22px; font-weight: 900;">SAKESU SUSHI</div>
        <div class="center" style="font-size: 14px; margin-top: 2px; font-weight: 900;">CIERRE DIARIO DE CAJA (INFORME Z)</div>
        <div class="divider-solid"></div>

        <div style="font-size: 14px; line-height: 1.4;">
          <div>FECHA: ${fecha} &nbsp;&nbsp;HORA: ${hora}</div>
          <div>CANTIDAD DE PEDIDOS: ${salesHistory.length}</div>
        </div>

        <div class="divider-dashed"></div>
        <div style="font-size: 15px; font-weight: 900; margin-bottom: 6px;">DESGLOSE POR MEDIO DE PAGO:</div>

        <div class="row">
          <span>(+) EFECTIVO VENTAS:</span>
          <span>$${totalCashSales.toLocaleString('es-CL')}</span>
        </div>
        <div class="row">
          <span>(+) DÉBITO / TARJETA:</span>
          <span>$${totalDebitSales.toLocaleString('es-CL')}</span>
        </div>
        <div class="row">
          <span>(+) TRANSFERENCIA:</span>
          <span>$${totalTransferSales.toLocaleString('es-CL')}</span>
        </div>

        <div class="divider-solid"></div>
        <div class="row" style="font-size: 18px;">
          <span>VENTAS TOTALES:</span>
          <span>$${grandTotalSales.toLocaleString('es-CL')}</span>
        </div>
        <div class="divider-solid"></div>

        <div style="font-size: 15px; font-weight: 900; margin-bottom: 6px;">CUADRE DE EFECTIVO EN CAJA:</div>
        <div class="row">
          <span>(+) ENTRADAS / FONDO:</span>
          <span>$${totalCashInEntries.toLocaleString('es-CL')}</span>
        </div>
        <div class="row">
          <span>(+) VENTAS EN EFECTIVO:</span>
          <span>$${totalCashSales.toLocaleString('es-CL')}</span>
        </div>
        <div class="divider-dashed"></div>
        <div class="row" style="font-size: 20px;">
          <span>EFECTIVO ESPERADO:</span>
          <span>$${totalCashInDrawer.toLocaleString('es-CL')}</span>
        </div>

        <div class="divider-solid"></div>
        <div class="center" style="font-size: 12px; margin-top: 8px;">- CIERRE DE CAJA COMPLETADO -</div>

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

  const handleAddCashEntry = (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(entryAmount);
    if (!val || val <= 0) return;

    const newEntry = {
      amount: val,
      reason: entryReason || 'Fondo Inicial',
      time: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
    };

    setCashEntries([...cashEntries, newEntry]);
    setEntryAmount('');
    setEntryReason('Entrada');
    alert(`¡Entrada de $${val.toLocaleString('es-CL')} registrada!`);
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
      setSalesHistory([orderData, ...salesHistory]);
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

  // Métricas para pestaña de Caja
  const totalCashSales = salesHistory
    .filter((s) => (s.payment_method || '').toUpperCase() === 'EFECTIVO')
    .reduce((acc, s) => acc + Number(s.total_amount || 0), 0);

  const totalDebitSales = salesHistory
    .filter((s) => (s.payment_method || '').toUpperCase().includes('DÉBITO') || (s.payment_method || '').toUpperCase().includes('DEBITO'))
    .reduce((acc, s) => acc + Number(s.total_amount || 0), 0);

  const totalTransferSales = salesHistory
    .filter((s) => (s.payment_method || '').toUpperCase() === 'TRANSFERENCIA')
    .reduce((acc, s) => acc + Number(s.total_amount || 0), 0);

  const totalCashInEntries = cashEntries.reduce((acc, e) => acc + e.amount, 0);
  const grandTotalSales = totalCashSales + totalDebitSales + totalTransferSales;
  const totalCashInDrawer = totalCashInEntries + totalCashSales;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a', color: '#ffffff', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header con pestañas */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', backgroundColor: '#121212', borderBottom: '1px solid #262626' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '900', letterSpacing: '0.5px' }}>
            SAKESU <span style={{ color: '#dc2626' }}>SUSHI</span>
          </h1>
          <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#a3a3a3', fontStyle: 'italic' }}>
            "Cada bocado, una tentación"
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('pos')}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: activeTab === 'pos' ? '#dc2626' : '#262626',
              color: '#fff',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            🍣 Punto de Venta (POS)
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('caja');
              fetchSales();
            }}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: activeTab === 'caja' ? '#dc2626' : '#262626',
              color: '#fff',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            💰 Caja & Cierre Diarios
          </button>
        </div>
      </header>

      {/* PESTAÑA: POS */}
      {activeTab === 'pos' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', minHeight: 'calc(100vh - 75px)' }}>
          {/* Catálogo de Productos */}
          <div style={{ flex: '1 1 600px', padding: '24px', borderRight: '1px solid #262626' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>Carta de Productos</h2>
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

            {/* Grilla */}
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

          {/* Panel Comanda */}
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

              {/* Items */}
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

              {/* Form */}
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
      )}

      {/* PESTAÑA: HISTORIAL & CIERRE DE CAJA */}
      {activeTab === 'caja' && (
        <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
          {/* Tarjetas de Resumen */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div style={{ backgroundColor: '#141414', padding: '18px', borderRadius: '10px', border: '1px solid #262626' }}>
              <p style={{ margin: 0, fontSize: '12px', color: '#a3a3a3' }}>Ventas Totales</p>
              <h3 style={{ margin: '6px 0 0 0', fontSize: '24px', fontWeight: '900', color: '#22c55e' }}>${grandTotalSales.toLocaleString('es-CL')}</h3>
              <span style={{ fontSize: '11px', color: '#666' }}>{salesHistory.length} órdenes</span>
            </div>

            <div style={{ backgroundColor: '#141414', padding: '18px', borderRadius: '10px', border: '1px solid #262626' }}>
              <p style={{ margin: 0, fontSize: '12px', color: '#a3a3a3' }}>Efectivo en Ventas</p>
              <h3 style={{ margin: '6px 0 0 0', fontSize: '24px', fontWeight: '900', color: '#ef4444' }}>${totalCashSales.toLocaleString('es-CL')}</h3>
              <span style={{ fontSize: '11px', color: '#666' }}>Recibido en mano</span>
            </div>

            <div style={{ backgroundColor: '#141414', padding: '18px', borderRadius: '10px', border: '1px solid #262626' }}>
              <p style={{ margin: 0, fontSize: '12px', color: '#a3a3a3' }}>Débito / Tarjetas</p>
              <h3 style={{ margin: '6px 0 0 0', fontSize: '24px', fontWeight: '900', color: '#38bdf8' }}>${totalDebitSales.toLocaleString('es-CL')}</h3>
              <span style={{ fontSize: '11px', color: '#666' }}>Terminal / POS</span>
            </div>

            <div style={{ backgroundColor: '#141414', padding: '18px', borderRadius: '10px', border: '1px solid #262626' }}>
              <p style={{ margin: 0, fontSize: '12px', color: '#a3a3a3' }}>Transferencias</p>
              <h3 style={{ margin: '6px 0 0 0', fontSize: '24px', fontWeight: '900', color: '#eab308' }}>${totalTransferSales.toLocaleString('es-CL')}</h3>
              <span style={{ fontSize: '11px', color: '#666' }}>Cuenta Bancaria</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px' }}>
            {/* Tabla de Historial */}
            <div style={{ backgroundColor: '#141414', padding: '20px', borderRadius: '10px', border: '1px solid #262626' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>Historial de Ventas del Turno</h3>
                <button
                  onClick={fetchSales}
                  style={{ padding: '6px 12px', backgroundColor: '#262626', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '12px', cursor: 'pointer' }}
                >
                  🔄 Actualizar
                </button>
              </div>

              <div style={{ overflowX: 'auto', maxHeight: '420px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #262626', color: '#a3a3a3' }}>
                      <th style={{ padding: '10px 8px' }}>Orden</th>
                      <th style={{ padding: '10px 8px' }}>Cliente</th>
                      <th style={{ padding: '10px 8px' }}>Tipo</th>
                      <th style={{ padding: '10px 8px' }}>Pago</th>
                      <th style={{ padding: '10px 8px' }}>Total</th>
                      <th style={{ padding: '10px 8px', textAlign: 'center' }}>Ticket</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesHistory.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: '#666' }}>
                          No hay ventas registradas aún.
                        </td>
                      </tr>
                    ) : (
                      salesHistory.map((s, idx) => (
                        <tr key={s.id || idx} style={{ borderBottom: '1px solid #1f1f1f' }}>
                          <td style={{ padding: '10px 8px', fontWeight: 'bold', color: '#ef4444' }}>#{s.order_number}</td>
                          <td style={{ padding: '10px 8px' }}>{s.customer_name || 'General'}</td>
                          <td style={{ padding: '10px 8px' }}>{s.order_type}</td>
                          <td style={{ padding: '10px 8px' }}>{s.payment_method}</td>
                          <td style={{ padding: '10px 8px', fontWeight: 'bold' }}>${Number(s.total_amount || 0).toLocaleString('es-CL')}</td>
                          <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                            <button
                              onClick={() => printProfessionalTicket(s)}
                              style={{ padding: '4px 8px', backgroundColor: '#262626', border: '1px solid #404040', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
                            >
                              🖨️
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Panel Lateral: Entrada de Dinero y Cierre */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Entrada de Dinero / Fondo */}
              <div style={{ backgroundColor: '#141414', padding: '20px', borderRadius: '10px', border: '1px solid #262626' }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 'bold' }}>💵 Entrada de Caja / Fondo</h3>
                <form onSubmit={handleAddCashEntry} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <input
                    type="number"
                    placeholder="Monto ($) Ej: 30000"
                    value={entryAmount}
                    onChange={(e) => setEntryAmount(e.target.value)}
                    style={{ width: '100%', padding: '8px', backgroundColor: '#0a0a0a', border: '1px solid #262626', borderRadius: '6px', color: '#fff', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                  />
                  <input
                    type="text"
                    placeholder="Motivo (ej: Fondo Inicial)"
                    value={entryReason}
                    onChange={(e) => setEntryReason(e.target.value)}
                    style={{ width: '100%', padding: '8px', backgroundColor: '#0a0a0a', border: '1px solid #262626', borderRadius: '6px', color: '#fff', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                  />
                  <button
                    type="submit"
                    style={{ width: '100%', padding: '10px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}
                  >
                    + Registrar Entrada
                  </button>
                </form>

                {cashEntries.length > 0 && (
                  <div style={{ marginTop: '14px', borderTop: '1px solid #262626', paddingTop: '10px', fontSize: '12px' }}>
                    <p style={{ margin: '0 0 6px 0', fontWeight: 'bold', color: '#a3a3a3' }}>Entradas registradas:</p>
                    {cashEntries.map((e, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', color: '#ccc' }}>
                        <span>{e.time} - {e.reason}:</span>
                        <span style={{ fontWeight: 'bold', color: '#22c55e' }}>+${e.amount.toLocaleString('es-CL')}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Botón Cierre de Caja */}
              <div style={{ backgroundColor: '#141414', padding: '20px', borderRadius: '10px', border: '1px solid #262626', textAlign: 'center' }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 'bold' }}>🏁 Cierre de Caja</h3>
                <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: '#a3a3a3' }}>
                  Imprime el reporte térmico oficial con el cuadre de efectivo y totales.
                </p>
                <div style={{ marginBottom: '14px', fontSize: '14px', textAlign: 'left', backgroundColor: '#0a0a0a', padding: '10px', borderRadius: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span>Efectivo en Caja:</span>
                    <span style={{ fontWeight: 'bold', color: '#22c55e' }}>${totalCashInDrawer.toLocaleString('es-CL')}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Ventas Totales:</span>
                    <span style={{ fontWeight: 'bold' }}>${grandTotalSales.toLocaleString('es-CL')}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={printZReport}
                  style={{ width: '100%', padding: '12px', backgroundColor: '#dc2626', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '900', fontSize: '14px', cursor: 'pointer' }}
                >
                  🖨️ Imprimir Cierre (Informe Z)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
