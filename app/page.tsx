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

interface ItemModification {
  tipo: 'envoltura' | 'relleno' | 'extra';
  detalle: string;
}

interface OrderItem {
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  special_notes?: string;
  modificaciones?: ItemModification[];
}

export default function GastronomicPOS() {
  const [activeTab, setActiveTab] = useState<'pos' | 'cocina' | 'menu' | 'caja'>('pos');
  
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

  // Modal para Cambios de Relleno/Envoltura
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [modalEnvoltura, setModalEnvoltura] = useState<string>('Original');
  const [modalRelleno, setModalRelleno] = useState<string>('Original');
  const [modalItemNote, setModalItemNote] = useState<string>('');

  // Cocina & Cronómetros States
  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [currentTime, setCurrentTime] = useState<number>(Date.now());

  // Caja & Historial States
  const [salesHistory, setSalesHistory] = useState<any[]>([]);
  const [selectedHistoryOrder, setSelectedHistoryOrder] = useState<any | null>(null);
  const [cashEntries, setCashEntries] = useState<{ amount: number; reason: string; time: string }[]>([]);
  const [entryAmount, setEntryAmount] = useState<string>('');
  const [entryReason, setEntryReason] = useState<string>('Fondo Inicial');

  // Administrador de Carta States
  const [newProdName, setNewProdName] = useState<string>('');
  const [newProdPrice, setNewProdPrice] = useState<string>('');
  const [newProdCategory, setNewProdCategory] = useState<string>('Rolls');
  const [isSavingProduct, setIsSavingProduct] = useState<boolean>(false);

  const getProductName = (p: Product): string => {
    return p.name || p.nombre || p.title || p.product_name || 'Producto';
  };

  const getProductPrice = (p: Product): number => {
    return Number(p.price || p.precio || p.unit_price || p.base_price || 0);
  };

  const getProductCategory = (p: Product): string => {
    return p.category || p.categoria || 'Varios';
  };

  // Timer en vivo para actualizar cronómetros cada segundo
  useEffect(() => {
    const timerInterval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timerInterval);
  }, []);

  // Cargar pedidos locales de respaldo al abrir
  useEffect(() => {
    try {
      const localActive = localStorage.getItem('sakesu_active_orders');
      if (localActive) {
        setActiveOrders(JSON.parse(localActive));
      }
      const localHistory = localStorage.getItem('sakesu_sales_history');
      if (localHistory) {
        setSalesHistory(JSON.parse(localHistory));
      }
    } catch (e) {
      console.error('Error cargando storage local:', e);
    }
  }, []);

  // Cargar Menú
  const fetchMenu = async () => {
    if (!supabaseUrl || !supabaseAnonKey) return;
    try {
      const { data, error } = await supabase.from('products').select('*').order('name', { ascending: true });
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

  // Cargar Ventas y filtrar pendientes del día para Cocina
  const fetchSales = async () => {
    if (!supabaseUrl || !supabaseAnonKey) return;
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .gte('created_at', todayStart.toISOString())
        .order('created_at', { ascending: false });

      if (!error && data) {
        setSalesHistory(data);
        localStorage.setItem('sakesu_sales_history', JSON.stringify(data));

        const pending = data.filter((o: any) => {
          const st = String(o.status || 'pending').toLowerCase();
          return st !== 'completed' && st !== 'listo' && st !== 'entregado';
        });

        setActiveOrders(pending);
        localStorage.setItem('sakesu_active_orders', JSON.stringify(pending));
      }
    } catch (err) {
      console.error('Error cargando ventas:', err);
    }
  };

  useEffect(() => {
    fetchMenu();
    fetchSales();
  }, []);

  // Marcar orden como lista (Sale de cocina y pasa a completada)
  const handleMarkAsReady = async (orderId: any, orderNumber: any) => {
    try {
      if (supabaseUrl && supabaseAnonKey && orderId) {
        await supabase.from('orders').update({ status: 'completed' }).eq('id', orderId);
      }

      const updatedActive = activeOrders.filter((o) => {
        if (orderId && o.id) return o.id !== orderId;
        return o.order_number !== orderNumber;
      });
      setActiveOrders(updatedActive);
      localStorage.setItem('sakesu_active_orders', JSON.stringify(updatedActive));

      const updatedHistory = salesHistory.map((o) =>
        (o.id && o.id === orderId) || o.order_number === orderNumber
          ? { ...o, status: 'completed' }
          : o
      );
      setSalesHistory(updatedHistory);
      localStorage.setItem('sakesu_sales_history', JSON.stringify(updatedHistory));
    } catch (err: any) {
      alert('Error al actualizar comanda: ' + err.message);
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName || !newProdPrice) {
      alert('Por favor ingresa el nombre y el precio.');
      return;
    }

    setIsSavingProduct(true);
    const newProd = {
      name: newProdName.trim(),
      price: Number(newProdPrice),
      category: newProdCategory.trim() || 'Varios',
    };

    try {
      if (supabaseUrl && supabaseAnonKey) {
        const { error } = await supabase.from('products').insert([newProd]);
        if (error) throw error;
      }
      alert('¡Producto agregado con éxito a la carta!');
      setNewProdName('');
      setNewProdPrice('');
      fetchMenu();
    } catch (err: any) {
      alert('Error al guardar el producto: ' + err.message);
    } finally {
      setIsSavingProduct(false);
    }
  };

  const handleDeleteProduct = async (prodId: any, prodName: string) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar "${prodName}" de la carta?`)) return;

    try {
      if (supabaseUrl && supabaseAnonKey && prodId) {
        const { error } = await supabase.from('products').delete().eq('id', prodId);
        if (error) throw error;
      }
      setProducts(products.filter((p) => p.id !== prodId));
      alert(`"${prodName}" eliminado correctamente.`);
      fetchMenu();
    } catch (err: any) {
      alert('Error al eliminar producto: ' + err.message);
    }
  };

  const addToOrder = (product: Product) => {
    const name = getProductName(product);
    const price = getProductPrice(product);

    setOrderItems((prev) => [
      ...prev,
      {
        product_name: name,
        quantity: 1,
        unit_price: price,
        subtotal: price,
        modificaciones: [],
        special_notes: '',
      },
    ]);
  };

  const openCustomizationModal = (index: number) => {
    setEditingItemIndex(index);
    const item = orderItems[index];
    const env = item.modificaciones?.find((m) => m.tipo === 'envoltura')?.detalle || 'Original';
    const rel = item.modificaciones?.find((m) => m.tipo === 'relleno')?.detalle || 'Original';
    setModalEnvoltura(env);
    setModalRelleno(rel);
    setModalItemNote(item.special_notes || '');
  };

  const saveCustomization = () => {
    if (editingItemIndex === null) return;
    setOrderItems((prev) => {
      const updated = [...prev];
      const mods: ItemModification[] = [];
      if (modalEnvoltura !== 'Original') {
        mods.push({ tipo: 'envoltura', detalle: modalEnvoltura });
      }
      if (modalRelleno !== 'Original') {
        mods.push({ tipo: 'relleno', detalle: modalRelleno });
      }

      updated[editingItemIndex] = {
        ...updated[editingItemIndex],
        modificaciones: mods,
        special_notes: modalItemNote.trim(),
      };
      return updated;
    });
    setEditingItemIndex(null);
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
      .map((it: any) => {
        const modsList = (it.modificaciones || [])
          .map((m: any) => `<div style="font-size: 14px; font-weight: 900; color: #000; padding-left: 12px; margin-top: 2px;">⚠️ CAMBIO ${m.tipo.toUpperCase()}: ${m.detalle.toUpperCase()}</div>`)
          .join('');

        const itemNote = it.special_notes
          ? `<div style="font-size: 13px; font-weight: 900; padding-left: 12px; margin-top: 2px;">↳ DETALLE: ${it.special_notes.toUpperCase()}</div>`
          : '';

        return `
        <div style="margin-bottom: 12px; border-bottom: 1px dashed #444; padding-bottom: 6px;">
          <div style="font-size: 18px; font-weight: 900; letter-spacing: -0.2px;">
            [ ${it.quantity} ] ${(it.product_name || '').toUpperCase()}
          </div>
          ${modsList}
          ${itemNote}
        </div>
      `;
      })
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

        ${
          order.notes
            ? `<div style="font-size: 14px; font-weight: 900; margin: 8px 0; border: 2px solid #000; padding: 4px 6px;">>> NOTA GENERAL: ${order.notes.toUpperCase()}</div>`
            : ''
        }

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
      .filter((s) => (s.payment_method || '').toUpperCase().includes('DÉBITO') || (s.payment_method || '').toUpperCase().includes('DEBITO') || (s.payment_method || '').toUpperCase().includes('POINT'))
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
      created_at: new Date().toISOString(),
    };

    try {
      if (supabaseUrl && supabaseAnonKey) {
        await supabase.from('orders').insert([orderData]);
      }

      setLastOrder(orderData);

      const newActive = [orderData, ...activeOrders];
      setActiveOrders(newActive);
      localStorage.setItem('sakesu_active_orders', JSON.stringify(newActive));

      const newHistory = [orderData, ...salesHistory];
      setSalesHistory(newHistory);
      localStorage.setItem('sakesu_sales_history', JSON.stringify(newHistory));

      printProfessionalTicket(orderData);

      setStatusMessage(`¡Comanda #${orderNumber} enviada a cocina e impresa!`);
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
    .filter((s) => (s.payment_method || '').toUpperCase().includes('DÉBITO') || (s.payment_method || '').toUpperCase().includes('DEBITO') || (s.payment_method || '').toUpperCase().includes('POINT'))
    .reduce((acc, s) => acc + Number(s.total_amount || 0), 0);

  const totalTransferSales = salesHistory
    .filter((s) => (s.payment_method || '').toUpperCase() === 'TRANSFERENCIA')
    .reduce((acc, s) => acc + Number(s.total_amount || 0), 0);

  const totalCashInEntries = cashEntries.reduce((acc, e) => acc + e.amount, 0);
  const grandTotalSales = totalCashSales + totalDebitSales + totalTransferSales;
  const totalCashInDrawer = totalCashInEntries + totalCashSales;

  // Formato del cronómetro y cálculo de color
  const getElapsedInfo = (createdAtStr: string) => {
    const created = new Date(createdAtStr).getTime();
    const diffSec = Math.max(0, Math.floor((currentTime - created) / 1000));
    const mins = Math.floor(diffSec / 60);
    const secs = diffSec % 60;
    const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    let color = '#22c55e'; // Verde (< 15 min)
    let bg = '#052e16';
    let border = '#15803d';

    if (mins >= 25) {
      color = '#ef4444'; // Rojo (> 25 min)
      bg = '#450a0a';
      border = '#dc2626';
    } else if (mins >= 15) {
      color = '#eab308'; // Amarillo (15 a 25 min)
      bg = '#422006';
      border = '#ca8a04';
    }

    return { formatted, mins, color, bg, border };
  };

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

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setActiveTab('pos')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: activeTab === 'pos' ? '#dc2626' : '#262626',
              color: '#fff',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            🍣 POS
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('cocina');
              fetchSales();
            }}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: activeTab === 'cocina' ? '#dc2626' : '#262626',
              color: '#fff',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            👨‍🍳 Monitor Cocina (KDS)
            {activeOrders.length > 0 && (
              <span style={{ backgroundColor: '#ef4444', color: '#fff', padding: '2px 6px', borderRadius: '10px', fontSize: '11px' }}>
                {activeOrders.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('menu');
              fetchMenu();
            }}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: activeTab === 'menu' ? '#dc2626' : '#262626',
              color: '#fff',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            📋 Administrar Carta
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('caja');
              fetchSales();
            }}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: activeTab === 'caja' ? '#dc2626' : '#262626',
              color: '#fff',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            💰 Historial & Cierre de Caja
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
          <div style={{ width: '420px', backgroundColor: '#121212', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
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

              {/* Items con selector de cambios */}
              <div style={{ maxHeight: '250px', overflowY: 'auto', marginBottom: '16px' }}>
                {orderItems.length === 0 ? (
                  <p style={{ fontSize: '13px', color: '#666666', textAlign: 'center', margin: '30px 0' }}>
                    Selecciona productos del menú
                  </p>
                ) : (
                  orderItems.map((item, idx) => (
                    <div key={idx} style={{ backgroundColor: '#0a0a0a', padding: '10px 12px', borderRadius: '8px', marginBottom: '8px', border: '1px solid #262626' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: 0, fontSize: '13px', fontWeight: '700' }}>{item.product_name}</p>
                          <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#ef4444' }}>${item.subtotal.toLocaleString('es-CL')}</p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <button type="button" onClick={() => updateQuantity(idx, -1)} style={{ width: '26px', height: '26px', backgroundColor: '#262626', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>-</button>
                          <span style={{ fontSize: '13px', fontWeight: 'bold', minWidth: '18px', textAlign: 'center' }}>{item.quantity}</span>
                          <button type="button" onClick={() => updateQuantity(idx, 1)} style={{ width: '26px', height: '26px', backgroundColor: '#262626', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>+</button>
                          <button type="button" onClick={() => removeItem(idx)} style={{ width: '26px', height: '26px', backgroundColor: '#3b1111', color: '#f87171', border: 'none', borderRadius: '4px', cursor: 'pointer', marginLeft: '4px', fontSize: '11px' }}>🗑️</button>
                        </div>
                      </div>

                      {/* Botón y visualización de modificaciones */}
                      <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px dashed #262626', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: '11px', color: '#eab308' }}>
                          {item.modificaciones && item.modificaciones.length > 0 ? (
                            item.modificaciones.map((m, mIdx) => (
                              <div key={mIdx}>⚠️ {m.tipo}: <strong>{m.detalle}</strong></div>
                            ))
                          ) : (
                            <span style={{ color: '#737373' }}>Sin cambios</span>
                          )}
                          {item.special_notes && <div style={{ color: '#38bdf8' }}>↳ {item.special_notes}</div>}
                        </div>
                        <button
                          type="button"
                          onClick={() => openCustomizationModal(idx)}
                          style={{ padding: '3px 8px', backgroundColor: '#262626', border: '1px solid #404040', color: '#fff', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}
                        >
                          ⚙️ Personalizar
                        </button>
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
                  placeholder="Notas generales comanda (ej: Soya, Acevichada)"
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

      {/* MODAL PERSONALIZADOR DE RELLENOS Y ENVOLTURAS */}
      {editingItemIndex !== null && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '16px' }}>
          <div style={{ backgroundColor: '#171717', border: '1px solid #333', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '420px' }}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 'bold', color: '#ef4444' }}>
              Personalizar Roll / Producto
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#a3a3a3' }}>
              {orderItems[editingItemIndex]?.product_name}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#d4d4d4' }}>Cambio de Envoltura:</label>
                <select
                  value={modalEnvoltura}
                  onChange={(e) => setModalEnvoltura(e.target.value)}
                  style={{ width: '100%', padding: '10px', marginTop: '4px', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '6px', color: '#fff', fontSize: '13px' }}
                >
                  <option value="Original">Sin cambio (Original)</option>
                  <option value="Palta">Envuelto en Palta</option>
                  <option value="Panko">Envuelto en Panko / Frito</option>
                  <option value="Salmón">Envuelto en Salmón</option>
                  <option value="Ciboulette">Ciboulette</option>
                  <option value="Sésamo">Sésamo</option>
                  <option value="Nori">Nori exterior (Hosomaki)</option>
                  <option value="Queso Crema">Queso Crema exterior</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#d4d4d4' }}>Cambio de Relleno:</label>
                <select
                  value={modalRelleno}
                  onChange={(e) => setModalRelleno(e.target.value)}
                  style={{ width: '100%', padding: '10px', marginTop: '4px', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '6px', color: '#fff', fontSize: '13px' }}
                >
                  <option value="Original">Sin cambio (Original)</option>
                  <option value="Pollo Teriyaki">Pollo Teriyaki</option>
                  <option value="Pollo Furay / Panko">Pollo Furay (Panko)</option>
                  <option value="Camarón">Camarón</option>
                  <option value="Camarón Furay">Camarón Furay</option>
                  <option value="Salmón">Salmón</option>
                  <option value="Kanikama">Kanikama</option>
                  <option value="Champiñón / Vegetariano">Champiñón / Veggie</option>
                  <option value="Solo Queso y Palta">Solo Queso y Palta</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#d4d4d4' }}>Nota o instrucción de preparación:</label>
                <input
                  type="text"
                  placeholder="Ej: Sin cebollín, poco queso, etc."
                  value={modalItemNote}
                  onChange={(e) => setModalItemNote(e.target.value)}
                  style={{ width: '100%', padding: '10px', marginTop: '4px', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '6px', color: '#fff', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setEditingItemIndex(null)}
                  style={{ flex: 1, padding: '10px', backgroundColor: '#262626', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={saveCustomization}
                  style={{ flex: 1, padding: '10px', backgroundColor: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}
                >
                  Guardar Cambios
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑA: MONITOR DE COCINA (KDS) */}
      {activeTab === 'cocina' && (
        <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>👨‍🍳 Pantalla de Cocina / KDS</h2>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#a3a3a3' }}>
                Comandas en preparación con cronómetros en tiempo real y alertas de cambio.
              </p>
            </div>
            <button
              type="button"
              onClick={fetchSales}
              style={{ padding: '8px 16px', backgroundColor: '#262626', border: '1px solid #404040', color: '#fff', borderRadius: '8px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}
            >
              🔄 Actualizar Pedidos
            </button>
          </div>

          {activeOrders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', backgroundColor: '#141414', borderRadius: '12px', border: '1px solid #262626' }}>
              <h3 style={{ fontSize: '20px', color: '#22c55e', margin: '0 0 8px 0' }}>✅ ¡Cocina al día!</h3>
              <p style={{ color: '#a3a3a3', margin: 0 }}>No hay pedidos pendientes en este momento.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
              {activeOrders.map((order) => {
                const elapsed = getElapsedInfo(order.created_at || new Date().toISOString());
                const items = order.items || [];
                return (
                  <div
                    key={order.id || order.order_number}
                    style={{
                      backgroundColor: '#141414',
                      border: `2px solid ${elapsed.border}`,
                      borderRadius: '12px',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                    }}
                  >
                    <div>
                      {/* Cabecera de la Comanda */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #262626', paddingBottom: '10px', marginBottom: '12px' }}>
                        <div>
                          <span style={{ fontSize: '22px', fontWeight: '900', color: '#fff' }}>
                            #{order.order_number}
                          </span>
                          <div style={{ fontSize: '12px', color: '#ef4444', fontWeight: 'bold', marginTop: '2px' }}>
                            {order.order_type === 'DELIVERY' ? '🛵 DELIVERY' : '🛍️ RETIRO'}
                          </div>
                        </div>

                        {/* Cronómetro en vivo */}
                        <div
                          style={{
                            backgroundColor: elapsed.bg,
                            color: elapsed.color,
                            border: `1px solid ${elapsed.border}`,
                            padding: '6px 12px',
                            borderRadius: '8px',
                            fontSize: '18px',
                            fontWeight: '900',
                            fontFamily: 'monospace',
                            letterSpacing: '1px',
                          }}
                        >
                          ⏱️ {elapsed.formatted}
                        </div>
                      </div>

                      {/* Info del Cliente */}
                      <div style={{ fontSize: '13px', color: '#ccc', marginBottom: '12px', lineHeight: 1.4 }}>
                        <div style={{ fontWeight: 'bold', color: '#fff' }}>👤 {order.customer_name || 'Cliente General'}</div>
                        {order.delivery_address && (
                          <div style={{ color: '#38bdf8', marginTop: '2px' }}>📍 {order.delivery_address}</div>
                        )}
                      </div>

                      {/* Lista de Rolls / Productos con modificaciones visibles */}
                      <div style={{ backgroundColor: '#0a0a0a', padding: '10px', borderRadius: '8px', border: '1px solid #262626', marginBottom: '12px' }}>
                        <div style={{ fontSize: '11px', color: '#a3a3a3', fontWeight: 'bold', marginBottom: '6px' }}>PRODUCTOS A PREPARAR:</div>
                        {items.map((it: any, idx: number) => (
                          <div key={idx} style={{ marginBottom: '10px', borderBottom: '1px dashed #262626', paddingBottom: '6px' }}>
                            <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff' }}>
                              <span style={{ color: '#ef4444', marginRight: '6px' }}>[{it.quantity}x]</span>
                              {it.product_name}
                            </div>
                            {it.modificaciones && it.modificaciones.length > 0 && (
                              <div style={{ marginTop: '4px', paddingLeft: '8px', borderLeft: '2px solid #ef4444' }}>
                                {it.modificaciones.map((m: any, mIdx: number) => (
                                  <div key={mIdx} style={{ fontSize: '12px', fontWeight: '900', color: '#f87171' }}>
                                    ⚠️ CAMBIO {m.tipo.toUpperCase()}: {m.detalle.toUpperCase()}
                                  </div>
                                ))}
                              </div>
                            )}
                            {it.special_notes && (
                              <div style={{ fontSize: '12px', color: '#38bdf8', marginTop: '2px' }}>
                                ↳ {it.special_notes}
                              </div>
                            )}
                          </div>
                        ))}

                        {order.notes && (
                          <div style={{ marginTop: '8px', paddingTop: '6px', fontSize: '13px', color: '#eab308', fontWeight: 'bold' }}>
                            📝 NOTA GENERAL: {order.notes}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Botones de Acción */}
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                      <button
                        type="button"
                        onClick={() => printProfessionalTicket(order)}
                        style={{
                          padding: '10px 12px',
                          backgroundColor: '#262626',
                          border: '1px solid #404040',
                          color: '#fff',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontWeight: 'bold',
                        }}
                      >
                        🖨️
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMarkAsReady(order.id, order.order_number)}
                        style={{
                          flex: 1,
                          padding: '10px',
                          backgroundColor: '#16a34a',
                          border: 'none',
                          borderRadius: '8px',
                          color: '#fff',
                          fontWeight: '900',
                          fontSize: '14px',
                          cursor: 'pointer',
                        }}
                      >
                        ✅ Marcar Listo / Despachar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* PESTAÑA: ADMINISTRAR CARTA */}
      {activeTab === 'menu' && (
        <div style={{ padding: '24px', maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '24px' }}>
            <div style={{ backgroundColor: '#141414', padding: '20px', borderRadius: '10px', border: '1px solid #262626', height: 'fit-content' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 'bold', color: '#ef4444' }}>
                ➕ Agregar Producto a la Carta
              </h3>
              <form onSubmit={handleCreateProduct} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: '#a3a3a3' }}>Nombre del Producto / Roll</label>
                  <input
                    type="text"
                    placeholder="Ej: Promo 50 Piezas Tempura"
                    value={newProdName}
                    onChange={(e) => setNewProdName(e.target.value)}
                    style={{ width: '100%', padding: '8px', marginTop: '4px', backgroundColor: '#0a0a0a', border: '1px solid #262626', borderRadius: '6px', color: '#fff', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', color: '#a3a3a3' }}>Precio ($)</label>
                  <input
                    type="number"
                    placeholder="Ej: 21990"
                    value={newProdPrice}
                    onChange={(e) => setNewProdPrice(e.target.value)}
                    style={{ width: '100%', padding: '8px', marginTop: '4px', backgroundColor: '#0a0a0a', border: '1px solid #262626', borderRadius: '6px', color: '#fff', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', color: '#a3a3a3' }}>Categoría</label>
                  <input
                    type="text"
                    placeholder="Ej: Rolls, Promociones, Handrolls, Bebidas"
                    value={newProdCategory}
                    onChange={(e) => setNewProdCategory(e.target.value)}
                    style={{ width: '100%', padding: '8px', marginTop: '4px', backgroundColor: '#0a0a0a', border: '1px solid #262626', borderRadius: '6px', color: '#fff', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSavingProduct}
                  style={{
                    width: '100%',
                    padding: '12px',
                    backgroundColor: isSavingProduct ? '#404040' : '#dc2626',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 'bold',
                    cursor: isSavingProduct ? 'not-allowed' : 'pointer',
                    marginTop: '8px',
                  }}
                >
                  {isSavingProduct ? 'Guardando...' : 'Guardar Producto'}
                </button>
              </form>
            </div>

            <div style={{ backgroundColor: '#141414', padding: '20px', borderRadius: '10px', border: '1px solid #262626' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>
                  Productos Actuales ({products.length})
                </h3>
                <button
                  onClick={fetchMenu}
                  style={{ padding: '6px 12px', backgroundColor: '#262626', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '12px', cursor: 'pointer' }}
                >
                  🔄 Refrescar
                </button>
              </div>

              <div style={{ overflowX: 'auto', maxHeight: '500px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #262626', color: '#a3a3a3' }}>
                      <th style={{ padding: '10px 8px' }}>Producto</th>
                      <th style={{ padding: '10px 8px' }}>Categoría</th>
                      <th style={{ padding: '10px 8px' }}>Precio</th>
                      <th style={{ padding: '10px 8px', textAlign: 'center' }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', padding: '30px', color: '#666' }}>
                          No hay productos en la carta.
                        </td>
                      </tr>
                    ) : (
                      products.map((p, idx) => {
                        const name = getProductName(p);
                        const price = getProductPrice(p);
                        const category = getProductCategory(p);
                        return (
                          <tr key={p.id || idx} style={{ borderBottom: '1px solid #1f1f1f' }}>
                            <td style={{ padding: '10px 8px', fontWeight: 'bold' }}>{name}</td>
                            <td style={{ padding: '10px 8px', color: '#a3a3a3' }}>{category}</td>
                            <td style={{ padding: '10px 8px', color: '#ef4444', fontWeight: 'bold' }}>
                              ${price.toLocaleString('es-CL')}
                            </td>
                            <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => handleDeleteProduct(p.id, name)}
                                style={{
                                  padding: '5px 10px',
                                  backgroundColor: '#3b1111',
                                  color: '#f87171',
                                  border: '1px solid #ef4444',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontSize: '12px',
                                  fontWeight: 'bold',
                                }}
                              >
                                🗑️ Eliminar
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑA: HISTORIAL & CIERRE DE CAJA */}
      {activeTab === 'caja' && (
        <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div style={{ backgroundColor: '#141414', padding: '18px', borderRadius: '10px', border: '1px solid #262626' }}>
              <p style={{ margin: 0, fontSize: '12px', color: '#a3a3a3' }}>Ventas Totales</p>
              <h3 style={{ margin: '6px 0 0 0', fontSize: '24px', fontWeight: '900', color: '#22c55e' }}>${grandTotalSales.toLocaleString('es-CL')}</h3>
              <span style={{ fontSize: '11px', color: '#666' }}>{salesHistory.length} órdenes registradas</span>
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
            <div style={{ backgroundColor: '#141414', padding: '20px', borderRadius: '10px', border: '1px solid #262626' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>Historial Completo de Pedidos</h3>
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
                      <th style={{ padding: '10px 8px' }}>Hora</th>
                      <th style={{ padding: '10px 8px' }}>Cliente</th>
                      <th style={{ padding: '10px 8px' }}>Tipo</th>
                      <th style={{ padding: '10px 8px' }}>Total</th>
                      <th style={{ padding: '10px 8px', textAlign: 'center' }}>Detalle</th>
                      <th style={{ padding: '10px 8px', textAlign: 'center' }}>Ticket</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesHistory.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: '#666' }}>
                          No hay ventas registradas aún.
                        </td>
                      </tr>
                    ) : (
                      salesHistory.map((s, idx) => {
                        const timeStr = s.created_at
                          ? new Date(s.created_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
                          : '--:--';
                        return (
                          <tr key={s.id || idx} style={{ borderBottom: '1px solid #1f1f1f' }}>
                            <td style={{ padding: '10px 8px', fontWeight: 'bold', color: '#ef4444' }}>#{s.order_number}</td>
                            <td style={{ padding: '10px 8px', color: '#a3a3a3' }}>{timeStr}</td>
                            <td style={{ padding: '10px 8px' }}>{s.customer_name || 'General'}</td>
                            <td style={{ padding: '10px 8px' }}>
                              <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', backgroundColor: s.order_type === 'DELIVERY' ? '#1e3a8a' : '#14532d' }}>
                                {s.order_type}
                              </span>
                            </td>
                            <td style={{ padding: '10px 8px', fontWeight: 'bold' }}>${Number(s.total_amount || 0).toLocaleString('es-CL')}</td>
                            <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                              <button
                                onClick={() => setSelectedHistoryOrder(s)}
                                style={{ padding: '4px 8px', backgroundColor: '#1f2937', border: '1px solid #374151', color: '#60a5fa', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                              >
                                👁️ Ver
                              </button>
                            </td>
                            <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                              <button
                                onClick={() => printProfessionalTicket(s)}
                                style={{ padding: '4px 8px', backgroundColor: '#262626', border: '1px solid #404040', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
                              >
                                🖨️
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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

      {/* MODAL DETALLE DE PEDIDO HISTÓRICO */}
      {selectedHistoryOrder && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '16px' }}>
          <div style={{ backgroundColor: '#171717', border: '1px solid #333', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '480px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333', paddingBottom: '12px', marginBottom: '14px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: '#ef4444' }}>
                  Orden #{selectedHistoryOrder.order_number}
                </h3>
                <span style={{ fontSize: '12px', color: '#a3a3a3' }}>
                  {new Date(selectedHistoryOrder.created_at).toLocaleString('es-CL')}
                </span>
              </div>
              <span style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '12px', backgroundColor: selectedHistoryOrder.order_type === 'DELIVERY' ? '#1e3a8a' : '#14532d', color: '#fff', fontWeight: 'bold' }}>
                {selectedHistoryOrder.order_type}
              </span>
            </div>

            <div style={{ fontSize: '13px', color: '#d4d4d4', marginBottom: '16px', lineHeight: 1.5 }}>
              <div>👤 <strong>Cliente:</strong> {selectedHistoryOrder.customer_name || 'General'} ({selectedHistoryOrder.customer_phone || 'Sin tel.'})</div>
              {selectedHistoryOrder.delivery_address && <div>📍 <strong>Dirección:</strong> {selectedHistoryOrder.delivery_address}</div>}
              <div>💳 <strong>Medio de Pago:</strong> {selectedHistoryOrder.payment_method}</div>
            </div>

            <div style={{ backgroundColor: '#0a0a0a', padding: '12px', borderRadius: '8px', border: '1px solid #262626', maxHeight: '200px', overflowY: 'auto', marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', color: '#a3a3a3', fontWeight: 'bold', marginBottom: '8px' }}>PRODUCTOS COMPRADOS:</div>
              {(selectedHistoryOrder.items || []).map((it: any, i: number) => (
                <div key={i} style={{ marginBottom: '8px', borderBottom: '1px dashed #262626', paddingBottom: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span><strong>{it.quantity}x</strong> {it.product_name}</span>
                    <span style={{ color: '#ef4444', fontWeight: 'bold' }}>${Number(it.subtotal || 0).toLocaleString('es-CL')}</span>
                  </div>
                  {it.modificaciones && it.modificaciones.length > 0 && (
                    <div style={{ fontSize: '11px', color: '#f87171', paddingLeft: '8px', marginTop: '2px' }}>
                      {it.modificaciones.map((m: any, mIdx: number) => (
                        <div key={mIdx}>⚠️ {m.tipo}: {m.detalle}</div>
                      ))}
                    </div>
                  )}
                  {it.special_notes && <div style={{ fontSize: '11px', color: '#38bdf8', paddingLeft: '8px' }}>↳ {it.special_notes}</div>}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '18px', fontWeight: 'bold', borderTop: '1px solid #333', paddingTop: '12px', marginBottom: '16px' }}>
              <span>Total Orden:</span>
              <span style={{ color: '#22c55e' }}>${Number(selectedHistoryOrder.total_amount).toLocaleString('es-CL')}</span>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => printProfessionalTicket(selectedHistoryOrder)}
                style={{ flex: 1, padding: '10px', backgroundColor: '#262626', color: '#fff', border: '1px solid #404040', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                🖨️ Re-imprimir Ticket
              </button>
              <button
                type="button"
                onClick={() => setSelectedHistoryOrder(null)}
                style={{ flex: 1, padding: '10px', backgroundColor: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
