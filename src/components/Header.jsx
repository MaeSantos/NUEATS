import '../styles/components/header.css'
import logoText from '../assets/icons/Logo Text.png'
import cart from '../assets/icons/Cart.png'
import search from '../assets/icons/Search.png'
import defaultUserIcon from '../assets/icons/User.png'

function Header(props) {
  const cartCount = Number(props.cartItemCount || 0);
  const userProfile = props.userProfile || {};

  return (
    <header>
        <div id="CenterDiv">
            <div id="SearchDiv">
              <img src= {logoText} alt="Logo" id="LogoText"/>
              <div className="SearchWrapper">
                <input
                    type="text"
                    placeholder="Burgers, Drinks, etc..."
                    id="SearchInput"
                    value={props.searchQuery}
                    onChange={(e) => props.onSearch(e.target.value)}
                />
                <button className="SearchIconButton" onClick={() => props.onSearch(props.searchQuery)}>
                    <img src={search} className="SearchIcon" alt="Search" />
                </button>
              </div>

              <div className="UserInfo">
                <span className="UserName">{props.userName || "Guest"}</span>
                <button className="NavButton ProfileNavButton" onClick={props.onOpenProfile}>
                  {userProfile.imageUrl ? (
                    <img src={userProfile.imageUrl} className="NavProfilePic" alt="User"/>
                  ) : (
                    <img src={defaultUserIcon} className="NavIcon" alt="User"/>
                  )}
                </button>
              </div>
              <button className="NavButton CartNavButton" onClick={props.onOpenCart} aria-label={`Cart, ${cartCount} item${cartCount === 1 ? "" : "s"}`}>
                <img src={cart} className="NavIcon" alt="Cart"/>
                {cartCount > 0 && (
                  <span className="CartCountBadge" key={cartCount}>
                    {cartCount > 99 ? "99+" : cartCount}
                  </span>
                )}
              </button>

            </div>
            <div id="FilterDiv">
              <button
                className={
                  props.category === "Meal"
                    ? "FilterButton ActiveFilter"
                    : "FilterButton"
                }
                onClick={() => props.onSelectFilter("Meal")}
              >
                Meals
              </button>
              <button
                className={
                  props.category === "Snack"
                    ? "FilterButton ActiveFilter"
                    : "FilterButton"
                }
                onClick={() => props.onSelectFilter("Snack")}
              >
                Snacks
              </button>
              <button
                className={
                  props.category === "Drink"
                    ? "FilterButton ActiveFilter"
                    : "FilterButton"
                }
                onClick={() => props.onSelectFilter("Drink")}
              >
                Drinks
              </button>
              <button
                className={
                  props.category === "All"
                    ? "FilterButton ActiveFilter"
                    : "FilterButton"
                }
                onClick={() => props.onSelectFilter("All")}
              >
                All
              </button>
            </div>
        </div>
    </header>
  )
}

export default Header;
