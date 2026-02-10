/**
 * Steam 登录回调页面
 * 用于处理 Steam OpenID 认证回调
 */

import { useEffect, useState } from 'react';
import { Spin, Result } from 'antd';
import { LoadingOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import SteamService from '../../services/steamService';

export const SteamCallback = () => {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('正在处理 Steam 登录...');

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      // 获取完整的回调 URL
      const callbackUrl = window.location.href;

      setMessage('验证 Steam 登录信息...');
      
      // 调用后端处理回调
      const user = await SteamService.handleCallback(callbackUrl);

      setStatus('success');
      setMessage(`登录成功！欢迎, ${user.personaname}`);

      // 获取返回路径
      const returnPath = sessionStorage.getItem('steam_return_path') || '/';
      sessionStorage.removeItem('steam_return_path');

      // 1秒后返回到之前的页面
      setTimeout(() => {
        window.location.href = returnPath;
      }, 1000);
    } catch (error: any) {
      console.error('处理回调失败:', error);
      setStatus('error');
      setMessage(error.message || '登录失败');

      // 3秒后返回首页
      setTimeout(() => {
        window.location.href = '/';
      }, 3000);
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      height: '100vh',
      padding: '20px'
    }}>
      {status === 'loading' && (
        <Result
          icon={<Spin indicator={<LoadingOutlined style={{ fontSize: 48 }} spin />} />}
          title={message}
        />
      )}
      
      {status === 'success' && (
        <Result
          status="success"
          icon={<CheckCircleOutlined style={{ fontSize: 48, color: '#52c41a' }} />}
          title={message}
          subTitle="正在返回..."
        />
      )}
      
      {status === 'error' && (
        <Result
          status="error"
          icon={<CloseCircleOutlined style={{ fontSize: 48, color: '#ff4d4f' }} />}
          title="登录失败"
          subTitle={message}
          extra={<span>3秒后自动返回...</span>}
        />
      )}
    </div>
  );
};

export default SteamCallback;
