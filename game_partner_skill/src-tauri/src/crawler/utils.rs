use regex::Regex;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};

/// 清洗 HTML 文本
pub fn clean_html_text(text: &str) -> String {
    // 移除多余空白
    let re_whitespace = Regex::new(r"\s+").unwrap();
    let text = re_whitespace.replace_all(text, " ");

    // 移除特殊字符
    let text = text.trim();

    // 移除 Wiki 引用标记 [1], [2] 等
    let re_refs = Regex::new(r"\[\d+\]").unwrap();
    let text = re_refs.replace_all(&text, "");

    text.to_string()
}

/// 提取主要内容（移除导航、侧边栏等）
pub fn extract_main_content(html: &str) -> String {
    // 简化版本：移除常见的非内容标签
    let re_script = Regex::new(r"<script[^>]*>.*?</script>").unwrap();
    let html = re_script.replace_all(html, "");

    let re_style = Regex::new(r"<style[^>]*>.*?</style>").unwrap();
    let html = re_style.replace_all(&html, "");

    let re_nav = Regex::new(r"<nav[^>]*>.*?</nav>").unwrap();
    let html = re_nav.replace_all(&html, "");

    html.to_string()
}

/// 计算内容哈希
pub fn calculate_hash(content: &str) -> String {
    let mut hasher = DefaultHasher::new();
    content.hash(&mut hasher);
    format!("{:x}", hasher.finish())
}

/// 判断 URL 是否有效
pub fn is_valid_url(url: &str) -> bool {
    url::Url::parse(url).is_ok()
}

/// 规范化 URL（移除片段、查询参数等）
pub fn normalize_url(url: &str) -> String {
    if let Ok(mut parsed) = url::Url::parse(url) {
        parsed.set_fragment(None);
        parsed.to_string()
    } else {
        url.to_string()
    }
}

/// 判断是否为内部链接
pub fn is_internal_link(base_url: &str, link: &str) -> bool {
    if let (Ok(base), Ok(link_url)) = (url::Url::parse(base_url), url::Url::parse(link)) {
        base.domain() == link_url.domain()
    } else {
        false
    }
}

/// 分段文本（用于向量化）
pub fn split_into_chunks(text: &str, max_chunk_size: usize, overlap: usize) -> Vec<String> {
    let words: Vec<&str> = text.split_whitespace().collect();
    let mut chunks = Vec::new();
    let mut start = 0;

    while start < words.len() {
        let end = (start + max_chunk_size).min(words.len());
        let chunk = words[start..end].join(" ");
        chunks.push(chunk);

        if end >= words.len() {
            break;
        }

        start += max_chunk_size - overlap;
    }

    chunks
}

/// 清理 Wiki 标记语法，转换为纯文本
pub fn clean_wiki_markup(text: &str) -> String {
    let mut result = text.to_string();

    // 1. 移除 <ref> 标签
    let re_ref = Regex::new(r"<ref[^>]*>.*?</ref>").unwrap();
    result = re_ref.replace_all(&result, "").to_string();

    // 2. 移除 HTML 注释
    let re_comment = Regex::new(r"<!--.*?-->").unwrap();
    result = re_comment.replace_all(&result, "").to_string();

    // 3. 移除文件/图片链接 [[File:...]] [[Image:...]]
    let re_file = Regex::new(r"\[\[(File|Image):[^\]]+\]\]").unwrap();
    result = re_file.replace_all(&result, "").to_string();

    // 4. 处理内部链接 [[Link|Text]] -> Text 或 [[Link]] -> Link
    let re_link = Regex::new(r"\[\[([^\]|]+)\|([^\]]+)\]\]").unwrap();
    result = re_link.replace_all(&result, "$2").to_string();
    let re_simple_link = Regex::new(r"\[\[([^\]]+)\]\]").unwrap();
    result = re_simple_link.replace_all(&result, "$1").to_string();

    // 5. 移除外部链接 [http://... Text] -> Text
    let re_external = Regex::new(r"\[https?://[^\s\]]+ ([^\]]+)\]").unwrap();
    result = re_external.replace_all(&result, "$1").to_string();
    let re_bare_url = Regex::new(r"\[https?://[^\]]+\]").unwrap();
    result = re_bare_url.replace_all(&result, "").to_string();

    // 6. 移除模板 {{...}}
    let re_template = Regex::new(r"\{\{[^\}]+\}\}").unwrap();
    result = re_template.replace_all(&result, "").to_string();

    // 7. 移除粗体/斜体 '''text''' -> text, ''text'' -> text
    result = result.replace("'''", "").replace("''", "");

    // 8. 移除标题标记 == Title == -> Title
    let re_heading = Regex::new(r"^=+\s*(.+?)\s*=+$").unwrap();
    result = re_heading.replace_all(&result, "$1").to_string();

    // 9. 移除多余空白
    let re_whitespace = Regex::new(r"\s+").unwrap();
    result = re_whitespace.replace_all(&result, " ").to_string();

    // 10. 移除 Wiki 引用标记 [1], [2] 等
    let re_refs = Regex::new(r"\[\d+\]").unwrap();
    result = re_refs.replace_all(&result, "").to_string();

    result.trim().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_clean_html_text() {
        let dirty = "  Hello   World  [1]  ";
        let clean = clean_html_text(dirty);
        assert_eq!(clean, "Hello World");
    }

    #[test]
    fn test_calculate_hash() {
        let content = "test content";
        let hash = calculate_hash(content);
        assert!(!hash.is_empty());
    }

    #[test]
    fn test_split_into_chunks() {
        let text = "one two three four five six seven eight nine ten";
        let chunks = split_into_chunks(text, 3, 1);
        assert!(chunks.len() > 1);
        assert_eq!(chunks[0], "one two three");
    }

    #[test]
    fn test_clean_wiki_markup() {
        let wiki_text = r#"
        == 标题 ==
        这是一个测试文本，包含 [[File:example.jpg]] 和 [[链接|可点击的文本]]。
        还有一些引用标记[1][2]以及HTML注释<!-- 这是一个注释 -->。
        "#;

        let clean_text = clean_wiki_markup(wiki_text);
        assert!(!clean_text.contains("=="));
        assert!(!clean_text.contains("[["));
        assert!(!clean_text.contains("]]"));
        assert!(!clean_text.contains("<!--"));
        assert!(!clean_text.contains("-->"));
    }
}
