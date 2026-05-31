import { useCallback, useEffect, useMemo, useState } from "react";
import "../styles/components/myorders.css";
import { apiFetch, apiUrl } from "../api";
import Receipt from "./Receipt";

const paymentLabels = {
  gcash: "GCash",
  maya: "Maya",
  cash: "Cash",
};

function formatDate(value) {
  if (!value) {
    return "";
  }

  try {
    return new Intl.DateTimeFormat("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function MyOrders({ token, refreshKey = 0, onClose, isNested = false }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedOrder, setSelectedOrder] = useState(null);

  const loadOrders = useCallback(async ({ quiet = false } = {}) => {
    if (!token) {
      setOrders([]);
      setLoading(false);
      return;
    }

    if (!quiet) {
      setLoading(true);
    }
    setError("");

    try {
      const response = await apiFetch("/api/orders", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || "Could not load your orders.");
      }

      const data = await response.json();
      setOrders(Array.isArray(data.orders) ? data.orders : []);
    } catch (loadError) {
      console.error(loadError);
      setError(loadError.message || "Could not load your orders.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    Promise.resolve().then(() => loadOrders());
  }, [loadOrders, refreshKey]);

  useEffect(() => {
    if (!token || typeof EventSource === "undefined") {
      return undefined;
    }

    const stream = new EventSource(`${apiUrl("/api/orders/stream")}?token=${encodeURIComponent(token)}`);

    stream.addEventListener("order-created", () => {
      loadOrders({ quiet: true });
    });

    stream.addEventListener("order-updated", () => {
      loadOrders({ quiet: true });
    });

    return () => stream.close();
  }, [loadOrders, token]);

  const totalSpent = useMemo(
    () => orders.reduce((sum, order) => sum + Number(order.total || 0), 0),
    [orders]
  );

  return (
    <div className={`MyOrdersContainer ${isNested ? "MyOrdersContainer--nested" : ""}`}>
      {!isNested && (
        <div className="MyOrdersHeader">
          <button className="MyOrdersCloseButton" onClick={onClose}>x</button>
          <div>
            <h1>My Orders</h1>
            <p>{orders.length} orders - ₱{totalSpent.toFixed(2)} total</p>
          </div>
        </div>
      )}

      {isNested && (
        <div className="MyOrdersHeader MyOrdersHeader--nested">
           <h2 style={{ fontSize: "16px", margin: 0 }}>Order History</h2>
           <p style={{ fontSize: "12px", margin: 0 }}>{orders.length} total orders</p>
        </div>
      )}

      {loading && <p className="MyOrdersState">Loading your orders...</p>}
      {error && <p className="MyOrdersError">{error}</p>}

      {!loading && !error && orders.length === 0 && (
        <div className="MyOrdersEmpty">
          <h2>No orders yet</h2>
          <p>Your completed checkout orders will appear here.</p>
        </div>
      )}

      {!loading && !error && orders.length > 0 && (
        <div className="MyOrdersList">
          {orders.map((order) => (
            <article
              className="MyOrderCard"
              key={order.orderId}
              onClick={() => setSelectedOrder(order)}
              style={{ cursor: 'pointer' }}
            >
              <div className="MyOrderTopline">
                <div>
                  <h2>Order #{order.orderId}</h2>
                  <p>{formatDate(order.createdAt)}</p>
                </div>
                <strong>₱{Number(order.total || 0).toFixed(2)}</strong>
              </div>

              <div className="MyOrderMeta">
                <span className={`StatusBadge status-${(order.status || "").toLowerCase().replace(/\s+/g, '-')}`}>
                    {order.status || "Queued"}
                </span>
                <span>{paymentLabels[order.paymentMethod] || order.paymentMethod}</span>
                {order.paymentInfo && <span>Ref # {order.paymentInfo}</span>}
              </div>

              <ul className="MyOrderItems">
                {(order.items || []).map((item, index) => (
                  <li key={`${order.orderId}-${item.key || item.name}-${index}`}>
                    <span>{item.name || "Item"}</span>
                    <span>x{item.quantity || 1}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      )}

      {selectedOrder && (
        <Receipt order={selectedOrder} onClose={() => setSelectedOrder(null)} />
      )}
    </div>
  );
}

export default MyOrders;
