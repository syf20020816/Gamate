/**
 * Steam 登录组件
 */

import { useState, useEffect } from "react";
import { Card, Button, Avatar, Spin, message, List, Tag, Empty } from "antd";
import {
  LogoutOutlined,
  ReloadOutlined,
  ClockCircleOutlined,
  TrophyOutlined,
} from "@ant-design/icons";
import SteamService from "../../services/steamService";
import type { SteamUser, OwnedGame } from "../../types/steam";
import "./index.scss";

export const SteamLogin = () => {
  const [user, setUser] = useState<SteamUser | null>(null);
  const [library, setLibrary] = useState<OwnedGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [libraryLoading, setLibraryLoading] = useState(false);

  // 应用启动时从配置加载
  useEffect(() => {
    loadUserFromConfig();
  }, []);

  /**
   * 从配置加载用户
   */
  const loadUserFromConfig = async () => {
    try {
      setLoading(true);
      const loadedUser = await SteamService.loadUserFromConfig();
      if (loadedUser) {
        setUser(loadedUser);
        message.success(`欢迎回来, ${loadedUser.personaname}!`);
        // 自动加载游戏库
        await loadLibrary();
      }
    } catch (error: any) {
      console.error("从配置加载用户失败:", error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 登录
   */
  const handleLogin = async () => {
    try {
      setLoading(true);
      // 使用重定向方式登录（Tauri 应用中更可靠）
      await SteamService.loginWithRedirect();
      // 注意：这里会跳转到 Steam 登录页面，不会继续执行
    } catch (error: any) {
      console.error("Steam 登录失败:", error);
      message.error(error.message || "Steam 登录失败");
      setLoading(false);
    }
  };

  /**
   * 登出
   */
  const handleLogout = async () => {
    try {
      setLoading(true);
      await SteamService.logout();
      setUser(null);
      setLibrary([]);
      message.success("已退出 Steam 登录");
    } catch (error: any) {
      console.error("登出失败:", error);
      message.error("登出失败");
    } finally {
      setLoading(false);
    }
  };

  /**
   * 加载游戏库
   */
  const loadLibrary = async () => {
    try {
      setLibraryLoading(true);
      const games = await SteamService.fetchLibrary(false);
      setLibrary(games);
      message.success(`加载了 ${games.length} 个游戏`);
    } catch (error: any) {
      console.error("加载游戏库失败:", error);
      message.error("加载游戏库失败");
    } finally {
      setLibraryLoading(false);
    }
  };

  /**
   * 刷新游戏库
   */
  const handleRefreshLibrary = async () => {
    if (!user) return;
    await loadLibrary();
  };

  return (
    <div className="steam-login">
      <Card
        title={
          <div className="steam-card-title">

            <span>Steam 账号</span>
          </div>
        }
        extra={
          user && (
            <Button
              type="link"
              danger
              icon={<LogoutOutlined />}
              onClick={handleLogout}
              disabled={loading}
            >
              退出登录
            </Button>
          )
        }
      >
        {loading && !user ? (
          <div className="steam-loading">
            <Spin tip="加载中..." />
          </div>
        ) : user ? (
          <>
            <div className="steam-user-info">
              <Avatar size={64} src={user.avatarfull} />
              <div className="user-details">
                <h3>{user.personaname}</h3>
                <p className="steam-id">Steam ID: {user.steamid}</p>
                {user.realname && (
                  <p className="real-name">真实姓名: {user.realname}</p>
                )}
                <Button
                  type="link"
                  href={user.profileurl}
                  target="_blank"
                  size="small"
                >
                  查看 Steam 资料
                </Button>
              </div>
            </div>

            <Card
              size="small"
              title={
                <div className="library-title">
                  <TrophyOutlined />
                  <span>游戏库 ({library.length})</span>
                </div>
              }
              extra={
                <Button
                  type="link"
                  icon={<ReloadOutlined />}
                  onClick={handleRefreshLibrary}
                  loading={libraryLoading}
                  size="small"
                >
                  刷新
                </Button>
              }
              style={{ marginTop: 16 }}
            >
              {libraryLoading ? (
                <div className="library-loading">
                  <Spin tip="加载游戏库中..." />
                </div>
              ) : library.length === 0 ? (
                <Empty
                  description="暂无游戏"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              ) : (
                <List
                  className="game-list"
                  dataSource={library.slice(0, 20)} // 只显示前20个
                  renderItem={(game) => (
                    <List.Item key={game.appid}>
                      <List.Item.Meta
                        avatar={
                          <img
                            src={SteamService.getGameHeaderUrl(game.appid)}
                            alt={game.name}
                            style={{
                              width: 92,
                              height: 43,
                              objectFit: "cover",
                              borderRadius: 4,
                            }}
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                SteamService.getGameIconUrl(
                                  game.appid,
                                  game.img_icon_url,
                                );
                            }}
                          />
                        }
                        title={
                          <a
                            href={SteamService.getStoreUrl(game.appid)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {game.name}
                          </a>
                        }
                        description={
                          <div className="game-stats">
                            <Tag icon={<ClockCircleOutlined />} color="blue">
                              {SteamService.formatPlaytime(
                                game.playtime_forever,
                              )}
                            </Tag>
                            {game.playtime_2weeks !== undefined &&
                              game.playtime_2weeks > 0 && (
                                <Tag color="green">
                                  最近 2 周:{" "}
                                  {SteamService.formatPlaytime(
                                    game.playtime_2weeks,
                                  )}
                                </Tag>
                              )}
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                />
              )}
              {library.length > 20 && (
                <div className="more-games-hint">
                  还有 {library.length - 20} 个游戏未显示...
                </div>
              )}
            </Card>
          </>
        ) : (
          <div className="steam-login-prompt">
            <svg
              viewBox="0 0 1024 1024"
              version="1.1"
              xmlns="http://www.w3.org/2000/svg"
              p-id="4834"
              width="84"
              height="84"
            >
              <path
                d="M511.104 0C242.261333 0 21.802667 207.36 0.938667 470.912l274.432 113.408a144.512 144.512 0 0 1 81.578666-25.173333c2.688 0 5.333333 0.170667 8.021334 0.256l122.069333-176.725334V380.16a193.194667 193.194667 0 0 1 193.024-193.024c106.410667 0 193.024 86.656 193.024 193.152s-86.613333 193.066667-193.024 193.066667h-4.48l-173.909333 124.202666c0 2.218667 0.170667 4.48 0.170666 6.784a144.725333 144.725333 0 0 1-144.64 144.896 145.578667 145.578667 0 0 1-142.122666-116.352L18.602667 651.52C79.445333 866.432 276.736 1024 511.104 1024c282.752 0 511.957333-229.248 511.957333-512S793.813333 0 511.104 0zM321.706667 776.96l-62.848-26.026667c11.178667 23.168 30.464 42.624 56.064 53.333334a108.842667 108.842667 0 0 0 142.378666-141.824 108.672 108.672 0 0 0-138.88-60.288l64.981334 26.88a80.128 80.128 0 0 1-61.653334 147.925333H321.706667z m487.04-396.928a128.810667 128.810667 0 0 0-128.64-128.64 128.64 128.64 0 1 0 128.64 128.64z m-224.981334-0.213333a96.597333 96.597333 0 1 1 193.322667 0 96.725333 96.725333 0 0 1-96.682667 96.64 96.597333 96.597333 0 0 1-96.64-96.64z"
                p-id="4835"
                fill="#015cb1ff"
              ></path>
            </svg>
            <h3>连接 Steam 账号</h3>
            <p>登录 Steam 后，可以自动同步您的游戏库，您的任何数据都不会被收集</p>
            <Button
              type="primary"
              size="large"
              onClick={handleLogin}
              loading={loading}
            >
              通过 Steam 登录
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
};

export default SteamLogin;
