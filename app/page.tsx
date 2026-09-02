const fetchSales = async () => {
    if (!supabaseUrl || !supabaseAnonKey) return;
    try {
      // Inicio del día actual a las 00:00:00
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .gte('created_at', todayStart.toISOString()) // Solo órdenes de hoy
        .order('created_at', { ascending: false });

      if (!error && data) {
        setSalesHistory(data);
        localStorage.setItem('sakesu_sales_history', JSON.stringify(data));

        // Filtrar pendientes
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
