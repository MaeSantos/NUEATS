import { useState, useEffect } from "react";
import FoodItem from "../components/FoodItem";
import menuItemsFallback from "../TempData";
import imageMap from "../imageMap";
import { apiFetch } from "../api";
import fallbackFoodImage from "../assets/icons/Full Logo.png";

const MENU_CACHE_KEY = "nu_menu_cache";

function attachImages(items) {
  return items.map((item) => ({
    ...item,
    image:
      item.imageUrl ||
      imageMap[item.name] ||
      menuItemsFallback.find((fallback) => fallback.name === item.name)?.image ||
      fallbackFoodImage,
  }));
}

function DashboardBody(props) {
  const [menuItems, setMenuItems] = useState(menuItemsFallback);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadMenu() {
      try {
        const cached = localStorage.getItem(MENU_CACHE_KEY);
        if (cached) {
          setMenuItems(attachImages(JSON.parse(cached)));
          setLoading(false);
        }

        const response = await apiFetch("/api/menu");
        if (!response.ok) {
          throw new Error(`Menu API returned ${response.status}`);
        }

        const data = await response.json();
        const itemsWithImages = attachImages(data);

        setMenuItems(itemsWithImages);
        localStorage.setItem(MENU_CACHE_KEY, JSON.stringify(data));
        setError(null);
      } catch (fetchError) {
        console.error("Failed to load menu from backend:", fetchError);
        setError("Network is limited. Showing saved menu.");
        if (!localStorage.getItem(MENU_CACHE_KEY)) {
          setMenuItems(menuItemsFallback);
        }
      } finally {
        setLoading(false);
      }
    }

    loadMenu();
  }, []);

  return (
    <div id="DashboardBody">
      {/* Platform specific styling helper */}
      <div className="DashboardSection">
        {loading && <p className="LoadingText">Loading menu...</p>}
        {error && <p className="ErrorText">{error}</p>}
      </div>

      {!loading &&
        menuItems
          .filter((item) => props.category === "All" || item.category === props.category)
          .filter((item) =>
            !props.searchQuery ||
            item.name.toLowerCase().includes(props.searchQuery.toLowerCase()) ||
            item.description.toLowerCase().includes(props.searchQuery.toLowerCase())
          )
          .map((item) => (
            <FoodItem
              key={item.key}
              itemKey={item.key}
              name={item.name}
              description={item.description}
              price={item.price}
              stock={item.stock}
              category={item.category}
              foodimg={item.image}
              onAdd={props.onAdd}
            />
          ))}
    </div>
  );
}

export default DashboardBody;
