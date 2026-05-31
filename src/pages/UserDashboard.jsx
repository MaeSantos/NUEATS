import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/userdashboard.css";

import Header from "../components/Header";
import DashboardBody from "../components/DashboardBody";
import Drawer from "@mui/material/Drawer";
import Cart from "../components/Cart";
import Profile from "../components/Profile";
import MyOrders from "../components/MyOrders";
import { apiFetch } from "../api";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { useAuth } from "../auth";

function UserDashboard() {
  const navigate = useNavigate();
  const { logout: authLogout } = useAuth();
  const [category, setCategory] = useState("Meal");
  const [searchQuery, setSearchQuery] = useState("");
  const [openCart, setCartToOpen] = useState(false);
  const [openProfile, setProfileToOpen] = useState(false);
  const [openOrders, setOrdersToOpen] = useState(false);
  const [token, setToken] = useState(() => localStorage.getItem("nu_token") || "");
  const [userProfile, setUserProfile] = useState(() => {
    try {
      const raw = localStorage.getItem("nu_user");
      return raw ? JSON.parse(raw) : { name: "John Doe", studentId: "" };
    } catch {
      return { name: "John Doe", studentId: "" };
    }
  });

  useEffect(() => {
    if (!token) {
      navigate("/login");
      return undefined;
    }

    let mounted = true;
    (async () => {
      try {
        const res = await apiFetch('/api/user', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) {
          localStorage.removeItem("nu_token");
          setToken("");
          navigate("/login");
          return;
        }
        if (!res.ok) {
          console.warn("User profile check failed; keeping cached login.", res.status);
          return;
        }
        const data = await res.json();
        if (data && Object.keys(data).length && mounted) {
          setUserProfile(data);
          try { localStorage.setItem("nu_user", JSON.stringify(data)); } catch { /* localStorage may be unavailable */ }
        }
      } catch (e) {
        console.error(e);
      }
    })();
    return () => { mounted = false };
  }, [token, navigate]);

  async function handleSaveProfile(p) {
    const nextProfile = { ...userProfile, name: p.name };
    setUserProfile(nextProfile);
    try {
      const response = await apiFetch('/api/user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: p.name }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.success === false) {
        throw new Error(data?.error || "Failed saving profile to server");
      }
      const savedProfile = data.profile || nextProfile;
      setUserProfile(savedProfile);
      try { localStorage.setItem("nu_user", JSON.stringify(savedProfile)); } catch { /* ignore */ }
    } catch (e) {
      console.error('failed saving profile to server', e);
      setOrderMessage("Profile was updated locally, but the database could not be reached.");
      try { localStorage.setItem("nu_user", JSON.stringify(nextProfile)); } catch { /* ignore */ }
      return;
    }
  }
  const [cartItems, setCartItems] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentInfo, setPaymentInfo] = useState("");
  const [orderId, setOrderId] = useState(null);
  const [orderStatus, setOrderStatus] = useState("");
  const [orderPaymentStatus, setOrderPaymentStatus] = useState("");
  const [checkoutUrl, setCheckoutUrl] = useState(null);
  const [orderMessage, setOrderMessage] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [ordersRefreshKey, setOrdersRefreshKey] = useState(0);
  const prevStatusRef = useRef(orderStatus);

  function filter(newCategory) {
    setCategory(newCategory);
  }

  const toggleCartDrawer = (value) => {
    setCartToOpen(value);
  };

  const toggleProfileDrawer = (value) => {
    setProfileToOpen(value);
  };

  const toggleOrdersDrawer = (value) => {
    setOrdersToOpen(value);
  };

  const addToCart = (item) => {
    setCartItems((prev) => {
      const stock = Number.isFinite(Number(item.stock)) ? Number(item.stock) : Infinity;
      if (stock <= 0) {
        setOrderMessage(`${item.name} is out of stock.`);
        return prev;
      }
      const existing = prev.find((entry) => entry.key === item.key);
      if (existing) {
        if (existing.quantity >= stock) {
          setOrderMessage(`Only ${stock} ${item.name} left in stock.`);
          return prev;
        }
        return prev.map((entry) =>
          entry.key === item.key
            ? { ...entry, quantity: entry.quantity + 1 }
            : entry
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const updateQuantity = (itemKey, delta) => {
    setCartItems((prev) =>
      prev
        .map((entry) => {
          if (entry.key !== itemKey) {
            return entry;
          }
          const stock = Number.isFinite(Number(entry.stock)) ? Number(entry.stock) : Infinity;
          const nextQuantity = Math.min(stock, Math.max(0, entry.quantity + delta));
          if (delta > 0 && nextQuantity === entry.quantity) {
            setOrderMessage(`Only ${stock} ${entry.name} left in stock.`);
          }
          return { ...entry, quantity: nextQuantity };
        })
        .filter((entry) => entry.quantity > 0)
    );
  };

  const totalPrice = cartItems.reduce(
    (sum, item) => sum + (item.price || 0) * (item.quantity || 0),
    0
  );

  const handleCheckout = async () => {
    if (!cartItems.length) {
      setOrderMessage("Add items to your basket before placing an order.");
      return;
    }

    if (!paymentMethod) {
      setOrderMessage("Please select a payment method before placing an order.");
      return;
    }

    const paymentReference = paymentInfo.replace(/\D+/g, "");
    if (paymentMethod === "gcash" || paymentMethod === "maya") {
      if (!paymentReference) {
        setOrderMessage("Please enter your payment reference number.");
        setCheckoutLoading(false);
        return;
      }
      if (paymentReference.length < 8 || paymentReference.length > 20) {
        setOrderMessage("Reference number must be 8 to 20 digits.");
        setCheckoutLoading(false);
        return;
      }
    }

    if (paymentMethod === "cash" && paymentInfo) {
      setPaymentInfo("");
    }

    if ((paymentMethod === "gcash" || paymentMethod === "maya") && !paymentReference) {
      setOrderMessage("Please enter your payment reference number.");
      setCheckoutLoading(false);
      return;
    }

    setCheckoutLoading(true);
    setOrderMessage("");

    try {
      const response = await apiFetch("/api/order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          items: cartItems,
          paymentMethod,
          paymentInfo: paymentMethod === "cash" ? "" : paymentReference,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        const message = errorBody?.error || errorBody?.message || "Could not place order.";
        throw new Error(message);
      }

      const data = await response.json();
      setOrderId(data.orderId);
      setOrderStatus(data.status);
      setOrderPaymentStatus(data.paymentStatus || "");
      setCheckoutUrl(data.checkoutUrl || null);
      setOrderMessage(`Your order is placed and being prepared. Payment: ${data.paymentMethod}`);
      setOrdersRefreshKey((key) => key + 1);

      setCartItems([]);
      setPaymentInfo("");
      setCartToOpen(true);
    } catch (error) {
      console.error(error);
      const userMessage = error.message || "Unable to place your order. Please try again.";
      setOrderMessage(`Unable to place your order. ${userMessage}`);
    } finally {
      setCheckoutLoading(false);
    }
  };

  useEffect(() => {
    if (!orderId || ["Picked up", "Cancelled"].includes(orderStatus)) {
      return undefined;
    }
    const interval = setInterval(async () => {
      try {
        const response = await apiFetch(`/api/order/${orderId}`);
        if (!response.ok) {
          throw new Error("Could not fetch order status.");
        }

        const data = await response.json();

        // Notify user if status changed to "Ready for pickup"
        if (data.status === "Ready for pickup" && prevStatusRef.current !== "Ready for pickup") {
          if (Capacitor.isNativePlatform()) {
            try {
              await LocalNotifications.schedule({
                notifications: [
                  {
                    title: "Order Ready!",
                    body: `Your Order #${orderId} is now ready for pickup. Enjoy!`,
                    id: Number(orderId),
                    schedule: { at: new Date(Date.now() + 100) },
                  }
                ]
              });
            } catch (err) {
              console.error("Local notification error", err);
            }
          }
        }

        // NEW: Notify user if status changed to "Picked up"
        if (data.status === "Picked up" && prevStatusRef.current !== "Picked up") {
          if (Capacitor.isNativePlatform()) {
            try {
              await LocalNotifications.schedule({
                notifications: [
                  {
                    title: "Order Picked Up!",
                    body: `Thank you for ordering with NUEats! Enjoy your meal.`,
                    id: Number(orderId) + 1000, // Unique ID
                    schedule: { at: new Date(Date.now() + 100) },
                  }
                ]
              });
            } catch (err) {
              console.error("Local notification error", err);
            }
          }
          // After picking up, we can clear the active order tracking after a few seconds
          setTimeout(() => {
            setOrderId(null);
            setOrderStatus("");
          }, 5000);
        }

        if (data.status === "Cancelled" && prevStatusRef.current !== "Cancelled") {
           setTimeout(() => {
            setOrderId(null);
            setOrderStatus("");
          }, 2000);
        }

        setOrderStatus(data.status);
        prevStatusRef.current = data.status;
        setOrderPaymentStatus(data.paymentStatus || "");
      } catch (error) {
        console.error(error);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [orderId, orderStatus]);

  return (
    <div>
      <Header
        onOpenCart={() => toggleCartDrawer(true)}
        onOpenProfile={() => toggleProfileDrawer(true)}
        onOpenOrders={() => toggleOrdersDrawer(true)}
        onSelectFilter={filter}
        category={category}
        userName={userProfile.name}
        searchQuery={searchQuery}
        onSearch={setSearchQuery}
        cartItemCount={cartItems.reduce((sum, item) => sum + (item.quantity || 0), 0)}
      />

      <DashboardBody category={category} searchQuery={searchQuery} onAdd={addToCart} />

      {/* Active Order Summary (Quick View) */}
      {orderId && !["Picked up", "Cancelled"].includes(orderStatus) && (
        <div
          className="ActiveOrderSummary"
          onClick={() => toggleOrdersDrawer(true)}
          style={{
            position: "fixed",
            bottom: "20px",
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "#2C3C94",
            color: "white",
            padding: "10px 20px",
            borderRadius: "30px",
            boxShadow: "0 4px 15px rgba(0,0,0,0.3)",
            zIndex: 1000,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontWeight: "bold",
          }}
        >
          <div
            className="StatusDot"
            style={{
              width: "10px",
              height: "10px",
              backgroundColor: orderStatus === "Ready for pickup" ? "#4CAF50" : "#FFC107",
              borderRadius: "50%",
              animation: orderStatus === "Ready for pickup" ? "none" : "pulse 1.5s infinite",
            }}
          />
          Order #{orderId}: {orderStatus}
        </div>
      )}

      <Drawer anchor="right" open={openCart} onClose={() => toggleCartDrawer(false)}>
        <Cart
          onClose={() => toggleCartDrawer(false)}
          items={cartItems}
          total={totalPrice}
          paymentMethod={paymentMethod}
          paymentInfo={paymentInfo}
          onPaymentChange={setPaymentMethod}
          onPaymentInfoChange={setPaymentInfo}
          onQuantityChange={updateQuantity}
          onCheckout={handleCheckout}
          checkoutDisabled={checkoutLoading}
          orderStatus={orderStatus}
          orderPaymentStatus={orderPaymentStatus}
          checkoutUrl={checkoutUrl}
          orderId={orderId}
          orderMessage={orderMessage}
        />
      </Drawer>

      <Drawer anchor="right" open={openProfile} onClose={() => toggleProfileDrawer(false)}>
        <Profile
          onClose={() => toggleProfileDrawer(false)}
          profile={userProfile}
          token={token}
          refreshKey={ordersRefreshKey}
          onSave={(p) => handleSaveProfile(p)}
          onLogout={() => {
            authLogout();
            navigate("/login");
          }}
        />
      </Drawer>

      <Drawer anchor="right" open={openOrders} onClose={() => toggleOrdersDrawer(false)}>
        <MyOrders
          token={token}
          refreshKey={ordersRefreshKey}
          onClose={() => toggleOrdersDrawer(false)}
        />
      </Drawer>
    </div>
  );
}

export default UserDashboard;
