/**
 * 应用设置服务
 * 统一管理从后端加载的配置,避免硬编码和数据不一致
 */

import { invoke } from '@tauri-apps/api/core';

// ============= 类型定义 =============

export interface AppSettings {
  general: {
    language: string;
    theme: string;
    hud_mode?: boolean;
  };
  skillLibrary: {
    storageBasePath: string;
    maxVersionsToKeep: number;
    autoUpdate: boolean;
    updateCheckInterval: number;
    crawler: {
      requestDelayMs: number;
      maxConcurrentRequests: number;
      timeoutSeconds: number;
    };
  };
  aiModels: {
    embedding: {
      provider: string;
      apiBase: string;
      apiKey: string | null;
      modelName: string;
      enabled: boolean;
      temperature: number;
      maxTokens: number;
    };
    multimodal: {
      provider: string;
      apiBase: string;
      apiKey: string | null;
      modelName: string;
      enabled: boolean;
      temperature: number;
      maxTokens: number;
    };
    aiPersonality: string;
    vectorDb: {
      mode: string;
      qdrantUrl: string | null;
      localStoragePath: string | null;
    };
  };
  screenshot?: {
    enabled: boolean;
    captureMode: string;
    targetWindowId: number | null;
    targetWindowName: string | null;
    activeIntervalSeconds: number;
    idleIntervalSeconds: number;
    quality: number;
    targetSizeKb: number;
    autoSendToAi: boolean;
  };
  tts?: {
    enabled: boolean;
    provider: string;
    aliyunAccessKey: string | null;
    aliyunAccessSecret: string | null;
    aliyunAppKey: string | null;
    voice: string | null;
    rate: number;
    volume: number;
    autoSpeak: boolean;
  };
}

// 后端返回的原始配置(snake_case)
interface BackendSettings {
  general: {
    language: string;
    theme: string;
    hud_mode?: boolean;
  };
  skill_library: {
    storage_base_path: string;
    max_versions_to_keep: number;
    auto_update: boolean;
    update_check_interval: number;
    crawler: {
      request_delay_ms: number;
      max_concurrent_requests: number;
      timeout_seconds: number;
    };
  };
  ai_models: {
    embedding: {
      provider: string;
      api_base: string;
      api_key: string | null;
      model_name: string;
      enabled: boolean;
      temperature: number;
      max_tokens: number;
    };
    multimodal: {
      provider: string;
      api_base: string;
      api_key: string | null;
      model_name: string;
      enabled: boolean;
      temperature: number;
      max_tokens: number;
    };
    ai_personality: string;
    vector_db: {
      mode: string;
      qdrant_url: string | null;
      local_storage_path: string | null;
    };
  };
  screenshot?: {
    enabled: boolean;
    capture_mode: string;
    target_window_id: number | null;
    target_window_name: string | null;
    active_interval_seconds: number;
    idle_interval_seconds: number;
    quality: number;
    target_size_kb: number;
    auto_send_to_ai: boolean;
  };
  tts?: {
    enabled: boolean;
    provider: string;
    aliyun_access_key: string | null;
    aliyun_access_secret: string | null;
    aliyun_appkey: string | null;
    voice: string | null;
    rate: number;
    volume: number;
    auto_speak: boolean;
  };
}

// ============= 数据转换 =============

/**
 * 将后端的 snake_case 配置转换为前端的 camelCase 配置
 */
