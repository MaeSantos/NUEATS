import { useState } from "react";
import "../styles/components/fooditem.css";
import add from "../assets/icons/Add.png";

function FoodItem(props) {
    const [isAdding, setIsAdding] = useState(false);
    const stock = Number.isFinite(Number(props.stock)) ? Number(props.stock) : Infinity;
    const isOutOfStock = stock <= 0;

    const handleAdd = () => {
        if (isOutOfStock) {
            return;
        }
        setIsAdding(true);
        if (props.onAdd) {
            props.onAdd({
                key: props.itemKey,
                name: props.name,
                description: props.description,
                price: props.price,
                category: props.category,
                stock,
            });
        }
        window.setTimeout(() => setIsAdding(false), 250);
    };

    return (
        <div className="GridSpace">
            <div className="Item">
                <div className="ImageDiv">
                    <img src={props.foodimg} alt={props.name} className="FoodImg"/>
                </div>
                <div className="InfoDiv">
                    <h1 className="FoodName">{props.name}</h1>
                    <p className="FoodDescription">{props.description}</p>
                </div>
                <div className="PriceDiv">
                    <div>
                        <p className="FoodPrice">₱{props.price}</p>
                        {isOutOfStock && <p className="FoodStock FoodStock--empty">Out of stock</p>}
                    </div>
                    <button
                        className={`AddIconButton ${isAdding ? "AddIconButton--active" : ""}`}
                        onClick={handleAdd}
                        disabled={isOutOfStock}
                        aria-label={`Add ${props.name} to cart`}
                    >
                        <img src={add} alt="Add to Cart" className="AddIcon"/>
                    </button>
                </div>
            </div>
        </div>
    )
}

export default FoodItem;
