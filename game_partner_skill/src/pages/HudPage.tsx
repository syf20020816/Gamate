// HUD 窗口专用页面
import React from "react";
import { HudOverlay } from "../components/HudOverlay";
import "../components/HudOverlay/HudOverlay.scss";

const HudPage: React.FC = () => {
  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden" }}>
      <HudOverlay />
    </div>
  );
};

export default HudPage;
