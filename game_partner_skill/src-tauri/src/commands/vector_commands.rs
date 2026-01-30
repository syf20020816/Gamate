use crate::{
    crawler::WikiEntry,
    embeddings::EmbeddingService,
    vector_db::{VectorDB, LocalVectorDB, AIDirectSearch},
    settings::AppSettings,
};
use anyhow::Result;
use serde_json::json;
use std::path::PathBuf;
use std::fs;

/// 导入 Wiki 数据到向量数据库
#[tauri::command]
pub async fn import_wiki_to_vector_db(
    jsonl_path: String,
    game_id: String,
) -> Result<String, String> {
    import_wiki_to_vector_db_impl(jsonl_path, game_id)
        .await
        .map_err(|e| format!("导入失败: {}", e))
}

async fn import_wiki_to_vector_db_impl(jsonl_path: String, game_id: String) -> Result<String> {
    log::info!("📖 开始导入 Wiki 数据到向量数据库...");
    log::info!("   文件: {}", jsonl_path);
    log::info!("   游戏: {}", game_id);

    // 1. 读取 JSONL 文件
    let content = std::fs::read_to_string(&jsonl_path)?;
    let entries: Vec<WikiEntry> = content
        .lines()
        .filter(|line| !line.trim().is_empty())
        .filter_map(|line| serde_json::from_str(line).ok())
        .collect();

    if entries.is_empty() {
        anyhow::bail!("JSONL 文件为空或格式错误");
    }

    log::info!("✅ 读取 {} 条 Wiki 条目", entries.len());

    // 2. 加载应用配置
    let settings = AppSettings::load()?;
    let embedding_config = &settings.ai_models.embedding;
    let vdb_config = &settings.ai_models.vector_db;
    
    log::info!("🔧 向量数据库模式: {}", vdb_config.mode);
    
    // 3. 根据模式选择不同的导入逻辑
    match vdb_config.mode.as_str() {
        "local" => {
            import_to_local_db(entries, game_id, embedding_config).await
        }
        "qdrant" => {
            import_to_qdrant(entries, game_id, embedding_config, vdb_config).await
        }
        "ai_direct" => {
            // AI 直接检索模式不需要导入向量数据库,只需要保存原始数据
            import_to_ai_direct(entries, game_id, vdb_config).await
        }
        _ => {
            anyhow::bail!("不支持的向量数据库模式: {}", vdb_config.mode);
        }
    }
}

/// 导入到本地文件型数据库
async fn import_to_local_db(
    entries: Vec<WikiEntry>,
    game_id: String,
    embedding_config: &crate::settings::ModelConfig,
) -> Result<String> {
    log::info!("📦 使用本地文件型数据库");
    
    // 1. 初始化 Embedding 服务
    let embedding_service = EmbeddingService::new(
        embedding_config.api_base.clone(),
        embedding_config.api_key.clone(),
        embedding_config.model_name.clone(),
    ).await?;
    
    // 2. 初始化本地数据库
    let settings = AppSettings::load()?;
    let storage_path = settings.ai_models.vector_db.local_storage_path
        .as_ref()
        .cloned()
        .unwrap_or_else(|| "./data/vector_db".to_string());
    
    let collection_name = format!("game_wiki_{}", game_id);
    let mut local_db = LocalVectorDB::new(PathBuf::from(&storage_path), &collection_name)?;
    
    // 3. 创建集合
    let vector_size = embedding_service.dimension();
    local_db.create_collection(vector_size)?;
    
    // 4. 批量生成 Embedding 并插入
    let batch_size = 50;
    let mut total_imported = 0;

    for (batch_idx, chunk) in entries.chunks(batch_size).enumerate() {
        log::info!(
            "📝 处理批次 {}/{} ({} 条)...",
            batch_idx + 1,
            (entries.len() + batch_size - 1) / batch_size,
            chunk.len()
        );

        // 生成 embedding
        let texts: Vec<&str> = chunk.iter().map(|e| e.content.as_str()).collect();
        let vectors = embedding_service.embed_batch(texts).await?;

        // 准备插入数据
        let points: Vec<_> = chunk
            .iter()
            .zip(vectors)
            .enumerate()
            .map(|(i, (entry, vector))| {
                let id = (batch_idx * batch_size + i) as u64;
                let payload = json!({
                    "id": entry.id,
                    "title": entry.title,
                    "content": entry.content,
                    "url": entry.url,
                    "timestamp": entry.timestamp,
                    "categories": entry.categories,
                    "game_id": game_id,
                });
                (id, vector, payload)
            })
            .collect();

        // 插入向量
        local_db.upsert_points(points)?;
        total_imported += chunk.len();

        log::info!("✅ 批次 {} 完成，累计导入 {} 条", batch_idx + 1, total_imported);
    }

    let summary = format!(
        "成功导入 {} 条 Wiki 条目到本地向量数据库 (集合: {})",
        total_imported, collection_name
    );

    log::info!("🎉 {}", summary);
    Ok(summary)
}

