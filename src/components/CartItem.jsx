import "../styles/components/cart.css"

function CartItem(props) {
    const subtotal = props.price * props.quantity;

    return (
        <div className="CartItem">
            <div className="ItemNameDiv Itemdiv">
                <p className="ItemName">{props.name}</p>
                <p className="ItemMeta">₱{props.price.toFixed(2)} each</p>
            </div>
            <div className="QuantityDiv Itemdiv">
                <button className="QuantityButton" onClick={() => props.onDecrement(props.itemKey, -1)} aria-label={`Remove one ${props.name}`}>
                    -
                </button>
                <p className="Quantity">{props.quantity}</p>
                <button className="QuantityButton" onClick={() => props.onIncrement(props.itemKey, 1)} aria-label={`Add one ${props.name}`}>
                    +
                </button>
            </div>
            <div className="ItemPriceDiv Itemdiv">
                <p className="ItemPrice">₱{subtotal.toFixed(2)}</p>
            </div>
        </div>
    )
}

export default CartItem;
