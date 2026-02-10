use reqwest::Client;
use std::time::Duration;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    env_logger::init();

    let url = "https://phasmophobia.fandom.com/wiki/";

    println!("测试访问: {}", url);

    // 构建完整的 Headers
    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert(
        reqwest::header::ACCEPT,
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8"
            .parse()
            .unwrap(),
    );
    headers.insert(
        reqwest::header::ACCEPT_LANGUAGE,
        "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7".parse().unwrap(),
    );
    headers.insert(
        reqwest::header::ACCEPT_ENCODING,
        "gzip, deflate, br".parse().unwrap(),
    );
    headers.insert(reqwest::header::DNT, "1".parse().unwrap());
    headers.insert(reqwest::header::CONNECTION, "keep-alive".parse().unwrap());
    headers.insert(
        reqwest::header::UPGRADE_INSECURE_REQUESTS,
        "1".parse().unwrap(),
    );

    let client = Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36")
        .default_headers(headers)
        .timeout(Duration::from_secs(30))
        .build()?;

    println!("发送请求...");

    match client.get(url).send().await {
        Ok(response) => {
            println!("✅ 状态码: {}", response.status());
            println!("📋 Headers:");
            for (name, value) in response.headers() {
                println!("  {}: {:?}", name, value);
            }

            if response.status().is_success() {
                let text = response.text().await?;
                println!("\n📄 内容长度: {} 字节", text.len());
                println!("🔍 前 200 字符:\n{}", &text[..text.len().min(200)]);
            } else {
                let text = response.text().await?;
                println!("\n❌ 错误响应:\n{}", &text[..text.len().min(500)]);
            }
        }
        Err(e) => {
            println!("❌ 请求失败: {}", e);

            if e.is_timeout() {
                println!("  原因: 超时");
            } else if e.is_connect() {
                println!("  原因: 连接失败");
            } else if e.is_status() {
                println!("  原因: HTTP 状态错误");
            }
        }
    }

    Ok(())
}
