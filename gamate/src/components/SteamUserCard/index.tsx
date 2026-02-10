/**
 * Steam 用户卡片 - 用于 RightPanel 顶部显示
 */

import { Card, Avatar, Space, Typography } from 'antd';
import { UserOutlined, CloudOutlined, LoginOutlined } from '@ant-design/icons';
import { useState, useEffect } from 'react';
import SteamService from '../../services/steamService';
import type { SteamUser } from '../../types/steam';
import './index.scss';

const { Text } = Typography;

interface SteamUserCardProps {
  onLoginClick?: () => void;
}

export const SteamUserCard: React.FC<SteamUserCardProps> = ({ onLoginClick }) => {
  const [user, setUser] = useState<SteamUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      setLoading(true);
      const loadedUser = await SteamService.loadUserFromConfig();
      setUser(loadedUser);
    } catch (error) {
      console.error('加载 Steam 用户失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCardClick = () => {
    if (!user && onLoginClick) {
      onLoginClick();
    }
  };

  return (
    <Card 
      className="steam-user-card" 
      size="small"
      hoverable={!user}
      onClick={handleCardClick}
      style={{ cursor: user ? 'default' : 'pointer' }}
      loading={loading}
    >
      {user ? (
        <Space align="center" size={12}>
          <Avatar 
            size={48} 
            src={user.avatarfull} 
            icon={<UserOutlined />}
          />
          <div className="user-info">
            <Text strong className="username">{user.personaname}</Text>
            <Text type="secondary" className="steam-id">
              <CloudOutlined style={{ fontSize: 12, marginRight: 4 }} />
              Steam 已连接
            </Text>
          </div>
        </Space>
      ) : (
        <Space align="center" size={12} style={{ width: '100%' }}>
          <Avatar size={48} icon={<UserOutlined />} />
          <div className="user-info" style={{ flex: 1 }}>
            <Text strong className="username">未登录</Text>
            <Text type="secondary" className="hint">
              点击登录 Steam
            </Text>
          </div>
          {/* <LoginOutlined style={{ fontSize: 18, color: '#1890ff' }} /> */}
        </Space>
      )}
    </Card>
  );
};

export default SteamUserCard;
