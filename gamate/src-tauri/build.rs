fn main() {
    // 加载 .env 文件中的环境变量
    dotenv::from_filename(".env").ok();
    
    // 读取 STEAM_API_KEY 并传递给编译器
    // 这样 option_env!("STEAM_API_KEY") 才能在编译时读取到
    if let Ok(steam_key) = std::env::var("STEAM_API_KEY") {
        println!("cargo:rustc-env=STEAM_API_KEY={}", steam_key);
        println!("cargo:warning=✅ Steam API Key loaded: {}...", &steam_key[..steam_key.len().min(8)]);
    } else {
        println!("cargo:warning=⚠️ STEAM_API_KEY not found in .env file");
    }
    
    tauri_build::build()
}