export function transformBackendToFrontend(data: BackendSettings): AppSettings {
  return {
    general: data.general || { language: "zh-CN", theme: "auto" },
    skillLibrary: {
      storageBasePath: data.skill_library?.storage_base_path || "./data/skills",
      maxVersionsToKeep: data.skill_library?.max_versions_to_keep || 3,
      autoUpdate: data.skill_library?.auto_update || false,
      updateCheckInterval: data.skill_library?.update_check_interval || 24,
      crawler: {
        requestDelayMs: data.skill_library?.crawler?.request_delay_ms || 1000,
        maxConcurrentRequests: data.skill_library?.crawler?.max_concurrent_requests || 5,
        timeoutSeconds: data.skill_library?.crawler?.timeout_seconds || 30,
      },
    },
    aiModels: {
      embedding: {
        provider: data.ai_models?.embedding?.provider || "local",
        apiBase: data.ai_models?.embedding?.api_base || "http://localhost:11434/v1",
        apiKey: data.ai_models?.embedding?.api_key || null,
        modelName: data.ai_models?.embedding?.model_name || "qwen3-embedding:4b",
        enabled: data.ai_models?.embedding?.enabled !== false,
        temperature: data.ai_models?.embedding?.temperature || 0.0,
        maxTokens: data.ai_models?.embedding?.max_tokens || 512,
      },
      multimodal: {
        provider: data.ai_models?.multimodal?.provider || "openai",
        apiBase: data.ai_models?.multimodal?.api_base || "https://api.openai.com/v1",
        apiKey: data.ai_models?.multimodal?.api_key || null,
        modelName: data.ai_models?.multimodal?.model_name || "gpt-4o-mini",
        enabled: data.ai_models?.multimodal?.enabled !== false,
        temperature: data.ai_models?.multimodal?.temperature || 0.7,
        maxTokens: data.ai_models?.multimodal?.max_tokens || 1000,
      },
      aiPersonality: data.ai_models?.ai_personality || "sunnyou_male",
      vectorDb: {
        mode: data.ai_models?.vector_db?.mode || "local",
        qdrantUrl: data.ai_models?.vector_db?.qdrant_url || "http://localhost:6333",
        localStoragePath: data.ai_models?.vector_db?.local_storage_path || "./data/vector_db",
      },
    },
    screenshot: data.screenshot
      ? {
          enabled: data.screenshot.enabled,
          captureMode: data.screenshot.capture_mode,
          targetWindowId: data.screenshot.target_window_id || null,
          targetWindowName: data.screenshot.target_window_name || null,
          activeIntervalSeconds: data.screenshot.active_interval_seconds,
          idleIntervalSeconds: data.screenshot.idle_interval_seconds,
          quality: data.screenshot.quality,
          targetSizeKb: data.screenshot.target_size_kb,
          autoSendToAi: data.screenshot.auto_send_to_ai,
        }
      : undefined,
    tts: data.tts
      ? {
          enabled: data.tts.enabled,
          provider: data.tts.provider || "windows",
          aliyunAccessKey: data.tts.aliyun_access_key || null,
          aliyunAccessSecret: data.tts.aliyun_access_secret || null,
          aliyunAppKey: data.tts.aliyun_appkey || null,
          voice: data.tts.voice || null,
          rate: data.tts.rate || 1.0,
          volume: data.tts.volume || 0.8,
          autoSpeak: data.tts.auto_speak !== false,
        }
      : undefined,
  };
}

/**
 * 将前端的 camelCase 配置转换为后端的 snake_case 配置
 */
