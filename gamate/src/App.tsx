import { useState, useEffect } from "react";
import { Layout } from "antd";
import Sidebar from "./components/Sidebar";
import MainContent from "./components/MainContent";
import RightPanel from "./components/RightPanel";
import SteamCallback from "./pages/SteamCallback";
import "./styles/App.scss";

const { Content } = Layout;

function App() {
  const [selectedMenu, setSelectedMenu] = useState<string>("home");
  const [isCallbackPage, setIsCallbackPage] = useState(false);

  // 检查是否是 Steam 回调页面
  useEffect(() => {
    const path = window.location.pathname;
    setIsCallbackPage(path === '/auth/steam/callback');
  }, []);

  // 如果是回调页面，只显示回调组件
  if (isCallbackPage) {
    return <SteamCallback />;
  }

  return (
    <Layout className="app-layout">
      <Sidebar selectedMenu={selectedMenu} onMenuChange={setSelectedMenu} />
      <Content className="app-content">
        <MainContent
          selectedMenu={selectedMenu}
          onMenuChange={setSelectedMenu}
        />
      </Content>
      <RightPanel onMenuChange={setSelectedMenu} />
    </Layout>
  );
}

export default App;
