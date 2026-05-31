import React from "react";
import "../styles/components/receipt.css";

const paymentLabels = {
  gcash: "GCash",
  maya: "Maya",
  cash: "Cash",
};

function formatDate(value) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("en-PH", {
      timeZone: "Asia/Manila",
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

function Receipt({ order, onClose }) {
  if (!order) return null;

  const total = Number(order.total || 0);

  return (
    <div className="ReceiptOverlay">
      <div className="ReceiptContainer">
        <button className="ReceiptCloseButton" onClick={onClose}>✕</button>
        <div className="ReceiptHeader">
          <div className="ReceiptLogo">NUEats</div>
          <h1>OFFICIAL RECEIPT</h1>
          <p className="ReceiptOrderNumber">Order #{order.orderId}</p>
          <p className="ReceiptDate">{formatDate(order.createdAt)}</p>
        </div>

        <div className="ReceiptDivider" />

        <div className="ReceiptBody">
          <div className="ReceiptItemsHeader">
            <span>ITEM</span>
            <span>QTY</span>
            <span>PRICE</span>
          </div>
          <div className="ReceiptItems">
            {(order.items || []).map((item, index) => (
              <div className="ReceiptItemRow" key={index}>
                <span className="ItemName">{item.name}</span>
                <span className="ItemQty">{item.quantity}</span>
                <span className="ItemPrice">₱{(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="ReceiptDivider" />

        <div className="ReceiptFooter">
          <div className="ReceiptTotalRow">
            <span>TOTAL AMOUNT</span>
            <strong>₱{total.toFixed(2)}</strong>
          </div>
          <div className="ReceiptInfo">
            <div className="InfoRow">
              <span>Payment Method:</span>
              <span>{paymentLabels[order.paymentMethod] || order.paymentMethod}</span>
            </div>
            {order.paymentInfo && (
              <div className="InfoRow">
                <span>Ref Number:</span>
                <span>{order.paymentInfo}</span>
              </div>
            )}
            <div className="InfoRow">
              <span>Order Status:</span>
              <span className={`StatusText ${order.status.toLowerCase().replace(/\s+/g, '-')}`}>
                {order.status}
              </span>
            </div>
          </div>
        </div>

        <div className="ReceiptMessage">
          <p>Thank you for ordering with NUEats!</p>
          <p>Please show this receipt to the staff when picking up your order.</p>
        </div>

        <div className="ReceiptBarcode">
            <div className="BarcodeStripes" />
            <p>{order.orderId}-{new Date(order.createdAt).getTime()}</p>
        </div>
      </div>
    </div>
  );
}

export default Receipt;
