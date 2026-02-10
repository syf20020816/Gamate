import { useState } from "react";
import { Layout } from "antd";
import Sidebar from "./components/Sidebar";
import MainContent from "./components/MainContent";
import RightPanel from "./components/RightPanel";
import "./styles/App.scss";

const { Content } = Layout;

function App() {
  const [selectedMenu, setSelectedMenu] = useState<string>("home");
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