/// 导入到 Qdrant 服务器
async fn import_to_qdrant(
    entries: Vec<WikiEntry>,
    game_id: String,
    embedding_config: &crate::settings::ModelConfig,
    vdb_config: &crate::settings::VectorDBSettings,
) -> Result<String> {
    log::info!("🚀 使用 Qdrant 服务器");
    
    // 1. 初始化 Embedding 服务
    let embedding_service = EmbeddingService::new(
        embedding_config.api_base.clone(),
        embedding_config.api_key.clone(),
        embedding_config.model_name.clone(),
    ).await?;

    // 2. 连接 Qdrant
    let qdrant_url = vdb_config.qdrant_url
        .as_ref()
        .cloned()
        .unwrap_or_else(|| "http://localhost:6333".to_string());
    let collection_name = format!("game_wiki_{}", game_id);
    let vector_db = VectorDB::new(&qdrant_url, &collection_name).await?;

    // 3. 如果集合已存在，删除它
    if vector_db.collection_exists().await? {
        log::warn!("⚠️  集合已存在，正在删除...");
        vector_db.delete_collection().await?;
    }

    // 4. 创建集合
    let vector_size = embedding_service.dimension() as u64;
    vector_db.create_collection(vector_size).await?;

    // 5. 批量生成 Embedding 并插入
    let batch_size = 50;
    let mut total_imported = 0;

    for (batch_idx, chunk) in entries.chunks(batch_size).enumerate() {
        log::info!(
            "📝 处理批次 {}/{} ({} 条)...",
            batch_idx + 1,
            (entries.len() + batch_size - 1) / batch_size,
            chunk.len()
        );

        // 生成 embedding
        let texts: Vec<&str> = chunk.iter().map(|e| e.content.as_str()).collect();
        let vectors = embedding_service.embed_batch(texts).await?;

        // 准备插入数据
        let points: Vec<_> = chunk
            .iter()
            .zip(vectors)
            .enumerate()
            .map(|(i, (entry, vector))| {
                let id = (batch_idx * batch_size + i) as u64;
                let payload = json!({
                    "id": entry.id,
                    "title": entry.title,
                    "content": entry.content,
                    "url": entry.url,
                    "timestamp": entry.timestamp,
                    "categories": entry.categories,
                    "game_id": game_id,
                });
                (id, vector, payload)
            })
            .collect();

        // 插入向量
        vector_db.upsert_points(points).await?;
        total_imported += chunk.len();

        log::info!("✅ 批次 {} 完成，累计导入 {} 条", batch_idx + 1, total_imported);
    }

    let summary = format!(
        "成功导入 {} 条 Wiki 条目到 Qdrant 向量数据库 (集合: {})",
        total_imported, collection_name
    );

    log::info!("🎉 {}", summary);
    Ok(summary)
}

/// 导入到 AI 直接检索模式（将 JSONL 复制到向量数据库目录）
async fn import_to_ai_direct(
    entries: Vec<WikiEntry>,
    game_id: String,
    vdb_config: &crate::settings::VectorDBSettings,
) -> Result<String> {
    log::info!("🤖 使用 AI 直接检索模式，准备保存 JSONL 文件");
    
    let storage_path = vdb_config.local_storage_path
        .as_ref()
        .cloned()
        .unwrap_or_else(|| "./data/vector_db".to_string());
    
    // 确保目录存在
    std::fs::create_dir_all(&storage_path)?;
    
    // 保存为 {game_id}.jsonl
    let jsonl_path = PathBuf::from(&storage_path).join(format!("{}.jsonl", game_id));
    let mut file = std::fs::File::create(&jsonl_path)?;
    
    use std::io::Write;
    for entry in &entries {
        // 只保留必要字段
        let simple_entry = serde_json::json!({
            "title": entry.title,
            "content": entry.content,
            "url": entry.url,
        });
        writeln!(file, "{}", serde_json::to_string(&simple_entry)?)?;
    }
    
    let count = entries.len();
    let summary = format!(
        "AI 直接检索模式已就绪，共 {} 条 Wiki 条目保存到 {:?}",
        count, jsonl_path
    );

    log::info!("🎉 {}", summary);
    Ok(summary)
}

