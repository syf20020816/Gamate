import { Card, Typography, Empty } from "antd";
import "./styles.scss";

const { Title } = Typography;

const SettingsPanel: React.FC = () => {
  return (
    <div className="settings-page">
      <Title level={4}>系统设置</Title>
      <Card>
        <Empty description="设置功能开发中..." />
      </Card>
    </div>
  );
};

export default SettingsPanel;
