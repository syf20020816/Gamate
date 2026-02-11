import { useState, useEffect, useRef } from "react";
import { Layout, Tour, TourProps } from "antd";
import Sidebar from "./components/Sidebar";
import MainContent from "./components/MainContent";
import RightPanel from "./components/RightPanel";
import SteamCallback from "./pages/SteamCallback";
import "./styles/App.scss";

const { Content } = Layout;

function App() {
  const [selectedMenu, setSelectedMenu] = useState<string>("home");
  const [isCallbackPage, setIsCallbackPage] = useState(false);
  const [open, setOpen] = useState(false);

  const stepRef1 = useRef(null);
  const stepRef2 = useRef(null);
  const stepRef3 = useRef(null);

  const steps: TourProps["steps"] = [
    {
      title: "登录Steam获取游戏库",
      description: "点击Steam登录按钮，进行登录，获取您的游戏库。（可选）",
      target: () => stepRef1.current,
    },
    {
      title: "下载游戏技能库",
      description:
        "选择您想要下载的游戏技能库，点击添加按钮获取wiki构建AI Skill。(可选)",
      target: () => stepRef2.current,
    },
    {
      title: "AI陪玩",
      description:
        "体验AI陪玩的乐趣，与虚拟助手进行互动，使用模拟场景模拟直播，让AI作为您的观众。",
      target: () => stepRef3.current,
    },
  ];

  // 检查是否是 Steam 回调页面
  useEffect(() => {
    const path = window.location.pathname;
    setIsCallbackPage(path === "/auth/steam/callback");
  }, []);

  // 如果是回调页面，只显示回调组件
  if (isCallbackPage) {
    return <SteamCallback />;
  }

  return (
    <Layout className="app-layout">
      <Sidebar
        selectedMenu={selectedMenu}
        onMenuChange={setSelectedMenu}
        stepRefs={[stepRef2, stepRef3]}
      />
      <Content className="app-content">
        <MainContent
          setTourOpen={setOpen}
          selectedMenu={selectedMenu}
          onMenuChange={setSelectedMenu}
        />
      </Content>
      <RightPanel onMenuChange={setSelectedMenu} steamLoginRef={stepRef1} />
      <Tour open={open} onClose={() => setOpen(false)} steps={steps} />
    </Layout>
  );
}

export default App;
