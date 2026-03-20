#Requires -Version 5.1
<#
.SYNOPSIS
    Npcap SDK をダウンロード・展開し、環境変数 NPCAP_SDK_DIR をセットする。
.DESCRIPTION
    build.rs が NPCAP_SDK_DIR を読んで cargo:rustc-link-search を出力するため、
    このスクリプトでローカル開発環境を準備する。
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ---------------------------------------------------------------------------
# 設定値（変更が必要な場合はここを編集）
# ---------------------------------------------------------------------------
$SdkVersion   = "1.13"
$SdkUrl       = "https://npcap.com/dist/npcap-sdk-$SdkVersion.zip"
$InstallPath  = "C:\npcap-sdk"
$EnvVarName   = "NPCAP_SDK_DIR"
$ZipPath      = Join-Path $env:TEMP "npcap-sdk-$SdkVersion.zip"

# ---------------------------------------------------------------------------
# メイン処理
# ---------------------------------------------------------------------------
function Main {
    # 既にインストール済みか確認
    if (Test-Path $InstallPath) {
        Write-Host "[INFO] $InstallPath は既に存在します。"
        $answer = Read-Host "上書きしますか？ (y/N)"
        if ($answer -ne "y") {
            Write-Host "[INFO] スキップしました。"
            Set-EnvVar
            return
        }
        Remove-Item -Recurse -Force $InstallPath
        Write-Host "[INFO] 既存ディレクトリを削除しました。"
    }

    # ダウンロード
    Write-Host "[INFO] Npcap SDK $SdkVersion をダウンロード中..."
    try {
        Invoke-WebRequest -Uri $SdkUrl -OutFile $ZipPath -UseBasicParsing
    }
    catch {
        Write-Error "[ERROR] ダウンロードに失敗しました: $_"
        exit 1
    }

    if (-not (Test-Path $ZipPath)) {
        Write-Error "[ERROR] ZIPファイルが見つかりません: $ZipPath"
        exit 1
    }

    # 展開
    Write-Host "[INFO] $InstallPath に展開中..."
    try {
        Expand-Archive -Path $ZipPath -DestinationPath $InstallPath -Force
    }
    catch {
        Write-Error "[ERROR] 展開に失敗しました: $_"
        exit 1
    }

    # ZIPファイルを削除
    Remove-Item -Force $ZipPath -ErrorAction SilentlyContinue

    # 環境変数をセット
    Set-EnvVar

    Write-Host ""
    Write-Host "[SUCCESS] Npcap SDK $SdkVersion のセットアップが完了しました。"
    Write-Host "  インストール先 : $InstallPath"
    Write-Host "  環境変数       : $EnvVarName = $InstallPath"
    Write-Host ""
    Write-Host "※ 新しいターミナルを開くと環境変数が反映されます。"
}

function Set-EnvVar {
    $currentValue = [System.Environment]::GetEnvironmentVariable($EnvVarName, "User")
    if ($currentValue -eq $InstallPath) {
        Write-Host "[INFO] 環境変数 $EnvVarName は既に設定済みです。"
        return
    }
    [System.Environment]::SetEnvironmentVariable($EnvVarName, $InstallPath, "User")
    # 現在のセッションにも反映
    $env:NPCAP_SDK_DIR = $InstallPath
    Write-Host "[INFO] ユーザー環境変数 $EnvVarName を $InstallPath に設定しました。"
}

Main
