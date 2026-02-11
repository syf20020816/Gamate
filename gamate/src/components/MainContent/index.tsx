import GameLibrary from "../GameLibrary";
import SkillDatabase from "../SkillDatabase";
import Home from "../Home";
// import Logs from "../Logs";
import SettingsPanel from "../Settings";
import WikiKnowledgeBase from "../WikiKnowledgeBase";
import AIAssistant from "../AIAssistant";
import UserAgreement from "../UserAgreement";
import PrivacyPolicy from "../PrivacyPolicy";
import SteamLogin from "../SteamLogin";
import "./styles.scss";

interface MainContentProps {
  selectedMenu: string;
  onMenuChange?: (key: string) => void;
  setTourOpen?: (open: boolean) => void;
}

const MainContent: React.FC<MainContentProps> = ({
  selectedMenu,
  onMenuChange,
  setTourOpen,
}) => {
  const renderContent = () => {
    switch (selectedMenu) {
      case "home":
        return <Home onNavigate={onMenuChange} setTourOpen={setTourOpen} />;
      case "wiki-search":
        return <WikiKnowledgeBase />;
      case "ai-assistant":
        return <AIAssistant />;
      case "game-library":
        return <GameLibrary />;
      case "skill-database":
        return <SkillDatabase />;
      // case "logs":
      //   return <Logs />;
      case "settings":
        return <SettingsPanel />;
      case "steam-login":
        return <SteamLogin />;
      case "user-agreement":
        return <UserAgreement />;
      case "privacy-policy":
        return <PrivacyPolicy />;
      default:
        return <Home onNavigate={onMenuChange} />;
    }
  };

  return <div className="main-content">{renderContent()}</div>;
};

export default MainContent;
