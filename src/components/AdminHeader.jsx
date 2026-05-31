import '../styles/components/adminheader.css';
import userIcon from '../assets/icons/User.png';
import logoText from '../assets/icons/Logo Text.png';

function AdminHeader(props) {
  const tabs = ["Orders", "Menu", "Reports"];

  return (
    <header className="AdminHeader">
      <div id="AdminCenterDiv">
        <div id="AdminTopRow">
          <img src={logoText} alt="Logo" id="LogoText" />
          
          <button className="NavButton" onClick={props.onOpenProfile}>
            <img src={userIcon} className="NavIcon" alt="User" />
          </button>
        </div>
        
        <div id="AdminTabRow">
          {tabs.map((tab) => (
            <button
              key={tab}
              className={props.currentTab === tab ? "TabButton ActiveTab" : "TabButton"}
              onClick={() => props.onSelectTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}

export default AdminHeader;