/// 搜索 Wiki 知识
#[tauri::command]
pub async fn search_wiki(
    query: String,
    game_id: String,
    top_k: Option<usize>,
) -> Result<Vec<WikiSearchResult>, String> {
    search_wiki_impl(query, game_id, top_k)
        .await
        .map_err(|e| format!("搜索失败: {}", e))
}

async fn search_wiki_impl(
    query: String,
    game_id: String,
    top_k: Option<usize>,
) -> Result<Vec<WikiSearchResult>> {
    let top_k = top_k.unwrap_or(5);

    log::info!("🔍 搜索 Wiki 知识...");
    log::info!("   查询: {}", query);
    log::info!("   游戏: {}", game_id);
    log::info!("   Top-K: {}", top_k);

    // 1. 加载应用配置
    let settings = AppSettings::load()?;
    let vdb_config = &settings.ai_models.vector_db;
    
    log::info!("🔧 搜索模式: {}", vdb_config.mode);
    
    // 2. 根据模式选择不同的搜索逻辑
    match vdb_config.mode.as_str() {
        "local" => {
            search_with_local_db(query, game_id, top_k, &settings).await
        }
        "qdrant" => {
            search_with_qdrant(query, game_id, top_k, &settings).await
        }
        "ai_direct" => {
            search_with_ai_direct(query, game_id, top_k, vdb_config).await
        }
        _ => {
            anyhow::bail!("不支持的向量数据库模式: {}", vdb_config.mode);
        }
    }
}

/// 使用本地数据库搜索
async fn search_with_local_db(
    query: String,
    game_id: String,
    top_k: usize,
    settings: &AppSettings,
) -> Result<Vec<WikiSearchResult>> {
    log::info!("📦 使用本地文件型数据库搜索");
    
    let embedding_config = &settings.ai_models.embedding;
    
    // 1. 初始化 Embedding 服务
    let embedding_service = EmbeddingService::new(
        embedding_config.api_base.clone(),
        embedding_config.api_key.clone(),
        embedding_config.model_name.clone(),
    ).await?;
    
    // 2. 初始化本地数据库
    let storage_path = settings.ai_models.vector_db.local_storage_path
        .as_ref()
        .cloned()
        .unwrap_or_else(|| "./data/vector_db".to_string());
    
    let collection_name = format!("game_wiki_{}", game_id);
    let local_db = LocalVectorDB::new(PathBuf::from(&storage_path), &collection_name)?;
    
    // 3. 生成查询向量
    let query_vector = embedding_service.embed_text(&query).await?;
    
    // 4. 搜索
    let results = local_db.search(query_vector, top_k)?;
    
    // 5. 转换结果
    let wiki_results: Vec<WikiSearchResult> = results
        .into_iter()
        .map(|r| WikiSearchResult {
            score: r.score,
            id: r.payload.get("id")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            title: r.payload.get("title")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            content: r.payload.get("content")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            url: r.payload.get("url")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            categories: r.payload.get("categories")
                .and_then(|v| v.as_array())
                .map(|arr| {
                    arr.iter()
                        .filter_map(|v| v.as_str().map(|s| s.to_string()))
                        .collect()
                })
                .unwrap_or_default(),
        })
        .collect();
    
    log::info!("✅ 找到 {} 个相关结果", wiki_results.len());
    Ok(wiki_results)
}

