use crate::settings::AppSettings;
use crate::vector_db::{LocalVectorDB, VectorDB};
use anyhow::Result;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct VectorDBTestResult {
    pub success: bool,
    pub message: String,
    pub mode: String,
}

/// 测试向量数据库连接
#[tauri::command]
pub async fn test_vector_db_connection() -> Result<VectorDBTestResult, String> {
    test_vector_db_connection_impl()
        .await
        .map_err(|e| format!("测试失败: {}", e))
}

async fn test_vector_db_connection_impl() -> Result<VectorDBTestResult> {
    let settings = AppSettings::load()?;
    let vdb_config = &settings.ai_models.vector_db;

    match vdb_config.mode.as_str() {
        "local" => {
            // 测试本地数据库
            let storage_path = vdb_config
                .local_storage_path
                .as_ref()
                .map(|p| std::path::PathBuf::from(p))
                .unwrap_or_else(|| std::path::PathBuf::from("./data/vector_db"));

            std::fs::create_dir_all(&storage_path)?;
            let _db = LocalVectorDB::new(storage_path.clone(), "test_collection")?;

            // 创建测试集合
            _db.create_collection(384)?;

            // 插入测试数据
            let test_vector = vec![0.1; 384];
            let test_payload = serde_json::json!({ "test": "data" });
            _db.upsert_points(vec![(1, test_vector.clone(), test_payload)])?;

            // 搜索测试
            let results = _db.search(test_vector, 1)?;

            // 清理测试数据
            _db.delete_collection()?;

            Ok(VectorDBTestResult {
                success: true,
                message: format!(
                    "✅ 本地向量数据库正常！\n存储路径: {}\n测试搜索返回: {} 条结果",
                    storage_path.display(),
                    results.len()
                ),
                mode: "local".to_string(),
            })
        }
        "qdrant" => {
            // 测试 Qdrant 连接
            let url = vdb_config
                .qdrant_url
                .as_ref()
                .ok_or_else(|| anyhow::anyhow!("未配置 Qdrant URL"))?;

            let db = VectorDB::new(url, "test_collection").await?;

            Ok(VectorDBTestResult {
                success: true,
                message: format!("✅ Qdrant 连接成功！\n服务器: {}", url),
                mode: "qdrant".to_string(),
            })
        }
        "ai_direct" => {
            // AI 直接检索不需要测试连接
            Ok(VectorDBTestResult {
                success: true,
                message: "✅ AI 直接检索模式已启用！\n此模式不需要向量数据库，将直接使用文本匹配。"
                    .to_string(),
                mode: "ai_direct".to_string(),
            })
        }
        _ => Err(anyhow::anyhow!(
            "不支持的向量数据库模式: {}",
            vdb_config.mode
        )),
    }
}
