import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { NpcapDialog } from "../src/components/common/NpcapDialog";

/**
 * テスト観点表（等価分割・境界値）
 *
 * | # | 観点                 | 入力/条件                          | 期待結果                                        | 種別     |
 * |---|---------------------|----------------------------------|-------------------------------------------------|---------|
 * | 1 | 非表示               | visible=false                     | 何もレンダリングされない                           | 正常系   |
 * | 2 | 表示                 | visible=true                      | タイトル・メッセージ・リンク・ボタンが表示            | 正常系   |
 * | 3 | Closeボタン          | Closeクリック                      | onCloseが呼ばれる                                | 正常系   |
 * | 4 | ダウンロードリンク     | visible=true                      | <a>にhref,target,relが正しく設定される              | 正常系   |
 * | 5 | オーバーレイクリック    | オーバーレイ部分クリック              | onCloseが呼ばれる                                | 正常系   |
 * | 6 | ダイアログ内クリック    | ダイアログ内部クリック               | onCloseが呼ばれない                              | 正常系   |
 * | 7 | 空URL                | downloadUrl=""                    | リンクのhrefが空文字で表示される                    | 境界値   |
 */

describe("NpcapDialog", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
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

  it("visible=trueの場合、ダウンロードリンクとCloseボタンが表示されること", () => {
    // Given: visible=true
    // When: コンポーネントをレンダリングする
    const testUrl = "https://npcap.com";
    render(
      <NpcapDialog visible={true} downloadUrl={testUrl} onClose={vi.fn()} />
    );
    // Then: URLリンクとCloseボタンが表示される
    const link = screen.getByRole("link", { name: testUrl });
    expect(link).toBeTruthy();
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

  it("ダウンロードリンクにhref、target、relが正しく設定されていること", () => {
    // Given: visible=true, downloadUrlが設定されている
    const testUrl = "https://npcap.com/#download";
    render(
      <NpcapDialog visible={true} downloadUrl={testUrl} onClose={vi.fn()} />
    );

    // When: リンク要素を取得する
    const link = screen.getByRole("link", { name: testUrl });

    // Then: href, target, relが正しく設定されている
    expect(link.getAttribute("href")).toBe(testUrl);
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
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

  it("downloadUrlが空文字の場合でもリンクが空のhrefで表示されること", () => {
    // Given: downloadUrl=""
    const { container } = render(
      <NpcapDialog visible={true} downloadUrl="" onClose={vi.fn()} />
    );

    // When: リンク要素を取得する（空テキストのためgetByRoleでは取得不可）
    const link = container.querySelector("a");

    // Then: hrefが空文字である
    expect(link).not.toBeNull();
    expect(link!.getAttribute("href")).toBe("");
    expect(link!.getAttribute("target")).toBe("_blank");
    expect(link!.getAttribute("rel")).toBe("noopener noreferrer");
    expect(link!.textContent).toBe("");
  });
});
