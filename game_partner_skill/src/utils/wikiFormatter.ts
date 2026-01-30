/**
 * 将 MediaWiki 格式转换为 Markdown 格式
 */
export function convertWikiToMarkdown(wikiText: string): string {
  let markdown = wikiText;

  // 1. 标题转换: == Title == -> ## Title
  // 注意: MediaWiki 标题可能不在行首,需要匹配任意位置
  markdown = markdown.replace(/======\s*(.+?)\s*======/g, '\n###### $1\n');
  markdown = markdown.replace(/=====\s*(.+?)\s*=====/g, '\n##### $1\n');
  markdown = markdown.replace(/====\s*(.+?)\s*====/g, '\n#### $1\n');
  markdown = markdown.replace(/===\s*(.+?)\s*===/g, '\n### $1\n');
  markdown = markdown.replace(/==\s*(.+?)\s*==/g, '\n## $1\n');

  // 2. 粗体: '''text''' -> **text**
  markdown = markdown.replace(/'''(.+?)'''/g, '**$1**');

  // 3. 斜体: ''text'' -> *text*
  markdown = markdown.replace(/''(.+?)''/g, '*$1*');

  // 4. 内部链接: [[Link]] 或 [[Link|Text]]
  markdown = markdown.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '[$2](#)');
  markdown = markdown.replace(/\[\[([^\]]+)\]\]/g, '[$1](#)');

  // 5. 外部链接: [http://example.com Text]
  markdown = markdown.replace(/\[(https?:\/\/[^\s]+)\s+([^\]]+)\]/g, '[$2]($1)');
  markdown = markdown.replace(/\[(https?:\/\/[^\s]+)\]/g, '[$1]($1)');

  // 6. 无序列表: * item -> - item
  markdown = markdown.replace(/^\*+\s+/gm, (match) => {
    const level = match.trim().length - 1;
    return '  '.repeat(level) + '- ';
  });

  // 7. 有序列表: # item -> 1. item
  markdown = markdown.replace(/^#+\s+/gm, (match) => {
    const level = match.trim().length - 1;
    return '  '.repeat(level) + '1. ';
  });

  // 8. 表格转换 (简化)
  // MediaWiki 表格格式: {| ... |- ... | cell ... |}
  // 移除表格标记,只保留内容
  markdown = markdown.replace(/\{\|.*?\n/g, '\n');
  markdown = markdown.replace(/\|\}/g, '');
  markdown = markdown.replace(/^\|-.*$/gm, '');
  markdown = markdown.replace(/^\|\+.*$/gm, '');
  
  // 表头行
  markdown = markdown.replace(/^\!\s*(.+?)$/gm, (_match, content) => {
    const cells = content.split(/\s*!!\s*|\s*\|\|\s*/);
    return '| ' + cells.join(' | ') + ' |';
  });
  
  // 表格数据行
  markdown = markdown.replace(/^\|\s*(.+?)$/gm, (_match, content) => {
    const cells = content.split(/\s*\|\|\s*/);
    return '| ' + cells.join(' | ') + ' |';
  });

  // 9. 模板调用移除: {{template|param}}
  markdown = markdown.replace(/\{\{[^\}]+\}\}/g, '');

  // 10. HTML 注释移除
  markdown = markdown.replace(/<!--.*?-->/gs, '');

  // 11. 分类和文件链接移除
  markdown = markdown.replace(/\[\[Category:.*?\]\]/gi, '');
  markdown = markdown.replace(/\[\[File:.*?\]\]/gi, '');
  markdown = markdown.replace(/\[\[Image:.*?\]\]/gi, '');

  // 12. <ref> 标签移除
  markdown = markdown.replace(/<ref[^>]*>.*?<\/ref>/gs, '');
  markdown = markdown.replace(/<ref[^>]*\/>/g, '');

  // 13. 其他 HTML 标签处理
  markdown = markdown.replace(/<br\s*\/?>/gi, '\n');
  markdown = markdown.replace(/<\/?[^>]+(>|$)/g, '');

  // 14. 清理多余的空行 (保留段落间距)
  markdown = markdown.replace(/\n{4,}/g, '\n\n\n');

  // 15. 清理行首行尾空白
  markdown = markdown.split('\n').map(line => line.trim()).join('\n');

  return markdown.trim();
}

/**
 * 获取文本摘要(前 N 个字符)
 */
export function getTextSummary(text: string, maxLength: number = 200): string {
  // 使用转换后的 Markdown 获取摘要
  const markdown = convertWikiToMarkdown(text);
  
  // 移除 Markdown 标记
  let clean = markdown
    .replace(/^#+\s+/gm, '') // 移除标题标记
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // 链接
    .replace(/\*\*(.+?)\*\*/g, '$1') // 粗体
    .replace(/\*(.+?)\*/g, '$1') // 斜体
    .replace(/^[-*]\s+/gm, '') // 列表
    .replace(/^\d+\.\s+/gm, '') // 有序列表
    .trim();

  if (clean.length <= maxLength) {
    return clean;
  }

  return clean.substring(0, maxLength) + '...';
}
