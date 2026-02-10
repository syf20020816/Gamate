/// Steam API Key 配置
/// 
/// 在构建时从环境变量读取，编译到二进制文件中
/// 
/// 开发环境：从 .env 文件读取
/// 生产环境：从 CI/CD 环境变量读取

/// 从环境变量获取 Steam API Key（构建时）
/// 
/// 优先级：
/// 1. STEAM_API_KEY 环境变量
/// 2. 编译时默认值（如果设置）
pub fn get_steam_api_key() -> Option<&'static str> {
    // 在编译时读取环境变量
    option_env!("STEAM_API_KEY")
}

/// 检查是否配置了 Steam API Key
pub fn is_steam_enabled() -> bool {
    get_steam_api_key().is_some()
}

/// 获取 Steam API Key，如果未配置则返回错误
pub fn require_steam_api_key() -> Result<&'static str, String> {
    get_steam_api_key().ok_or_else(|| {
        "未配置 Steam API Key。请在构建时设置 STEAM_API_KEY 环境变量。".to_string()
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_steam_api_key() {
        match get_steam_api_key() {
            Some(key) => {
                println!("✅ Steam API Key 已配置");
                println!("   Key 长度: {} 字符", key.len());
                // 不打印完整 Key，只显示前几个字符
                if key.len() > 8 {
                    println!("   Key 预览: {}...", &key[..8]);
                }
            }
            None => {
                println!("⚠️  Steam API Key 未配置");
                println!("   在构建时设置 STEAM_API_KEY 环境变量");
            }
        }
    }

    #[test]
    fn test_is_steam_enabled() {
        let enabled = is_steam_enabled();
        println!("Steam 功能状态: {}", if enabled { "启用" } else { "禁用" });
    }
}
