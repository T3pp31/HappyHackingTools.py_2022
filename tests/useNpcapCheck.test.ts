import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

/**
 * テスト観点表（等価分割・境界値）
 *
 * | # | 観点               | 入力/条件                        | 期待結果                             | 種別     |
 * |---|-------------------|--------------------------------|-------------------------------------|---------|
 * | 1 | 初期状態            | hook初期化直後                    | showDialog=false, downloadUrl=""     | 正常系   |
 * | 2 | Npcap利用可能       | invoke → {available:true}        | onAvailableが呼ばれる、ダイアログ非表示 | 正常系   |
 * | 3 | Npcap未インストール   | invoke → {available:false, url}  | showDialog=true, downloadUrl設定      | 正常系   |
 * | 4 | invokeエラー        | invoke → throw Error             | onAvailableが呼ばれる（フォールバック）  | 異常系   |
 * | 5 | closeDialog        | showDialog=true → closeDialog()  | showDialog=false                     | 正常系   |
 * | 6 | 空URL返却           | invoke → {available:false, ""}   | showDialog=true, downloadUrl=""       | 境界値   |
 */

// Tauri invokeのモック
const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

// モック設定後にhookをインポート
const { useNpcapCheck } = await import("../src/hooks/useNpcapCheck");

describe("useNpcapCheck", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- 正常系 ---

  it("初期状態ではshowDialogがfalse、downloadUrlが空文字であること", () => {
    // Given: hookが初期化される
    // When: 初期状態を確認する
    // Then: showDialog=false, downloadUrl=""
    const { result } = renderHook(() => useNpcapCheck());
    expect(result.current.showDialog).toBe(false);
    expect(result.current.downloadUrl).toBe("");
  });

  it("Npcapが利用可能な場合、onAvailableコールバックが実行されること", async () => {
    // Given: invokeが{available: true}を返す
    mockInvoke.mockResolvedValue({ available: true, download_url: "" });
    const onAvailable = vi.fn();

    // When: checkAndExecuteを呼ぶ
    const { result } = renderHook(() => useNpcapCheck());
    await act(async () => {
      await result.current.checkAndExecute(onAvailable);
    });

    // Then: onAvailableが1回呼ばれ、ダイアログは表示されない
    expect(onAvailable).toHaveBeenCalledTimes(1);
    expect(result.current.showDialog).toBe(false);
  });

  it("Npcapが利用可能な場合、invokeが'check_npcap'で呼ばれること", async () => {
    // Given: invokeが{available: true}を返す
    mockInvoke.mockResolvedValue({ available: true, download_url: "" });

    // When: checkAndExecuteを呼ぶ
    const { result } = renderHook(() => useNpcapCheck());
    await act(async () => {
      await result.current.checkAndExecute(vi.fn());
    });

    // Then: invokeが'check_npcap'で呼ばれている
    expect(mockInvoke).toHaveBeenCalledWith("check_npcap");
  });

  it("Npcap未インストールの場合、ダイアログが表示されダウンロードURLが設定されること", async () => {
    // Given: invokeが{available: false}を返す
    const testUrl = "https://npcap.com/#download";
    mockInvoke.mockResolvedValue({ available: false, download_url: testUrl });
    const onAvailable = vi.fn();

    // When: checkAndExecuteを呼ぶ
    const { result } = renderHook(() => useNpcapCheck());
    await act(async () => {
      await result.current.checkAndExecute(onAvailable);
    });

    // Then: ダイアログが表示され、URLが設定され、onAvailableは呼ばれない
    expect(result.current.showDialog).toBe(true);
    expect(result.current.downloadUrl).toBe(testUrl);
    expect(onAvailable).not.toHaveBeenCalled();
  });

  it("closeDialogを呼ぶとshowDialogがfalseになること", async () => {
    // Given: ダイアログが表示されている状態
    mockInvoke.mockResolvedValue({
      available: false,
      download_url: "https://npcap.com",
    });
    const { result } = renderHook(() => useNpcapCheck());
    await act(async () => {
      await result.current.checkAndExecute(vi.fn());
    });
    expect(result.current.showDialog).toBe(true);

    // When: closeDialogを呼ぶ
    act(() => {
      result.current.closeDialog();
    });

    // Then: showDialogがfalseになる
    expect(result.current.showDialog).toBe(false);
  });

  // --- 異常系 ---

  it("invokeがエラーを投げた場合、onAvailableが呼ばれること（フォールバック）", async () => {
    // Given: invokeがエラーを投げる
    mockInvoke.mockRejectedValue(new Error("Network error"));
    const onAvailable = vi.fn();

    // When: checkAndExecuteを呼ぶ
    const { result } = renderHook(() => useNpcapCheck());
    await act(async () => {
      await result.current.checkAndExecute(onAvailable);
    });

    // Then: onAvailableが呼ばれ、ダイアログは表示されない
    expect(onAvailable).toHaveBeenCalledTimes(1);
    expect(result.current.showDialog).toBe(false);
  });

  it("invokeがundefinedを投げた場合でも、onAvailableが呼ばれること", async () => {
    // Given: invokeがundefinedで拒否される
    mockInvoke.mockRejectedValue(undefined);
    const onAvailable = vi.fn();

    // When: checkAndExecuteを呼ぶ
    const { result } = renderHook(() => useNpcapCheck());
    await act(async () => {
      await result.current.checkAndExecute(onAvailable);
    });

    // Then: onAvailableが呼ばれる
    expect(onAvailable).toHaveBeenCalledTimes(1);
  });

  // --- 境界値 ---

  it("download_urlが空文字の場合でもダイアログが表示されること", async () => {
    // Given: invokeが空URLで{available: false}を返す
    mockInvoke.mockResolvedValue({ available: false, download_url: "" });
    const onAvailable = vi.fn();

    // When: checkAndExecuteを呼ぶ
    const { result } = renderHook(() => useNpcapCheck());
    await act(async () => {
      await result.current.checkAndExecute(onAvailable);
    });

    // Then: ダイアログが表示され、downloadUrlは空文字
    expect(result.current.showDialog).toBe(true);
    expect(result.current.downloadUrl).toBe("");
    expect(onAvailable).not.toHaveBeenCalled();
  });

  it("checkAndExecuteを連続で呼んだ場合、状態が正しく更新されること", async () => {
    // Given: 1回目はNpcap未インストール
    mockInvoke.mockResolvedValueOnce({
      available: false,
      download_url: "https://npcap.com",
    });
    const onAvailable1 = vi.fn();
    const onAvailable2 = vi.fn();

    const { result } = renderHook(() => useNpcapCheck());

    // When: 1回目の呼び出し
    await act(async () => {
      await result.current.checkAndExecute(onAvailable1);
    });
    expect(result.current.showDialog).toBe(true);

    // 2回目はNpcap利用可能
    mockInvoke.mockResolvedValueOnce({
      available: true,
      download_url: "",
    });

    // When: 2回目の呼び出し
    await act(async () => {
      await result.current.checkAndExecute(onAvailable2);
    });

    // Then: 2回目のonAvailableが呼ばれる
    expect(onAvailable1).not.toHaveBeenCalled();
    expect(onAvailable2).toHaveBeenCalledTimes(1);
  });
});
