import { useEffect, useMemo, useRef, useState } from 'react';
import '../styles/components/admindashboardbody.css';
import { apiFetch, apiUrl } from '../api';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, IconButton, CircularProgress } from '@mui/material';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import PrintIcon from '@mui/icons-material/Print';
import CloseIcon from '@mui/icons-material/Close';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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
    timeZone: "Asia/Manila",
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
  const [isEditing, setIsEditing] = useState(false);
  const [showReportPreview, setShowReportPreview] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const knownOrderIds = useRef(new Set());
  const loadedOnce = useRef(false);
  const reportRef = useRef(null);

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

    stream.addEventListener("order-created", async () => {
      loadAdminData({ quiet: true });
      setNewOrderNotice("New order received.");

      // Proper native/vibrating notification for admin
      if (Capacitor.isNativePlatform()) {
        try {
          await LocalNotifications.schedule({
            notifications: [
              {
                title: "New Order Received! 🛒",
                body: "A student just placed a new order. Check the queue!",
                id: Math.floor(Math.random() * 1000000),
                sound: 'order_received.wav', // optional
                schedule: { at: new Date(Date.now() + 100) },
              }
            ]
          });
        } catch (err) {
          console.error("Local notification error", err);
        }
      } else if (Notification.permission === "granted") {
        new Notification("New Order Received! ", {
          body: "A student just placed a new order. Check the queue!",
          icon: "/favicon.svg"
        });
      } else {
        alert("New Order Received! A student just placed a new order.");
      }
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
    setIsEditing(true);
  }

  function resetMenuForm() {
    setMenuForm(emptyMenuForm);
    setIsEditing(false);
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

  function handlePrintReport() {
    setShowReportPreview(true);
  }

  function printCurrentWindow() {
    try {
      if (typeof window !== 'undefined' && window.print) {
        setTimeout(() => {
          window.print();
        }, 100);
      } else {
        alert("Printing is not supported on this device/browser.");
      }
    } catch (e) {
      console.error("Print error:", e);
      alert("Failed to open print dialog. Please try again.");
    }
  }

  async function handleDownloadPDF() {
    if (!reportRef.current) return;

    setIsGeneratingPDF(true);
    try {
      const element = reportRef.current;
      const canvas = await html2canvas(element, {
        scale: 1.5, // Reduced scale to prevent memory issues on mobile
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.85); // JPEG is smaller than PNG
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);

      const fileName = `NUEats-Report-${new Date().toISOString().slice(0, 10)}.pdf`;

      if (Capacitor.isNativePlatform()) {
        const blob = pdf.output('blob');
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      } else {
        pdf.save(fileName);
      }
    } catch (error) {
      console.error("PDF Generation failed:", error);
      alert("Failed to generate PDF. Please try again.");
    } finally {
      setIsGeneratingPDF(false);
    }
  }

  function handleActualPrint() {
    const reportHtml = reportRef.current?.innerHTML;
    if (!reportHtml) {
      window.print();
      return;
    }

    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) {
      alert("Please allow popups to print.");
      return;
    }

    printWindow.document.open();
    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>NUEats Report</title>
          <style>
            body { font-family: sans-serif; padding: 20px; }
            .no-print { display: none !important; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #eee; padding: 10px; text-align: left; }
            .peso { color: #2C3C94; font-weight: bold; }
            h1, h2, h3 { color: #2C3C94; }
          </style>
        </head>
        <body>
          ${reportHtml}
          <script>
            window.onload = () => {
              window.print();
              setTimeout(() => window.close(), 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

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
          <p>This month earnings</p>
          <strong>{peso(report?.monthlyEarnings)}</strong>
        </div>
        <div className="StatCard">
          <p>This year</p>
          <strong>{peso(report?.yearlyEarnings)}</strong>
        </div>
        <div className="StatCard">
          <p>Active queue</p>
          <strong>{report?.activeQueue || 0}</strong>
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
                      <p style={{ fontWeight: '800', color: '#2C3C94', margin: '4px 0' }}>Customer: {order.studentName}</p>
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
              <p>Add new food items shown to students.</p>
            </div>
            <div className="MenuCountBadge">{menu.length} items</div>
          </div>

          <form className="MenuEditor" onSubmit={saveMenuItem}>
            <div className="MenuEditorHeader">
              <h2>Add menu item</h2>
            </div>
            <div className="MenuEditorGrid">
              <label>
                Name
                <input
                  value={isEditing ? "" : menuForm.name}
                  onChange={(event) => updateMenuForm("name", event.target.value)}
                  placeholder="Food name"
                  required
                />
              </label>
              <label>
                Price
                <input
                  value={isEditing ? "" : menuForm.price}
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
                  value={isEditing ? "" : menuForm.stock}
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
                  value={isEditing ? "Meal" : menuForm.category}
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
                  checked={isEditing ? true : menuForm.isAvailable}
                  onChange={(event) => updateMenuForm("isAvailable", event.target.checked)}
                />
                Available to students
              </label>
            </div>
            <label className="MenuDescriptionField">
              Description
              <textarea
                value={isEditing ? "" : menuForm.description}
                onChange={(event) => updateMenuForm("description", event.target.value)}
                placeholder="Short menu description"
                rows={3}
              />
            </label>
            {(!isEditing && menuForm.imageUrl) && (
              <div className="MenuImagePreview">
                <img src={menuForm.imageUrl} alt={`${menuForm.name || "Menu item"} preview`} />
                <button type="button" className="TextActionButton" onClick={() => updateMenuForm("imageUrl", "")}>
                  Remove image
                </button>
              </div>
            )}
            <button type="submit" className="RefreshButton" disabled={savingMenu || isEditing}>
              {savingMenu ? "Saving..." : "Add Item"}
            </button>
          </form>

          <Dialog open={isEditing} onClose={resetMenuForm} maxWidth="md" fullWidth>
            <DialogTitle>Edit Item: {menuForm.name}</DialogTitle>
            <DialogContent>
              <form className="MenuEditor" onSubmit={saveMenuItem} style={{ boxShadow: 'none', padding: 0 }}>
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
              </form>
            </DialogContent>
            <DialogActions style={{ padding: '15px 24px' }}>
              <Button onClick={resetMenuForm} color="inherit">Cancel</Button>
              <Button
                variant="contained"
                onClick={saveMenuItem}
                disabled={savingMenu}
                style={{ backgroundColor: '#2C3C94' }}
              >
                {savingMenu ? "Saving..." : "Save Changes"}
              </Button>
            </DialogActions>
          </Dialog>

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
            <div style={{
              display: 'flex',
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <h1 style={{ margin: 0 }}>Most Ordered Food</h1>
              <button
                type="button"
                className="RefreshButton"
                onClick={handlePrintReport}
                style={{
                  backgroundColor: '#2C3C94',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '13px',
                  padding: '0 16px',
                  minHeight: '38px',
                  boxShadow: '0 2px 6px rgba(44, 60, 148, 0.2)'
                }}
              >
                <PictureAsPdfIcon fontSize="small" />
                Print PDF
              </button>
            </div>
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
              <EarningsChart
                title="Yearly Earnings"
                rows={report?.yearly || []}
                periodFormatter={(period) => new Date(period).toLocaleDateString("en-PH", { year: "numeric" })}
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
              <div>
                <h2>Yearly</h2>
                {(report?.yearly || []).map((row) => (
                  <p className="ReportRow" key={row.period}>
                    <span>{row.period.slice(0, 4)}</span>
                    <strong>{peso(row.total)}</strong>
                  </p>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}

      <Dialog
        open={showReportPreview}
        onClose={() => setShowReportPreview(false)}
        maxWidth="lg"
        fullWidth
        scroll="body"
        PaperProps={{
          style: { borderRadius: '12px', overflow: 'hidden' }
        }}
      >
        <DialogTitle className="no-print" style={{
          backgroundColor: '#FBFAFF',
          borderBottom: '1px solid #E7E4F0',
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
            <PictureAsPdfIcon style={{ color: '#2C3C94', flexShrink: 0 }} />
            <span style={{
              fontWeight: 850,
              color: '#2C3C94',
              fontSize: 'clamp(14px, 3.5vw, 18px)',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
              overflow: 'hidden'
            }}>
              Report Preview
            </span>
          </div>
          <IconButton
            type="button"
            onClick={() => setShowReportPreview(false)}
            size="small"
            aria-label="Close report preview"
            style={{ backgroundColor: 'rgba(0,0,0,0.04)', color: '#667085' }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent style={{ backgroundColor: '#f5f5f5', padding: '15px 0' }}>
          <style dangerouslySetInnerHTML={{ __html: `
            @media print {
              body * { visibility: hidden; }
              .PrintableReport, .PrintableReport * { visibility: visible; }
              .PrintableReport {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                margin: 0 !important;
                padding: 15mm !important;
                box-shadow: none !important;
                border: none !important;
              }
              .no-print { display: none !important; }
              @page { margin: 0; }
            }
          ` }} />
          <div ref={reportRef} className="PrintableReport" style={{
            padding: '5% 7%',
            color: '#333',
            backgroundColor: 'white',
            width: 'min(210mm, 95%)',
            minHeight: '297mm',
            margin: '0 auto',
            boxShadow: '0 0 20px rgba(0,0,0,0.1)',
            boxSizing: 'border-box',
            position: 'relative',
            fontSize: '14px'
          }}>
            {/* Watermark for preview */}
            <div className="no-print" style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%) rotate(-45deg)',
              fontSize: 'min(8vw, 100px)',
              color: 'rgba(0,0,0,0.03)',
              fontWeight: 900,
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
              zIndex: 0
            }}>
              NUEATS OFFICIAL
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '4px solid #2C3C94', paddingBottom: '20px', position: 'relative', zIndex: 1, gap: '10px' }}>
              <div>
                <h1 style={{ color: '#2C3C94', fontSize: 'min(6vw, 32px)', margin: 0, fontWeight: 900, letterSpacing: '-1px' }}>NUEats</h1>
                <p style={{ margin: '5px 0 0', color: '#666', fontSize: 'min(3vw, 14px)', fontWeight: 600 }}>Campus Dining Solutions</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <h2 style={{ margin: 0, fontSize: 'min(4vw, 18px)', color: '#333' }}>SALES & ANALYTICS</h2>
                <p style={{ margin: '5px 0 0', color: '#888', fontSize: 'min(2.5vw, 12px)' }}>
                  Generated: {new Intl.DateTimeFormat('en-PH', {
                    timeZone: 'Asia/Manila',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit'
                  }).format(new Date())}
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '15px', marginTop: '30px', position: 'relative', zIndex: 1 }}>
              <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '4px', borderLeft: '5px solid #2C3C94' }}>
                <p style={{ margin: 0, fontSize: '11px', color: '#888', textTransform: 'uppercase', fontWeight: 800 }}>Daily Revenue</p>
                <strong style={{ fontSize: '1.2em', color: '#2C3C94' }}>{peso(report?.dailyEarnings)}</strong>
              </div>
              <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '4px', borderLeft: '5px solid #FFD41C' }}>
                <p style={{ margin: 0, fontSize: '11px', color: '#888', textTransform: 'uppercase', fontWeight: 800 }}>Monthly Revenue</p>
                <strong style={{ fontSize: '1.2em', color: '#333' }}>{peso(report?.monthlyEarnings)}</strong>
              </div>
              <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '4px', borderLeft: '5px solid #4CAF50' }}>
                <p style={{ margin: 0, fontSize: '11px', color: '#888', textTransform: 'uppercase', fontWeight: 800 }}>Annual Revenue</p>
                <strong style={{ fontSize: '1.2em', color: '#333' }}>{peso(report?.yearlyEarnings)}</strong>
              </div>
            </div>

            <div style={{ marginTop: '40px', position: 'relative', zIndex: 1 }}>
              <h3 style={{ fontSize: '16px', borderBottom: '1px solid #eee', paddingBottom: '10px', color: '#2C3C94', fontWeight: 800 }}>TOP PERFORMING PRODUCTS</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
                  <thead>
                    <tr style={{ textAlign: 'left' }}>
                      <th style={{ padding: '12px 8px', borderBottom: '2px solid #333', fontSize: '11px', color: '#666' }}>RANK</th>
                      <th style={{ padding: '12px 8px', borderBottom: '2px solid #333', fontSize: '11px', color: '#666' }}>ITEM NAME</th>
                      <th style={{ padding: '12px 8px', borderBottom: '2px solid #333', fontSize: '11px', color: '#666', textAlign: 'center' }}>UNITS SOLD</th>
                      <th style={{ padding: '12px 8px', borderBottom: '2px solid #333', fontSize: '11px', color: '#666', textAlign: 'right' }}>GROSS SALES</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mostOrdered.map((item, index) => (
                      <tr key={item.name}>
                        <td style={{ padding: '12px 8px', borderBottom: '1px solid #eee', fontSize: '14px', fontWeight: 700, color: '#888' }}>{index + 1}</td>
                        <td style={{ padding: '12px 8px', borderBottom: '1px solid #eee', fontSize: '14px', fontWeight: 600 }}>{item.name}</td>
                        <td style={{ padding: '12px 8px', borderBottom: '1px solid #eee', fontSize: '14px', textAlign: 'center' }}>{item.quantity}</td>
                        <td style={{ padding: '12px 8px', borderBottom: '1px solid #eee', fontSize: '14px', textAlign: 'right', fontWeight: 700 }}>{peso(item.sales)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '30px', marginTop: '40px', position: 'relative', zIndex: 1 }}>
              <div>
                <h3 style={{ fontSize: '14px', borderBottom: '1px solid #eee', paddingBottom: '10px', color: '#2C3C94', fontWeight: 800 }}>DAILY BREAKDOWN</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    {(report?.daily || []).slice(0, 7).map(row => (
                      <tr key={row.period}>
                        <td style={{ padding: '8px 0', borderBottom: '1px solid #f9f9f9', fontSize: '12px' }}>{row.period}</td>
                        <td style={{ padding: '8px 0', borderBottom: '1px solid #f9f9f9', fontSize: '12px', textAlign: 'right', fontWeight: 600 }}>{peso(row.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <h3 style={{ fontSize: '14px', borderBottom: '1px solid #eee', paddingBottom: '10px', color: '#2C3C94', fontWeight: 800 }}>MONTHLY SUMMARY</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    {(report?.monthly || []).map(row => (
                      <tr key={row.period}>
                        <td style={{ padding: '8px 0', borderBottom: '1px solid #f9f9f9', fontSize: '12px' }}>{row.period.slice(0, 7)}</td>
                        <td style={{ padding: '8px 0', borderBottom: '1px solid #f9f9f9', fontSize: '12px', textAlign: 'right', fontWeight: 600 }}>{peso(row.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{
              marginTop: '60px',
              paddingTop: '20px',
              borderTop: '1px solid #eee',
              textAlign: 'center',
              fontSize: '10px',
              color: '#aaa',
              position: 'relative',
              zIndex: 1
            }}>
              <p style={{ margin: '0 0 5px', fontWeight: 700 }}>CONFIDENTIAL INTERNAL DOCUMENT</p>
              <p>© {new Date().getFullYear()} NUEats POS System · All Rights Reserved</p>
            </div>
          </div>
        </DialogContent>
        <DialogActions className="no-print" style={{
          padding: '12px 16px',
          borderTop: '1px solid #E7E4F0',
          backgroundColor: '#FBFAFF',
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'center', // Center on mobile
          gap: '8px',
          flexWrap: 'wrap'
        }}>
          <Button
            type="button"
            onClick={() => setShowReportPreview(false)}
            variant="outlined"
            style={{
              color: '#667085',
              borderColor: '#D6D2DF',
              textTransform: 'none',
              fontWeight: 800,
              borderRadius: '8px',
              padding: '6px 12px',
              fontSize: '12px',
              flex: '1 1 100px',
              maxWidth: '150px'
            }}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleDownloadPDF}
            variant="contained"
            disabled={isGeneratingPDF}
            startIcon={isGeneratingPDF ? <CircularProgress size={16} color="inherit" /> : <PrintIcon style={{ fontSize: 18 }} />}
            style={{
              backgroundColor: '#2C3C94',
              textTransform: 'none',
              fontWeight: 800,
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: '12px',
              flex: '1 1 140px',
              maxWidth: '220px',
              boxShadow: '0 2px 8px rgba(44, 60, 148, 0.2)'
            }}
          >
            {isGeneratingPDF ? 'Generating...' : 'Save as PDF'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

export default AdminDashboardBody;