/// 使用 Qdrant 搜索
async fn search_with_qdrant(
    query: String,
    game_id: String,
    top_k: usize,
    settings: &AppSettings,
) -> Result<Vec<WikiSearchResult>> {
    log::info!("🚀 使用 Qdrant 服务器搜索");
    
    let embedding_config = &settings.ai_models.embedding;
    
    // 1. 初始化 Embedding 服务
    let embedding_service = EmbeddingService::new(
        embedding_config.api_base.clone(),
        embedding_config.api_key.clone(),
        embedding_config.model_name.clone(),
    ).await?;

    // 2. 连接 Qdrant
    let qdrant_url = settings.ai_models.vector_db.qdrant_url
        .as_ref()
        .cloned()
        .unwrap_or_else(|| "http://localhost:6333".to_string());
    let collection_name = format!("game_wiki_{}", game_id);
    let vector_db = VectorDB::new(&qdrant_url, &collection_name).await?;

    // 3. 检查集合是否存在
    if !vector_db.collection_exists().await? {
        anyhow::bail!("游戏 {} 的知识库不存在，请先导入 Wiki 数据", game_id);
    }

    // 4. 生成查询向量
    let query_vector = embedding_service.embed_text(&query).await?;

    // 5. 检索
    let results = vector_db.search(query_vector, top_k).await?;

    // 6. 解析结果
    let wiki_results: Vec<WikiSearchResult> = results
        .into_iter()
        .filter_map(|r| {
            let payload = r.payload;
            Some(WikiSearchResult {
                score: r.score,
                id: payload.get("id")?.as_str()?.to_string(),
                title: payload.get("title")?.as_str()?.to_string(),
                content: payload.get("content")?.as_str()?.to_string(),
                url: payload.get("url")?.as_str()?.to_string(),
                categories: payload
                    .get("categories")?
                    .as_array()?
                    .iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                    .collect(),
            })
        })
        .collect();

    log::info!("✅ 找到 {} 个相关结果", wiki_results.len());

    Ok(wiki_results)
}

/// 使用 AI 直接检索
async fn search_with_ai_direct(
    query: String,
    game_id: String,
    top_k: usize,
    vdb_config: &crate::settings::VectorDBSettings,
) -> Result<Vec<WikiSearchResult>> {
    log::info!("🤖 使用 AI 直接检索模式搜索");
    
    let storage_path = vdb_config.local_storage_path
        .as_ref()
        .cloned()
        .unwrap_or_else(|| "./data/vector_db".to_string());
    
    let ai_search = AIDirectSearch::new(PathBuf::from(storage_path));
    
    // 执行关键词匹配搜索
    let results = ai_search.search(&query, &game_id, top_k)?;
    
    // 转换结果格式 (AI 直接搜索的结果字段较少)
    let wiki_results: Vec<WikiSearchResult> = results
        .into_iter()
        .map(|r| WikiSearchResult {
            score: r.score,
            id: r.url.clone(), // 使用 URL 作为 ID
            title: r.title,
            content: r.content,
            url: r.url,
            categories: Vec::new(), // AI 直接搜索没有分类信息
        })
        .collect();
    
    log::info!("✅ 找到 {} 个相关结果", wiki_results.len());
    Ok(wiki_results)
}

/// 获取向量数据库统计信息
#[tauri::command]
pub async fn get_vector_db_stats(game_id: String) -> Result<VectorDBStats, String> {
    get_vector_db_stats_impl(game_id)
        .await
        .map_err(|e| format!("获取统计信息失败: {}", e))
}

async fn get_vector_db_stats_impl(game_id: String) -> Result<VectorDBStats> {
    let settings = AppSettings::load()?;
    let vdb_config = &settings.ai_models.vector_db;
    
    // 根据模式获取不同的统计信息
    match vdb_config.mode.as_str() {
        "qdrant" => {
            // Qdrant 模式 - 获取详细统计
            let qdrant_url = vdb_config.qdrant_url
                .as_ref()
                .cloned()
                .unwrap_or_else(|| "http://localhost:6333".to_string());
            let collection_name = format!("game_wiki_{}", game_id);
            let vector_db = VectorDB::new(&qdrant_url, &collection_name).await?;

            if !vector_db.collection_exists().await? {
                return Ok(VectorDBStats {
                    exists: false,
                    vectors_count: 0,
                    points_count: 0,
                    game_id,
                });
            }

            let info = vector_db.get_collection_info().await?;

            Ok(VectorDBStats {
                exists: true,
                vectors_count: info.vectors_count,
                points_count: info.points_count,
                game_id,
            })
        }
        "local" | "ai_direct" => {
            // 本地模式和 AI 直接模式 - 简化统计
            let exists = check_game_vector_db_impl(game_id.clone()).await?;
            Ok(VectorDBStats {
                exists,
                vectors_count: 0, // 本地模式不提供详细统计
                points_count: 0,
                game_id,
            })
        }
        _ => {
            anyhow::bail!("不支持的向量数据库模式: {}", vdb_config.mode);
        }
    }
}

/// 检查游戏的向量数据库是否已导入
#[tauri::command]
pub async fn check_game_vector_db(game_id: String) -> Result<bool, String> {
    check_game_vector_db_impl(game_id)
        .await
        .map_err(|e| format!("检查失败: {}", e))
}

