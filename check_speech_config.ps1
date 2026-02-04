# Windows 语音识别快速诊断脚本
# 运行此脚本检查语音识别配置状态

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Windows 语音识别配置诊断工具" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查 Windows 版本
Write-Host "1️⃣ 检查 Windows 版本..." -ForegroundColor Yellow
$osVersion = [System.Environment]::OSVersion.Version
Write-Host "   版本: $($osVersion.Major).$($osVersion.Minor).$($osVersion.Build)" -ForegroundColor Green

if ($osVersion.Build -lt 18362) {
    Write-Host "   ⚠️  警告: Windows 版本过低，建议升级到 Windows 10 1903 或更高" -ForegroundColor Red
} else {
    Write-Host "   ✅ Windows 版本符合要求" -ForegroundColor Green
}
Write-Host ""

# 检查语音识别服务
Write-Host "2️⃣ 检查语音识别服务..." -ForegroundColor Yellow
try {
    $speechService = Get-Service -Name "SpeechRuntime" -ErrorAction SilentlyContinue
    if ($null -eq $speechService) {
        Write-Host "   ⚠️  语音识别服务未找到" -ForegroundColor Red
    } else {
        Write-Host "   服务状态: $($speechService.Status)" -ForegroundColor Green
        if ($speechService.Status -ne "Running") {
            Write-Host "   ⚠️  服务未运行，尝试启动..." -ForegroundColor Yellow
            Start-Service -Name "SpeechRuntime"
            Write-Host "   ✅ 服务已启动" -ForegroundColor Green
        } else {
            Write-Host "   ✅ 服务正常运行" -ForegroundColor Green
        }
    }
} catch {
    Write-Host "   ℹ️  无法检查服务状态（可能不存在）" -ForegroundColor Gray
}
Write-Host ""

# 检查麦克风设备
Write-Host "3️⃣ 检查麦克风设备..." -ForegroundColor Yellow
try {
    Add-Type -AssemblyName System.Speech
    $recognizer = New-Object System.Speech.Recognition.SpeechRecognitionEngine
    $audioDevices = $recognizer.AudioFormat
    Write-Host "   ✅ 检测到音频设备" -ForegroundColor Green
    $recognizer.Dispose()
} catch {
    Write-Host "   ⚠️  无法检测音频设备: $_" -ForegroundColor Red
}
Write-Host ""

# 检查已安装的语言包
Write-Host "4️⃣ 检查已安装的语言包..." -ForegroundColor Yellow
$installedLanguages = Get-WinUserLanguageList
$hasChinese = $false
foreach ($lang in $installedLanguages) {
    if ($lang.LanguageTag -like "zh-*") {
        Write-Host "   ✅ 已安装中文语言包: $($lang.LanguageTag)" -ForegroundColor Green
        $hasChinese = $true
    }
}
if (-not $hasChinese) {
    Write-Host "   ⚠️  未检测到中文语言包" -ForegroundColor Red
}
Write-Host ""

# 检查语音隐私设置（需要注册表）
Write-Host "5️⃣ 检查语音隐私设置..." -ForegroundColor Yellow
try {
    $onlineSpeechPath = "HKCU:\Software\Microsoft\Speech_OneCore\Settings\OnlineSpeechPrivacy"
    if (Test-Path $onlineSpeechPath) {
        $hasAccepted = Get-ItemProperty -Path $onlineSpeechPath -Name "HasAccepted" -ErrorAction SilentlyContinue
        if ($null -ne $hasAccepted -and $hasAccepted.HasAccepted -eq 1) {
            Write-Host "   ✅ 语音隐私策略已接受" -ForegroundColor Green
        } else {
            Write-Host "   ⚠️  语音隐私策略未接受" -ForegroundColor Red
            Write-Host "   📌 请手动启用:" -ForegroundColor Yellow
            Write-Host "      1. 打开 Windows 设置 (Win + I)" -ForegroundColor White
            Write-Host "      2. 隐私和安全性 > 语音" -ForegroundColor White
            Write-Host "      3. 打开 '联机语音识别' 开关" -ForegroundColor White
        }
    } else {
        Write-Host "   ⚠️  无法检测隐私设置（可能未配置）" -ForegroundColor Red
        Write-Host "   📌 请手动启用 Windows 语音识别" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ℹ️  无法读取注册表设置" -ForegroundColor Gray
}
Write-Host ""

# 测试语音识别引擎
Write-Host "6️⃣ 测试语音识别引擎..." -ForegroundColor Yellow
try {
    Add-Type -AssemblyName System.Speech
    $recognizer = New-Object System.Speech.Recognition.SpeechRecognitionEngine
    $recognizer.SetInputToDefaultAudioDevice()
    Write-Host "   ✅ 语音识别引擎可用" -ForegroundColor Green
    $recognizer.Dispose()
} catch {
    Write-Host "   ❌ 语音识别引擎初始化失败" -ForegroundColor Red
    Write-Host "   错误: $_" -ForegroundColor Red
    
    if ($_.Exception.Message -like "*0x80045509*") {
        Write-Host "" -ForegroundColor Yellow
        Write-Host "   🔧 检测到错误码 0x80045509 (隐私策略未接受)" -ForegroundColor Yellow
        Write-Host "   " -ForegroundColor Yellow
        Write-Host "   立即修复步骤:" -ForegroundColor Cyan
        Write-Host "   ────────────────────────────────────────" -ForegroundColor Cyan
        Write-Host "   1. 按 Win + I 打开设置" -ForegroundColor White
        Write-Host "   2. 点击 '隐私和安全性'" -ForegroundColor White
        Write-Host "   3. 点击 '语音'" -ForegroundColor White
        Write-Host "   4. 打开 '联机语音识别' 开关" -ForegroundColor White
        Write-Host "   5. 关闭并重新启动你的应用" -ForegroundColor White
        Write-Host "   ────────────────────────────────────────" -ForegroundColor Cyan
    }
}
Write-Host ""

# 总结
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  诊断完成" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📖 详细设置指南: WINDOWS_SPEECH_SETUP.md" -ForegroundColor Cyan
Write-Host "🧪 测试指南: VOICE_TEST_GUIDE.md" -ForegroundColor Cyan
Write-Host ""

# 提供快捷操作
Write-Host "快捷操作:" -ForegroundColor Yellow
Write-Host "  [1] 打开 Windows 语音设置" -ForegroundColor White
Write-Host "  [2] 打开语言设置" -ForegroundColor White
Write-Host "  [3] 重启语音服务" -ForegroundColor White
Write-Host "  [Q] 退出" -ForegroundColor White
Write-Host ""

$choice = Read-Host "请选择"
switch ($choice) {
    "1" {
        Start-Process "ms-settings:privacy-speech"
    }
    "2" {
        Start-Process "ms-settings:regionlanguage"
    }
    "3" {
        try {
            Restart-Service -Name "SpeechRuntime" -Force
            Write-Host "✅ 语音服务已重启" -ForegroundColor Green
        } catch {
            Write-Host "⚠️  无法重启服务: $_" -ForegroundColor Red
        }
    }
    default {
        Write-Host "退出" -ForegroundColor Gray
    }
}
