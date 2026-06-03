import { useState } from "react";
import "../styles/components/cart.css"
import CartItem from "./CartItem"
import gcashIcon from "../assets/icons/gcash.svg"
import mayaIcon from "../assets/icons/maya.svg"
import cashIcon from "../assets/icons/cash.svg"
import { Capacitor } from "@capacitor/core";

const paymentApps = {
    gcash: {
        label: "GCash",
        number: "09612453929",
        scheme: "gcash://",
        packageName: "com.globe.gcash.android",
        fallback: "https://www.gcash.com/",
    },
    maya: {
        label: "Maya",
        number: "09171234567",
        scheme: "paymaya://",
        packageName: "com.paymaya",
        fallback: "https://www.maya.ph/",
    },
};

function Cart(props) {
    const [copied, setCopied] = useState(false);
    const hasItems = props.items && props.items.length > 0;
    const totalQuantity = (props.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const prepStartMinutes = hasItems ? Math.min(35, 6 + totalQuantity * 2) : 0;
    const prepEndMinutes = hasItems ? prepStartMinutes + 5 : 0;
    const referenceDigits = String(props.paymentInfo || "").replace(/\D+/g, "");
    const referenceInvalid = (props.paymentMethod === "gcash" || props.paymentMethod === "maya")
        && referenceDigits.length > 0
        && (referenceDigits.length < 8 || referenceDigits.length > 20);

    const paymentIcon = () => {
        switch (props.paymentMethod) {
            case "gcash":
                return gcashIcon;
            case "maya":
                return mayaIcon;
            case "cash":
                return cashIcon;
            default:
                return null;
        }
    };

    const openPaymentApp = (method) => {
        const app = paymentApps[method];
        if (!app || typeof window === "undefined") {
            return;
        }

        const isNative = Capacitor.isNativePlatform();

        if (isNative) {
            // Robust Android app opening
            window.location.assign(app.scheme);

            // Fallback
            setTimeout(() => {
                if (document.hasFocus()) {
                    window.open(app.fallback, '_blank');
                }
            }, 1500);
        } else {
            window.open(app.fallback, '_blank');
        }
    };

    return (
        <div className="CartContainer">
            <div className="CartHeader">
                <button className="CloseButton" onClick={() => props.onClose(false)}>✕</button>
                <div className="Basket">
                    <h1 id="basket-title">Basket</h1>
                </div>
            </div>
            <div className="CartStatus">
                {props.orderId ? (
                    <>
                        <p className="OrderStatus">Order #{props.orderId}: {props.orderStatus}</p>
                        <p className="OrderHelp">Your food will be ready for pickup soon.</p>
                        {props.orderPaymentStatus && (
                            <p className="OrderHelp">Payment: {props.orderPaymentStatus}</p>
                        )}
                        {props.paymentMethod && (
                            <div className="PaymentConfirmation">
                                <img
                                    src={paymentIcon()}
                                    alt={`${props.paymentMethod} payment`}
                                    className="PaymentConfirmationIcon"
                                />
                                <div>
                                    <p className="PaymentConfirmationLabel">Payment method:</p>
                                    <p className="PaymentConfirmationMethod">{props.paymentMethod.toUpperCase()}</p>
                                    {props.paymentInfo && (
                                        <>
                                            <p className="PaymentConfirmationReference">{props.paymentInfo}</p>
                                            <div className="PaymentActions">
                                                <button
                                                    className="PaymentActionButton"
                                                    onClick={async () => {
                                                        try {
                                                            await navigator.clipboard.writeText(props.paymentInfo);
                                                            setCopied(true);
                                                            setTimeout(() => setCopied(false), 1800);
                                                        } catch (e) {
                                                            console.error('copy failed', e);
                                                        }
                                                    }}
                                                >
                                                    {copied ? 'Copied' : 'Copy'}
                                                </button>
                                                {props.checkoutUrl ? (
                                                    <button
                                                        type="button"
                                                        className="PaymentActionSecondary"
                                                        style={{ backgroundColor: "#2C3C94", color: "white" }}
                                                        onClick={() => window.open(props.checkoutUrl, '_blank')}
                                                    >
                                                        Pay Now
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        className="PaymentActionSecondary"
                                                        onClick={() => openPaymentApp(props.paymentMethod)}
                                                    >
                                                        Open {paymentApps[props.paymentMethod]?.label || props.paymentMethod.toUpperCase()} app
                                                    </button>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <p className="OrderHelp">Add items to your basket and place your order.</p>
                )}
            </div>
            <div className="PaymentMethodSection">
                <p className="PaymentLabel">Payment method</p>
                <div className="PaymentOptions">
                    <label className="PaymentOption">
                        <input
                            type="radio"
                            name="paymentMethod"
                            value="gcash"
                            checked={props.paymentMethod === "gcash"}
                            onChange={() => props.onPaymentChange("gcash")}
                        />
                        <img src={gcashIcon} alt="" className="PaymentOptionIcon" />
                        <span>GCash</span>
                    </label>
                    <label className="PaymentOption">
                        <input
                            type="radio"
                            name="paymentMethod"
                            value="maya"
                            checked={props.paymentMethod === "maya"}
                            onChange={() => props.onPaymentChange("maya")}
                        />
                        <img src={mayaIcon} alt="" className="PaymentOptionIcon" />
                        <span>Maya</span>
                    </label>
                    <label className="PaymentOption">
                        <input
                            type="radio"
                            name="paymentMethod"
                            value="cash"
                            checked={props.paymentMethod === "cash"}
                            onChange={() => props.onPaymentChange("cash")}
                        />
                        <img src={cashIcon} alt="" className="PaymentOptionIcon" />
                        <span>Cash</span>
                    </label>
                </div>
                {(props.paymentMethod === "gcash" || props.paymentMethod === "maya") && (
                    <div className="PaymentInfoBlock" style={{ backgroundColor: '#f0f2ff', padding: '15px', borderRadius: '12px', border: '1px solid #2C3C94' }}>
                        <div className="PaymentInstructionSection" style={{ textAlign: 'center', marginBottom: '12px' }}>
                            <p style={{ fontSize: '12px', color: '#2C3C94', fontWeight: '800', marginBottom: '8px', textTransform: 'uppercase' }}>
                                Send Payment to {props.paymentMethod.toUpperCase()}
                            </p>
                            <div style={{ backgroundColor: '#fff', padding: '12px', borderRadius: '8px', border: '1px solid #d0d5ff', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                                <p style={{ fontSize: '20px', fontWeight: '900', color: '#1a237e', margin: '0', letterSpacing: '1px' }}>
                                    {paymentApps[props.paymentMethod].number}
                                </p>
                                <p style={{ fontSize: '11px', color: '#666', marginTop: '4px', fontWeight: '600' }}>
                                    Account: NUEATS ADMIN
                                </p>
                            </div>

                            <button
                                type="button"
                                className="OpenAppButton"
                                style={{
                                    display: 'block',
                                    width: '100%',
                                    marginTop: '12px',
                                    padding: '10px',
                                    backgroundColor: '#2C3C94',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontSize: '13px',
                                    fontWeight: 'bold',
                                    cursor: 'pointer'
                                }}
                                onClick={() => openPaymentApp(props.paymentMethod)}
                            >
                                OPEN {props.paymentMethod.toUpperCase()} APP
                            </button>
                        </div>

                        <p className="PaymentHelp" style={{ fontSize: '11px', fontWeight: '800', color: '#333', marginBottom: '5px' }}>
                            PAYMENT REFERENCE NO.
                        </p>
                        <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            className="PaymentInfoInput"
                            placeholder="8 to 20 digits"
                            style={{ border: '1.5px solid #2C3C94', height: '40px', fontSize: '14px' }}
                            value={referenceDigits}
                            onChange={(event) => props.onPaymentInfoChange(event.target.value.replace(/\D+/g, ""))}
                        />
                        <p className={referenceInvalid ? "PaymentValidation PaymentValidation--error" : "PaymentValidation"}>
                            {referenceInvalid
                                ? "Reference number must be 8 to 20 digits."
                                : "Use the reference number from your GCash/Maya receipt."
                            }
                        </p>
                    </div>
                )}
            </div>
            <hr />
            <div className="CartBody">
                {hasItems ? (
                    props.items.map((item) => (
                        <CartItem
                            key={item.key}
                            itemKey={item.key}
                            name={item.name}
                            price={item.price}
                            quantity={item.quantity}
                            onIncrement={props.onQuantityChange}
                            onDecrement={props.onQuantityChange}
                        />
                    ))
                ) : (
                    <p className="EmptyCartMessage">Your basket is empty.</p>
                )}
            </div>
            <hr />
            <div className="CartFooter">
                {hasItems && (
                    <div className="PrepEstimate">
                        <div>
                            <p className="PrepEstimateLabel">Estimated preparation</p>
                            <p className="PrepEstimateHelp">Staff will update your order status when it is ready.</p>
                        </div>
                        <strong>{prepStartMinutes}-{prepEndMinutes} min</strong>
                    </div>
                )}
                <div className="Price">
                    <p id="price-label">Total: ₱{props.total.toFixed(2)}</p>
                </div>
                <button
                    className="CheckoutButton"
                    onClick={props.onCheckout}
                    disabled={!hasItems || props.checkoutDisabled || !props.paymentMethod}
                >
                    {props.checkoutDisabled
                        ? "Ordering..."
                        : props.paymentMethod
                        ? "Place Order"
                        : "Select payment method"
                    }
                </button>
            </div>
            {props.orderMessage && <p className="OrderMessage">{props.orderMessage}</p>}
        </div>
    )
}

export default Cart;