async fn check_game_vector_db_impl(game_id: String) -> Result<bool> {
    let settings = AppSettings::load()?;
    let vdb_config = &settings.ai_models.vector_db;
    
    // 根据模式检查不同的后端
    match vdb_config.mode.as_str() {
        "local" => {
            // 检查本地数据库文件是否存在
            let storage_path = vdb_config.local_storage_path
                .as_ref()
                .cloned()
                .unwrap_or_else(|| "./data/vector_db".to_string());
            
            let collection_name = format!("game_wiki_{}", game_id);
            let local_db = LocalVectorDB::new(PathBuf::from(&storage_path), &collection_name)?;
            Ok(local_db.collection_exists())
        }
        "qdrant" => {
            // 检查 Qdrant 集合是否存在
            let qdrant_url = vdb_config.qdrant_url
                .as_ref()
                .cloned()
                .unwrap_or_else(|| "http://localhost:6333".to_string());
            let collection_name = format!("game_wiki_{}", game_id);
            
            let vector_db = VectorDB::new(&qdrant_url, &collection_name).await?;
            let exists = vector_db.collection_exists().await?;
            Ok(exists)
        }
        "ai_direct" => {
            // 检查 JSONL 文件是否存在
            let storage_path = vdb_config.local_storage_path
                .as_ref()
                .cloned()
                .unwrap_or_else(|| "./data/vector_db".to_string());
            
            let jsonl_path = PathBuf::from(&storage_path).join(format!("{}.jsonl", game_id));
            Ok(jsonl_path.exists())
        }
        _ => {
            anyhow::bail!("不支持的向量数据库模式: {}", vdb_config.mode);
        }
    }
}

/// 获取所有已导入向量数据库的游戏列表
#[tauri::command]
pub async fn list_imported_games() -> Result<Vec<String>, String> {
    list_imported_games_impl()
        .await
        .map_err(|e| format!("获取列表失败: {}", e))
}

async fn list_imported_games_impl() -> Result<Vec<String>> {
    let settings = AppSettings::load()?;
    let vdb_config = &settings.ai_models.vector_db;
    
    // 根据模式列出不同后端的游戏
    match vdb_config.mode.as_str() {
        "local" => {
            // 列出本地数据库的所有集合
            let storage_path = vdb_config.local_storage_path
                .as_ref()
                .cloned()
                .unwrap_or_else(|| "./data/vector_db".to_string());
            
            let storage_dir = PathBuf::from(&storage_path);
            if !storage_dir.exists() {
                return Ok(Vec::new());
            }
            
            let mut game_ids = Vec::new();
            for entry in std::fs::read_dir(&storage_dir)? {
                let entry = entry?;
                let file_name = entry.file_name();
                let file_name_str = file_name.to_string_lossy();
                
                // 查找 game_wiki_*.json 文件
                if file_name_str.starts_with("game_wiki_") && file_name_str.ends_with(".json") {
                    if let Some(game_id) = file_name_str
                        .strip_prefix("game_wiki_")
                        .and_then(|s| s.strip_suffix(".json"))
                    {
                        game_ids.push(game_id.to_string());
                    }
                }
            }
            
            Ok(game_ids)
        }
        "qdrant" => {
            // 从 Qdrant 获取集合列表
            let qdrant_url = vdb_config.qdrant_url
                .as_ref()
                .cloned()
                .unwrap_or_else(|| "http://localhost:6333".to_string());
            
            // 获取所有集合
            let client = reqwest::Client::new();
            let response = client
                .get(format!("{}/collections", qdrant_url))
                .send()
                .await?;
            
            if !response.status().is_success() {
                anyhow::bail!("获取集合列表失败");
            }
            
            #[derive(serde::Deserialize)]
            struct CollectionsResponse {
                result: CollectionsResult,
            }
            
            #[derive(serde::Deserialize)]
            struct CollectionsResult {
                collections: Vec<CollectionItem>,
            }
            
            #[derive(serde::Deserialize)]
            struct CollectionItem {
                name: String,
            }
            
            let collections: CollectionsResponse = response.json().await?;
            
            // 筛选出 game_wiki_ 开头的集合
            let game_ids: Vec<String> = collections
                .result
                .collections
                .into_iter()
                .filter_map(|c| {
                    if c.name.starts_with("game_wiki_") {
                        Some(c.name.strip_prefix("game_wiki_").unwrap().to_string())
                    } else {
                        None
                    }
                })
                .collect();
            
            Ok(game_ids)
        }
        "ai_direct" => {
            // 列出所有 JSONL 文件
            let storage_path = vdb_config.local_storage_path
                .as_ref()
                .cloned()
                .unwrap_or_else(|| "./data/vector_db".to_string());
            
            let storage_dir = PathBuf::from(&storage_path);
            if !storage_dir.exists() {
                return Ok(Vec::new());
            }
            
            let mut game_ids = Vec::new();
            for entry in std::fs::read_dir(&storage_dir)? {
                let entry = entry?;
                let file_name = entry.file_name();
                let file_name_str = file_name.to_string_lossy();
                
                // 查找 *.jsonl 文件
                if file_name_str.ends_with(".jsonl") {
                    if let Some(game_id) = file_name_str.strip_suffix(".jsonl") {
                        game_ids.push(game_id.to_string());
                    }
                }
            }
            
            Ok(game_ids)
        }
        _ => {
            anyhow::bail!("不支持的向量数据库模式: {}", vdb_config.mode);
        }
    }
}

