import { useState, useEffect } from "react";
import { Layout } from "antd";
import Sidebar from "./components/Sidebar";
import MainContent from "./components/MainContent";
import RightPanel from "./components/RightPanel";
import { useUserStore } from "./stores/userStore";
import "./styles/App.scss";

const { Content } = Layout;

function App() {
  const [selectedMenu, setSelectedMenu] = useState<string>("home");
  const { user, initializeDefaultUser } = useUserStore();

  // 初始化用户
  useEffect(() => {
    if (!user) {
      initializeDefaultUser();
    }
  }, [user, initializeDefaultUser]);

  return (
    <Layout className="app-layout">
      <Sidebar selectedMenu={selectedMenu} onMenuChange={setSelectedMenu} />
      <Content className="app-content">
        <MainContent selectedMenu={selectedMenu} onMenuChange={setSelectedMenu} />
      </Content>
      <RightPanel />
    </Layout>
  );
}

export default App;