export function transformFrontendToBackend(values: AppSettings): BackendSettings {
  return {
    general: values.general,
    skill_library: {
      storage_base_path: values.skillLibrary.storageBasePath,
      max_versions_to_keep: values.skillLibrary.maxVersionsToKeep,
      auto_update: values.skillLibrary.autoUpdate,
      update_check_interval: values.skillLibrary.updateCheckInterval,
      crawler: {
        request_delay_ms: values.skillLibrary.crawler.requestDelayMs,
        max_concurrent_requests: values.skillLibrary.crawler.maxConcurrentRequests,
        timeout_seconds: values.skillLibrary.crawler.timeoutSeconds,
      },
    },
    ai_models: {
      embedding: {
        provider: values.aiModels.embedding.provider,
        api_base: values.aiModels.embedding.apiBase,
        api_key: values.aiModels.embedding.apiKey || null,
        model_name: values.aiModels.embedding.modelName,
        enabled: values.aiModels.embedding.enabled,
        temperature: values.aiModels.embedding.temperature || 0.0,
        max_tokens: values.aiModels.embedding.maxTokens || 512,
      },
      multimodal: {
        provider: values.aiModels.multimodal.provider,
        api_base: values.aiModels.multimodal.apiBase,
        api_key: values.aiModels.multimodal.apiKey || null,
        model_name: values.aiModels.multimodal.modelName,
        enabled: values.aiModels.multimodal.enabled,
        temperature: values.aiModels.multimodal.temperature || 0.7,
        max_tokens: values.aiModels.multimodal.maxTokens || 1000,
      },
      ai_personality: values.aiModels.aiPersonality || "sunnyou_male",
      vector_db: {
        mode: values.aiModels.vectorDb.mode,
        qdrant_url: values.aiModels.vectorDb.qdrantUrl || null,
        local_storage_path: values.aiModels.vectorDb.localStoragePath || null,
      },
    },
    screenshot: values.screenshot
      ? {
          enabled: values.screenshot.enabled,
          capture_mode: values.screenshot.captureMode,
          target_window_id: values.screenshot.targetWindowId || null,
          target_window_name: values.screenshot.targetWindowName || null,
          active_interval_seconds: values.screenshot.activeIntervalSeconds,
          idle_interval_seconds: values.screenshot.idleIntervalSeconds,
          quality: values.screenshot.quality,
          target_size_kb: values.screenshot.targetSizeKb,
          auto_send_to_ai: values.screenshot.autoSendToAi,
        }
      : undefined,
    tts: values.tts
      ? {
          enabled: values.tts.enabled,
          provider: values.tts.provider || "windows",
          aliyun_access_key: values.tts.aliyunAccessKey || null,
          aliyun_access_secret: values.tts.aliyunAccessSecret || null,
          aliyun_appkey: values.tts.aliyunAppKey || null,
          voice: values.tts.voice || null,
          rate: values.tts.rate || 1.0,
          volume: values.tts.volume || 0.8,
          auto_speak: values.tts.autoSpeak !== false,
        }
      : undefined,
  };
}

// ============= API 调用 =============

/**
 * 从后端加载应用设置
 */
export async function loadAppSettings(): Promise<AppSettings> {
  try {
    const data = await invoke<BackendSettings>("get_app_settings");
    return transformBackendToFrontend(data);
  } catch (error) {
    console.error("加载应用设置失败:", error);
    throw error;
  }
}

/**
 * 保存应用设置到后端
 */
export async function saveAppSettings(settings: AppSettings): Promise<void> {
  try {
    const backendData = transformFrontendToBackend(settings);
    await invoke("save_app_settings", { settings: backendData });
  } catch (error) {
    console.error("保存应用设置失败:", error);
    throw error;
  }
}

/**
 * 重置为默认设置
 */
export async function resetAppSettings(): Promise<AppSettings> {
  try {
    const data = await invoke<BackendSettings>("reset_app_settings");
    return transformBackendToFrontend(data);
  } catch (error) {
    console.error("重置应用设置失败:", error);
    throw error;
  }
}

// ============= 便捷访问器 =============

/**
 * 只获取技能库配置
 */
export async function getSkillLibraryConfig() {
  const settings = await loadAppSettings();
  return settings.skillLibrary;
}

/**
 * 只获取 AI 模型配置
 */
export async function getAiModelsConfig() {
  const settings = await loadAppSettings();
  return settings.aiModels;
}

/**
 * 只获取截图配置
 */
export async function getScreenshotConfig() {
  const settings = await loadAppSettings();
  return settings.screenshot;
}

/**
 * 只获取 TTS 配置
 */
export async function getTtsConfig() {
  const settings = await loadAppSettings();
  return settings.tts;
}