/// 获取游戏最新的 Wiki JSONL 文件路径
#[tauri::command]
pub async fn get_latest_wiki_jsonl(game_id: String) -> Result<String, String> {
    get_latest_wiki_jsonl_impl(game_id)
        .map_err(|e| format!("获取文件路径失败: {}", e))
}

fn get_latest_wiki_jsonl_impl(game_id: String) -> Result<String> {
    // 1. 加载应用配置
    let settings = AppSettings::load()?;
    let base_path = PathBuf::from(&settings.skill_library.storage_base_path);
    
    // 2. 构建游戏目录路径: storage_base_path/game_id
    let game_dir = base_path.join(&game_id);
    
    if !game_dir.exists() {
        anyhow::bail!("游戏目录不存在: {:?}", game_dir);
    }
    
    // 3. 读取所有时间戳目录,找到最新的
    let mut timestamp_dirs: Vec<u64> = Vec::new();
    
    for entry in fs::read_dir(&game_dir)? {
        let entry = entry?;
        let file_name = entry.file_name();
        let file_name_str = file_name.to_string_lossy();
        
        // 尝试解析为时间戳(纯数字目录名)
        if let Ok(timestamp) = file_name_str.parse::<u64>() {
            if entry.path().is_dir() {
                timestamp_dirs.push(timestamp);
            }
        }
    }
    
    if timestamp_dirs.is_empty() {
        anyhow::bail!("未找到任何技能库版本目录");
    }
    
    // 4. 获取最新的时间戳
    timestamp_dirs.sort_unstable();
    let latest_timestamp = timestamp_dirs.last().unwrap();
    
    // 5. 构建 wiki_raw.jsonl 路径
    let jsonl_path = game_dir.join(latest_timestamp.to_string()).join("wiki_raw.jsonl");
    
    if !jsonl_path.exists() {
        anyhow::bail!("wiki_raw.jsonl 文件不存在: {:?}", jsonl_path);
    }
    
    Ok(jsonl_path.to_string_lossy().to_string())
}

/// 自动导入游戏的最新 Wiki 数据
#[tauri::command]
pub async fn auto_import_latest_wiki(game_id: String) -> Result<String, String> {
    auto_import_latest_wiki_impl(game_id)
        .await
        .map_err(|e| format!("自动导入失败: {}", e))
}

async fn auto_import_latest_wiki_impl(game_id: String) -> Result<String> {
    // 1. 获取最新的 JSONL 文件路径
    let jsonl_path = get_latest_wiki_jsonl_impl(game_id.clone())?;
    
    log::info!("📖 自动导入 Wiki: {}", game_id);
    log::info!("   文件: {}", jsonl_path);
    
    // 2. 调用现有的导入逻辑
    import_wiki_to_vector_db_impl(jsonl_path, game_id).await
}

/// Wiki 搜索结果
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WikiSearchResult {
    /// 相似度分数 (0-1)
    pub score: f32,
    /// 条目 ID
    pub id: String,
    /// 标题
    pub title: String,
    /// 内容
    pub content: String,
    /// URL
    pub url: String,
    /// 分类
    pub categories: Vec<String>,
}

/// 向量数据库统计信息
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VectorDBStats {
    /// 集合是否存在
    pub exists: bool,
    /// 向量数量
    pub vectors_count: u64,
    /// 点数量
    pub points_count: u64,
    /// 游戏 ID
    pub game_id: String,
}
