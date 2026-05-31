import { useEffect, useMemo, useRef, useState } from 'react';
import '../styles/components/admindashboardbody.css';
import { apiFetch, apiUrl } from '../api';

const orderStatuses = ["Queued", "Preparing", "Ready for pickup", "Picked up", "Cancelled"];
const paymentStatuses = ["Pending payment", "Payment received", "Refunded"];
const emptyMenuForm = {
  key: null,
  name: "",
  description: "",
  price: "",
  stock: "0",
  category: "Meal",
  imageUrl: "",
  isAvailable: true,
};

function peso(value) {
  return `₱${Number(value || 0).toFixed(2)}`;
}

function formatDate(value) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function EarningsChart({ title, rows, periodFormatter }) {
  const chartRows = [...(rows || [])].reverse();
  const maxTotal = Math.max(...chartRows.map((row) => Number(row.total || 0)), 1);
  const chartWidth = 320;
  const chartHeight = 170;
  const paddingX = 24;
  const paddingY = 18;
  const plotWidth = chartWidth - paddingX * 2;
  const plotHeight = chartHeight - paddingY * 2;
  const points = chartRows.map((row, index) => {
    const x = chartRows.length === 1
      ? chartWidth / 2
      : paddingX + (index / (chartRows.length - 1)) * plotWidth;
    const y = paddingY + plotHeight - (Number(row.total || 0) / maxTotal) * plotHeight;
    return { x, y, row };
  });
  const linePath = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const areaPath = points.length
    ? `${linePath} L ${points[points.length - 1].x} ${chartHeight - paddingY} L ${points[0].x} ${chartHeight - paddingY} Z`
    : "";

  return (
    <div className="ChartPanel">
      <h2>{title}</h2>
      {chartRows.length ? (
        <div className="AreaChart">
          <svg className="AreaChartSvg" viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label={title}>
            <defs>
              <linearGradient id={`areaGradient-${title.replace(/\s+/g, "-")}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#2C3C94" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#2C3C94" stopOpacity="0.04" />
              </linearGradient>
            </defs>
            {[0, 1, 2, 3].map((line) => {
              const y = paddingY + (line / 3) * plotHeight;
              return <line className="AreaGridLine" key={line} x1={paddingX} x2={chartWidth - paddingX} y1={y} y2={y} />;
            })}
            <path className="AreaFill" d={areaPath} fill={`url(#areaGradient-${title.replace(/\s+/g, "-")})`} />
            <path className="AreaLine" d={linePath} />
            {points.map((point) => (
              <g key={point.row.period}>
                <circle className="AreaPoint" cx={point.x} cy={point.y} r="4" />
                <text className="AreaValue" x={point.x} y={Math.max(12, point.y - 9)} textAnchor="middle">
                  {peso(point.row.total)}
                </text>
              </g>
            ))}
          </svg>
          <div className="AreaChartLabels">
            {chartRows.map((row) => (
              <span key={row.period}>{periodFormatter(row.period)}</span>
            ))}
          </div>
        </div>
      ) : (
        <p className="MutedText">No earnings yet.</p>
      )}
    </div>
  );
}

function MostOrderedChart({ rows }) {
  const chartRows = (rows || []).slice(0, 6);
  const maxQuantity = Math.max(...chartRows.map((row) => Number(row.quantity || 0)), 1);

  return (
    <div className="ChartPanel">
      <h2>Most Ordered Chart</h2>
      <div className="HorizontalChart">
        {chartRows.length ? chartRows.map((row) => (
          <div className="HorizontalBarRow" key={row.name}>
            <span>{row.name}</span>
            <div className="HorizontalTrack">
              <div
                className="HorizontalFill"
                style={{ width: `${Math.max(6, (Number(row.quantity || 0) / maxQuantity) * 100)}%` }}
              />
            </div>
            <strong>{row.quantity}</strong>
          </div>
        )) : <p className="MutedText">No order data yet.</p>}
      </div>
    </div>
  );
}

function AdminDashboardBody(props) {
  const [orders, setOrders] = useState([]);
  const [menu, setMenu] = useState([]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [newOrderNotice, setNewOrderNotice] = useState("");
  const [menuForm, setMenuForm] = useState(emptyMenuForm);
  const [savingMenu, setSavingMenu] = useState(false);
  const knownOrderIds = useRef(new Set());
  const loadedOnce = useRef(false);

  const headers = useMemo(
    () => ({
      Authorization: `Bearer ${props.adminToken}`,
      "Content-Type": "application/json",
    }),
    [props.adminToken]
  );

  async function loadAdminData({ quiet = false } = {}) {
    if (!props.adminToken) {
      return;
    }

    if (!quiet) {
      setLoading(true);
    }

    try {
      const [ordersRes, menuRes, reportRes] = await Promise.all([
        apiFetch("/api/admin/orders", { headers }),
        apiFetch("/api/admin/menu", { headers }),
        apiFetch("/api/admin/reports", { headers }),
      ]);

      if (!ordersRes.ok || !menuRes.ok || !reportRes.ok) {
        const failed = [];
        if (!ordersRes.ok) failed.push(`orders (${ordersRes.status})`);
        if (!menuRes.ok) failed.push(`menu (${menuRes.status})`);
        if (!reportRes.ok) failed.push(`reports (${reportRes.status})`);
        throw new Error(`Could not load admin dashboard: Failed to fetch ${failed.join(", ")}`);
      }

      const ordersData = await ordersRes.json();
      const menuData = await menuRes.json();
      const reportData = await reportRes.json();
      const nextOrders = ordersData.orders || [];

      if (loadedOnce.current) {
        const freshOrders = nextOrders.filter((order) => !knownOrderIds.current.has(order.orderId));
        if (freshOrders.length) {
          setNewOrderNotice(`${freshOrders.length} new order${freshOrders.length > 1 ? "s" : ""} received.`);
        }
      }

      knownOrderIds.current = new Set(nextOrders.map((order) => order.orderId));
      loadedOnce.current = true;
      setOrders(nextOrders);
      setMenu(menuData.menu || []);
      setReport(reportData.summary || reportData || null);
      setMessage("");
    } catch (error) {
      console.error(error);
      setMessage(error.message || "Unable to load admin data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAdminData();

    if (!props.adminToken || typeof EventSource === "undefined") {
      return undefined;
    }

    const stream = new EventSource(`${apiUrl("/api/admin/orders/stream")}?token=${encodeURIComponent(props.adminToken)}`);

    stream.addEventListener("order-created", () => {
      loadAdminData({ quiet: true });
      setNewOrderNotice("New order received.");
    });

    stream.addEventListener("order-updated", () => {
      loadAdminData({ quiet: true });
    });

    return () => stream.close();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.adminToken]);

  async function updateOrder(orderId, patch) {
    try {
      const response = await apiFetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(patch),
      });

      if (!response.ok) {
        throw new Error("Order update failed.");
      }

      await loadAdminData({ quiet: true });
    } catch (error) {
      console.error(error);
      setMessage(error.message || "Unable to update order.");
    }
  }

  function updateMenuForm(field, value) {
    setMenuForm((current) => ({ ...current, [field]: value }));
  }

  function startEditMenuItem(item) {
    setMenuForm({
      key: item.key,
      name: item.name || "",
      description: item.description || "",
      price: String(item.price ?? ""),
      stock: String(item.stock ?? 0),
      category: item.category || "Meal",
      imageUrl: item.imageUrl || "",
      isAvailable: item.isAvailable !== false,
    });
  }

  function resetMenuForm() {
    setMenuForm(emptyMenuForm);
  }

  async function saveMenuItem(event) {
    event.preventDefault();
    setSavingMenu(true);
    setMessage("");

    const payload = {
      name: menuForm.name,
      description: menuForm.description,
      price: Number(menuForm.price),
      stock: Number(menuForm.stock),
      category: menuForm.category,
      imageUrl: menuForm.imageUrl,
      isAvailable: menuForm.isAvailable,
    };

    try {
      const response = await apiFetch(
        menuForm.key ? `/api/admin/menu/${menuForm.key}` : "/api/admin/menu",
        {
          method: menuForm.key ? "PATCH" : "POST",
          headers,
          body: JSON.stringify(payload),
        }
      );
      const data = await response.json().catch(() => null);

      if (!response.ok || data?.success === false) {
        throw new Error(data?.error || "Menu item save failed.");
      }

      resetMenuForm();
      await loadAdminData({ quiet: true });
      setMessage(menuForm.key ? "Menu item updated." : "Menu item added.");
    } catch (error) {
      console.error(error);
      setMessage(error.message || "Unable to save menu item.");
    } finally {
      setSavingMenu(false);
    }
  }

  function handleMenuImageChange(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setMessage("Please choose an image file.");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      updateMenuForm("imageUrl", String(reader.result || ""));
      setMessage("");
    };
    reader.onerror = () => {
      setMessage("Could not load the selected image.");
    };
    reader.readAsDataURL(file);
  }

  async function deleteMenuItem(item) {
    const confirmed = window.confirm(`Delete ${item.name} from the menu?`);
    if (!confirmed) {
      return;
    }

    try {
      const response = await apiFetch(`/api/admin/menu/${item.key}`, {
        method: "DELETE",
        headers,
      });
      const data = await response.json().catch(() => null);

      if (!response.ok || data?.success === false) {
        throw new Error(data?.error || "Menu item delete failed.");
      }

      if (menuForm.key === item.key) {
        resetMenuForm();
      }
      await loadAdminData({ quiet: true });
      setMessage("Menu item deleted.");
    } catch (error) {
      console.error(error);
      setMessage(error.message || "Unable to delete menu item.");
    }
  }

  const queueOrders = orders.filter((order) => !["Picked up", "Cancelled"].includes(order.status));
  const completedOrders = orders.filter((order) => ["Picked up", "Cancelled"].includes(order.status));
  const mostOrdered = report?.mostOrdered || [];
  const menuByCategory = menu.reduce((groups, item) => {
    const category = item.category || "Other";
    groups[category] = groups[category] || [];
    groups[category].push(item);
    return groups;
  }, {});

  if (loading) {
    return (
      <div id="AdminDashboardBody">
        <div className="AdminContent">
          <p>Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div id="AdminDashboardBody">
      {newOrderNotice && (
        <div className="AdminNotice">
          <span>{newOrderNotice}</span>
          <button type="button" onClick={() => setNewOrderNotice("")}>Dismiss</button>
        </div>
      )}

      {message && <div className="AdminError">{message}</div>}

      <div className="AdminStats">
        <div className="StatCard">
          <p>Today earnings</p>
          <strong>{peso(report?.dailyEarnings)}</strong>
        </div>
        <div className="StatCard">
          <p>This month</p>
          <strong>{peso(report?.monthlyEarnings)}</strong>
        </div>
        <div className="StatCard">
          <p>Active queue</p>
          <strong>{report?.activeQueue || 0}</strong>
        </div>
        <div className="StatCard">
          <p>Pending payments</p>
          <strong>{report?.pendingPayments || 0}</strong>
        </div>
      </div>

      <div className="DashboardCharts">
        <EarningsChart
          title="Daily Earnings Graph"
          rows={report?.daily || []}
          periodFormatter={(period) => new Date(period).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}
        />
        <MostOrderedChart rows={mostOrdered} />
      </div>

      {props.currentTab === "Orders" && (
        <div className="AdminGrid">
          <section className="AdminContent">
            <div className="SectionHeader">
              <div>
                <h1>Order Queue</h1>
                <p>Newest orders appear automatically. Serve them in queue order.</p>
              </div>
              <button type="button" className="RefreshButton" onClick={() => loadAdminData()}>
                Refresh
              </button>
            </div>

            <div className="OrderList">
              {queueOrders.length ? queueOrders.map((order, index) => (
                <article className="OrderCard" key={order.orderId}>
                  <div className="OrderTopline">
                    <div>
                      <p className="QueueNumber">Queue #{index + 1}</p>
                      <h2>Order #{order.orderId}</h2>
                      <p className="MutedText">{formatDate(order.createdAt)} · {order.paymentMethod.toUpperCase()}</p>
                    </div>
                    <strong>{peso(order.total)}</strong>
                  </div>

                  <div className="OrderItems">
                    {order.items.map((item) => (
                      <p key={`${order.orderId}-${item.key}`}>
                        <span>{item.quantity}x {item.name}</span>
                        <span>{peso((item.price || 0) * (item.quantity || 0))}</span>
                      </p>
                    ))}
                  </div>

                  {order.paymentInfo && (
                    <p className="PaymentReference">
                      <span>Ref #</span>
                      <strong>{order.paymentInfo}</strong>
                    </p>
                  )}

                  <div className="OrderControls">
                    <label>
                      Payment
                      <select
                        value={order.paymentStatus}
                        onChange={(event) => updateOrder(order.orderId, { paymentStatus: event.target.value })}
                      >
                        {paymentStatuses.map((status) => <option key={status}>{status}</option>)}
                      </select>
                    </label>

                    <label>
                      Status
                      <select
                        value={order.status}
                        onChange={(event) => updateOrder(order.orderId, { status: event.target.value })}
                      >
                        {orderStatuses.map((status) => <option key={status}>{status}</option>)}
                      </select>
                    </label>
                  </div>
                </article>
              )) : <p className="EmptyAdminState">No active orders in the queue.</p>}
            </div>
          </section>

          <aside className="AdminContent SidePanel">
            <h1>Completed</h1>
            {completedOrders.length ? completedOrders.slice(-8).reverse().map((order) => (
              <div className="CompactOrder" key={order.orderId}>
                <div>
                  <span>#{order.orderId}</span>
                  <p>{order.status} · {order.paymentStatus}</p>
                  {order.paymentInfo && <p>Ref # {order.paymentInfo}</p>}
                </div>
                <strong>{peso(order.total)}</strong>
                {order.paymentStatus === "Pending payment" && (
                  <button
                    type="button"
                    className="CompactActionButton"
                    onClick={() => updateOrder(order.orderId, { paymentStatus: "Payment received" })}
                  >
                    Mark paid
                  </button>
                )}
              </div>
            )) : <p className="MutedText">No completed orders yet.</p>}
          </aside>
        </div>
      )}

      {props.currentTab === "Menu" && (
        <section className="AdminContent MenuWindow">
          <div className="SectionHeader">
            <div>
              <p className="WindowEyebrow">Menu Window</p>
              <h1>Menu Management</h1>
              <p>Add, edit, hide, or remove food items shown to students.</p>
            </div>
            <div className="MenuCountBadge">{menu.length} items</div>
          </div>

          <form className="MenuEditor" onSubmit={saveMenuItem}>
            <div className="MenuEditorHeader">
              <h2>{menuForm.key ? `Edit item #${menuForm.key}` : "Add menu item"}</h2>
              {menuForm.key && (
                <button type="button" className="TextActionButton" onClick={resetMenuForm}>
                  Cancel edit
                </button>
              )}
            </div>
            <div className="MenuEditorGrid">
              <label>
                Name
                <input
                  value={menuForm.name}
                  onChange={(event) => updateMenuForm("name", event.target.value)}
                  placeholder="Food name"
                  required
                />
              </label>
              <label>
                Price
                <input
                  value={menuForm.price}
                  onChange={(event) => updateMenuForm("price", event.target.value)}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  required
                />
              </label>
              <label>
                Stock
                <input
                  value={menuForm.stock}
                  onChange={(event) => updateMenuForm("stock", event.target.value)}
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0"
                  required
                />
              </label>
              <label>
                Category
                <select
                  value={menuForm.category}
                  onChange={(event) => updateMenuForm("category", event.target.value)}
                >
                  <option>Meal</option>
                  <option>Snack</option>
                  <option>Drink</option>
                </select>
              </label>
              <label>
                Image
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleMenuImageChange}
                />
              </label>
              <label className="MenuAvailability">
                <input
                  type="checkbox"
                  checked={menuForm.isAvailable}
                  onChange={(event) => updateMenuForm("isAvailable", event.target.checked)}
                />
                Available to students
              </label>
            </div>
            <label className="MenuDescriptionField">
              Description
              <textarea
                value={menuForm.description}
                onChange={(event) => updateMenuForm("description", event.target.value)}
                placeholder="Short menu description"
                rows={3}
              />
            </label>
            {menuForm.imageUrl && (
              <div className="MenuImagePreview">
                <img src={menuForm.imageUrl} alt={`${menuForm.name || "Menu item"} preview`} />
                <button type="button" className="TextActionButton" onClick={() => updateMenuForm("imageUrl", "")}>
                  Remove image
                </button>
              </div>
            )}
            <button type="submit" className="RefreshButton" disabled={savingMenu}>
              {savingMenu ? "Saving..." : menuForm.key ? "Save Changes" : "Add Item"}
            </button>
          </form>

          <div className="MenuCategoryGrid">
            {Object.entries(menuByCategory).map(([category, items]) => (
              <div className="MenuCategoryPanel" key={category}>
                <div className="MenuCategoryHeader">
                  <h2>{category}</h2>
                  <span>{items.length}</span>
                </div>
                <div className="MenuCardList">
                  {items.map((item) => (
                    <article className="MenuItemCard" key={item.key}>
                      {item.imageUrl && <img className="MenuItemImage" src={item.imageUrl} alt={item.name} />}
                      <div>
                        <h3>{item.name}</h3>
                        <p>{item.description}</p>
                        <span className={item.isAvailable ? "MenuStatusBadge" : "MenuStatusBadge Hidden"}>
                          {item.isAvailable ? "Available" : "Hidden"}
                        </span>
                        <span className={Number(item.stock || 0) > 0 ? "StockBadge" : "StockBadge Empty"}>
                          {Number(item.stock || 0)} in stock
                        </span>
                      </div>
                      <div className="MenuItemActions">
                        <strong>{peso(item.price)}</strong>
                        <button type="button" onClick={() => startEditMenuItem(item)}>Edit</button>
                        <button type="button" className="DangerButton" onClick={() => deleteMenuItem(item)}>Delete</button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {props.currentTab === "Reports" && (
        <div className="AdminGrid">
          <section className="AdminContent">
            <h1>Most Ordered Food</h1>
            <div className="RankingList">
              {mostOrdered.length ? mostOrdered.map((item, index) => (
                <div className="RankingRow" key={item.name}>
                  <span>{index + 1}</span>
                  <div>
                    <strong>{item.name}</strong>
                    <p>{item.quantity} sold · {peso(item.sales)}</p>
                  </div>
                </div>
              )) : <p className="MutedText">No order data yet.</p>}
            </div>
          </section>

          <section className="AdminContent">
            <h1>Earnings Report</h1>
            <div className="ChartStack">
              <EarningsChart
                title="Daily Earnings"
                rows={report?.daily || []}
                periodFormatter={(period) => new Date(period).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}
              />
              <EarningsChart
                title="Monthly Earnings"
                rows={report?.monthly || []}
                periodFormatter={(period) => new Date(period).toLocaleDateString("en-PH", { month: "short" })}
              />
            </div>
            <div className="ReportColumns">
              <div>
                <h2>Daily</h2>
                {(report?.daily || []).map((row) => (
                  <p className="ReportRow" key={row.period}>
                    <span>{row.period}</span>
                    <strong>{peso(row.total)}</strong>
                  </p>
                ))}
              </div>
              <div>
                <h2>Monthly</h2>
                {(report?.monthly || []).map((row) => (
                  <p className="ReportRow" key={row.period}>
                    <span>{row.period.slice(0, 7)}</span>
                    <strong>{peso(row.total)}</strong>
                  </p>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default AdminDashboardBody;
