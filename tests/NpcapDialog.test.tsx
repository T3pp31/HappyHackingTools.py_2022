import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

/**
 * テスト観点表（等価分割・境界値）
 *
 * | # | 観点                 | 入力/条件                          | 期待結果                          | 種別     |
 * |---|---------------------|----------------------------------|----------------------------------|---------|
 * | 1 | 非表示               | visible=false                     | 何もレンダリングされない             | 正常系   |
 * | 2 | 表示                 | visible=true                      | タイトル・メッセージ・ボタンが表示    | 正常系   |
 * | 3 | Closeボタン          | Closeクリック                      | onCloseが呼ばれる                  | 正常系   |
 * | 4 | Downloadボタン       | Downloadクリック                   | open(url)が呼ばれ、onCloseが呼ばれる | 正常系   |
 * | 5 | オーバーレイクリック    | オーバーレイ部分クリック              | onCloseが呼ばれる                  | 正常系   |
 * | 6 | ダイアログ内クリック    | ダイアログ内部クリック               | onCloseが呼ばれない                | 正常系   |
 * | 7 | 空URL                | downloadUrl=""                    | Downloadボタンはopen("")で呼ばれる   | 境界値   |
 * | 8 | open失敗             | openがエラーを投げる                | エラーが発生する                    | 異常系   |
 */

// @tauri-apps/plugin-shellのモック
const mockOpen = vi.fn();
vi.mock("@tauri-apps/plugin-shell", () => ({
  open: (...args: unknown[]) => mockOpen(...args),
}));

// モック設定後にコンポーネントをインポート
const { NpcapDialog } = await import(
  "../src/components/common/NpcapDialog"
);

describe("NpcapDialog", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockOpen.mockResolvedValue(undefined);
  });

  // --- 正常系 ---

  it("visible=falseの場合、何もレンダリングされないこと", () => {
    // Given: visible=false
    // When: コンポーネントをレンダリングする
    const { container } = render(
      <NpcapDialog visible={false} downloadUrl="https://npcap.com" onClose={vi.fn()} />
    );
    // Then: 子要素が存在しない
    expect(container.firstChild).toBeNull();
  });

  it("visible=trueの場合、タイトルが表示されること", () => {
    // Given: visible=true
    // When: コンポーネントをレンダリングする
    render(
      <NpcapDialog visible={true} downloadUrl="https://npcap.com" onClose={vi.fn()} />
    );
    // Then: タイトルが表示される
    expect(screen.getByText("Npcap Required")).toBeTruthy();
  });

  it("visible=trueの場合、説明メッセージが表示されること", () => {
    // Given: visible=true
    // When: コンポーネントをレンダリングする
    render(
      <NpcapDialog visible={true} downloadUrl="https://npcap.com" onClose={vi.fn()} />
    );
    // Then: 説明メッセージが表示される
    expect(
      screen.getByText(/This feature requires Npcap to be installed/)
    ).toBeTruthy();
  });

  it("visible=trueの場合、Download NpcapボタンとCloseボタンが表示されること", () => {
    // Given: visible=true
    // When: コンポーネントをレンダリングする
    render(
      <NpcapDialog visible={true} downloadUrl="https://npcap.com" onClose={vi.fn()} />
    );
    // Then: 両ボタンが表示される
    expect(screen.getByText("Download Npcap")).toBeTruthy();
    expect(screen.getByText("Close")).toBeTruthy();
  });

  it("CloseボタンをクリックするとonCloseが呼ばれること", () => {
    // Given: visible=true, onCloseが設定されている
    const onClose = vi.fn();
    render(
      <NpcapDialog visible={true} downloadUrl="https://npcap.com" onClose={onClose} />
    );

    // When: Closeボタンをクリックする
    fireEvent.click(screen.getByText("Close"));

    // Then: onCloseが1回呼ばれる
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Download Npcapボタンをクリックするとopen(url)が呼ばれ、onCloseが呼ばれること", async () => {
    // Given: visible=true, downloadUrlが設定されている
    const onClose = vi.fn();
    const testUrl = "https://npcap.com/#download";
    render(
      <NpcapDialog visible={true} downloadUrl={testUrl} onClose={onClose} />
    );

    // When: Download Npcapボタンをクリックする
    fireEvent.click(screen.getByText("Download Npcap"));

    // Then: open(url)が呼ばれ、onCloseが呼ばれる
    await vi.waitFor(() => {
      expect(mockOpen).toHaveBeenCalledWith(testUrl);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it("オーバーレイをクリックするとonCloseが呼ばれること", () => {
    // Given: visible=true
    const onClose = vi.fn();
    render(
      <NpcapDialog visible={true} downloadUrl="https://npcap.com" onClose={onClose} />
    );

    // When: オーバーレイ（最外側のdiv）をクリックする
    const overlay = screen.getByText("Npcap Required").closest("div")!.parentElement!;
    fireEvent.click(overlay);

    // Then: onCloseが呼ばれる
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("ダイアログ内部をクリックしてもonCloseが呼ばれないこと", () => {
    // Given: visible=true
    const onClose = vi.fn();
    render(
      <NpcapDialog visible={true} downloadUrl="https://npcap.com" onClose={onClose} />
    );

    // When: ダイアログの内部（タイトル要素）をクリックする
    fireEvent.click(screen.getByText("Npcap Required"));

    // Then: onCloseが呼ばれない（stopPropagation）
    expect(onClose).not.toHaveBeenCalled();
  });

  // --- 境界値 ---

  it("downloadUrlが空文字の場合でもDownloadボタンがopen('')で呼ばれること", async () => {
    // Given: downloadUrl=""
    const onClose = vi.fn();
    render(
      <NpcapDialog visible={true} downloadUrl="" onClose={onClose} />
    );

    // When: Download Npcapボタンをクリックする
    fireEvent.click(screen.getByText("Download Npcap"));

    // Then: open("")が呼ばれる
    await vi.waitFor(() => {
      expect(mockOpen).toHaveBeenCalledWith("");
    });
  });

  // --- 異常系 ---

  it("openがエラーを投げた場合でもonCloseが呼ばれること", async () => {
    // Given: openがエラーを投げる
    mockOpen.mockRejectedValue(new Error("Failed to open"));
    const onClose = vi.fn();
    render(
      <NpcapDialog visible={true} downloadUrl="https://npcap.com" onClose={onClose} />
    );

    // When: Download Npcapボタンをクリックする
    fireEvent.click(screen.getByText("Download Npcap"));

    // Then: openが呼ばれ、エラーが握りつぶされ、onCloseが呼ばれる
    await vi.waitFor(() => {
      expect(mockOpen).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
