import React from "react";
import ReactDOM from "react-dom/client";
import { ConfigProvider, theme } from "antd";
import zhCN from "antd/locale/zh_CN";
import App from "./App";
import HudPage from "./pages/HudPage";
import LivestreamHudPage from "./pages/LivestreamHudPage";
import "./styles/global.scss";

// 根据 URL 路径决定渲染哪个页面
const getCurrentPage = () => {
  const path = window.location.pathname;
  
  if (path === "/hud" || path === "/hud/") {
    return <HudPage />;
  }
  
  if (path === "/livestream-hud" || path === "/livestream-hud/") {
    return <LivestreamHudPage />;
  }
  
  return <App />;
};

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: "#1890ff",
          borderRadius: 8,
        },
      }}
    >
      {getCurrentPage()}
    </ConfigProvider>
  </React.StrictMode>,
);
