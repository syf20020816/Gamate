import ScreenCapture from "../ScreenCapture";
import GameLibrary from "../GameLibrary";
import SkillDatabase from "../SkillDatabase";
import Home from "../Home";
import Logs from "../Logs";
import SettingsPanel from "../Settings";
import WikiKnowledgeBase from "../WikiKnowledgeBase";
import AIAssistant from "../AIAssistant";
import "./styles.scss";

interface MainContentProps {
  selectedMenu: string;
  onMenuChange?: (key: string) => void;
}

const MainContent: React.FC<MainContentProps> = ({ selectedMenu, onMenuChange }) => {
  const renderContent = () => {
    switch (selectedMenu) {
      case "home":
        return <Home onNavigate={onMenuChange} />;
      case "screen-capture":
        return <ScreenCapture />;
      case "wiki-search":
        return <WikiKnowledgeBase />;
      case "ai-assistant":
        return <AIAssistant />;
      case "game-library":
        return <GameLibrary />;
      case "skill-database":
        return <SkillDatabase />;
      case "logs":
        return <Logs />;
      case "settings":
        return <SettingsPanel />;
      default:
        return <Home onNavigate={onMenuChange} />;
    }
  };

  return <div className="main-content">{renderContent()}</div>;
};

export default MainContent;
