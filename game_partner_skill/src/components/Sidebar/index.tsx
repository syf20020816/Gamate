import { useState } from "react";
import { Layout, Menu, Button } from "antd";
import {
  Gamepad2,
  Database,
  Settings,
  Home,
  FileText,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  MessageCircle,
} from "lucide-react";
import type { MenuProps } from "antd";
import "./styles.scss";

const { Sider } = Layout;

type MenuItem = Required<MenuProps>["items"][number];

interface SidebarProps {
  selectedMenu: string;
  onMenuChange: (key: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ selectedMenu, onMenuChange }) => {
  const [collapsed, setCollapsed] = useState(false);

  const menuItems: MenuItem[] = [
    {
      key: "home",
      icon: <Home size={20} />,
      label: "主页",
    },
    {
      key: "wiki-search",
      icon: <BookOpen size={20} />,
      label: "Wiki 搜索",
    },
    {
      key: "ai-assistant",
      icon: <MessageCircle size={20} />,
      label: "AI 陪玩助手",
    },
    {
      key: "game-library",
      icon: <Gamepad2 size={20} />,
      label: "游戏库",
    },
    {
      key: "skill-database",
      icon: <Database size={20} />,
      label: "技能库",
    },
    {
      key: "logs",
      icon: <FileText size={20} />,
      label: "日志",
    },
    {
      key: "settings",
      icon: <Settings size={20} />,
      label: "设置",
    },
  ];

  return (
    <Sider
      collapsible
      collapsed={collapsed}
      onCollapse={setCollapsed}
      trigger={null}
      className="app-sidebar"
      width={240}
      theme="dark"
    >
      <div className="sidebar-header">
        {!collapsed && (
          <img src="/logo.svg" alt="Gamate Logo" className="logo-icon" />
        )}
        {collapsed && (
          <img src="/logo.svg" alt="Gamate Logo" className="logo-icon" />
        )}
      </div>

      <Menu
        theme="dark"
        style={{ backgroundColor: "transparent" }}
        mode="inline"
        selectedKeys={[selectedMenu]}
        items={menuItems}
        onClick={({ key }) => onMenuChange(key)}
      />

      <div className="sidebar-footer">
        <Button
          type="text"
          icon={
            collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />
          }
          onClick={() => setCollapsed(!collapsed)}
          className="collapse-btn"
        >
          {!collapsed && "收起"}
        </Button>
      </div>
    </Sider>
  );
};

export default Sidebar;
