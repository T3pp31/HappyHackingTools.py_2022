import { describe, it, expect } from "vitest";
import {
  LAN_SCAN_DEFAULTS,
  PORT_SCAN_DEFAULTS,
  ARP_SPOOF_DEFAULTS,
} from "../src/config/defaults";

describe("defaults.ts", () => {
  // =============================================================
  // LAN_SCAN_DEFAULTS
  // =============================================================
  describe("LAN_SCAN_DEFAULTS", () => {
    // --- 正常系 ---

    it("startHost が '0' であること", () => {
      // Given: LAN_SCAN_DEFAULTS が定義されている
      // When: startHost を参照する
      // Then: '0' が返る
      expect(LAN_SCAN_DEFAULTS.startHost).toBe("0");
    });

    it("endHost が '255' であること", () => {
      // Given: LAN_SCAN_DEFAULTS が定義されている
      // When: endHost を参照する
      // Then: '255' が返る
      expect(LAN_SCAN_DEFAULTS.endHost).toBe("255");
    });

    it("プロパティが startHost と endHost の2つであること", () => {
      // Given: LAN_SCAN_DEFAULTS が定義されている
      // When: オブジェクトのキーを取得する
      // Then: キーが2つで、startHost と endHost を含む
      const keys = Object.keys(LAN_SCAN_DEFAULTS);
      expect(keys).toHaveLength(2);
      expect(keys).toContain("startHost");
      expect(keys).toContain("endHost");
    });

    // --- 型検証 ---

    it("全プロパティの値が string 型であること", () => {
      // Given: LAN_SCAN_DEFAULTS が定義されている
      // When: 各プロパティの typeof を確認する
      // Then: すべて 'string' である
      expect(typeof LAN_SCAN_DEFAULTS.startHost).toBe("string");
      expect(typeof LAN_SCAN_DEFAULTS.endHost).toBe("string");
    });

    it("string 型の値が代入可能であること（ミュータブル）", () => {
      // Given: LAN_SCAN_DEFAULTS のコピーを作る
      // When: 一般的な string 値を代入する
      // Then: 代入後の値が反映される
      const copy = { ...LAN_SCAN_DEFAULTS };
      copy.startHost = "10";
      copy.endHost = "200";
      expect(copy.startHost).toBe("10");
      expect(copy.endHost).toBe("200");
    });

    // --- 構造検証 ---

    it("オブジェクトであること", () => {
      // Given: LAN_SCAN_DEFAULTS が定義されている
      // When: typeof を確認する
      // Then: 'object' であり null でない
      expect(typeof LAN_SCAN_DEFAULTS).toBe("object");
      expect(LAN_SCAN_DEFAULTS).not.toBeNull();
      expect(LAN_SCAN_DEFAULTS).not.toBeUndefined();
    });

    // --- 異常系 ---

    it("存在しないプロパティが undefined であること", () => {
      // Given: LAN_SCAN_DEFAULTS が定義されている
      // When: 存在しないプロパティを参照する
      // Then: undefined が返る
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((LAN_SCAN_DEFAULTS as any).nonExistent).toBeUndefined();
    });
  });

  // =============================================================
  // PORT_SCAN_DEFAULTS
  // =============================================================
  describe("PORT_SCAN_DEFAULTS", () => {
    // --- 正常系 ---

    it("targetIp が '127.0.0.1' であること", () => {
      // Given: PORT_SCAN_DEFAULTS が定義されている
      // When: targetIp を参照する
      // Then: '127.0.0.1' が返る
      expect(PORT_SCAN_DEFAULTS.targetIp).toBe("127.0.0.1");
    });

    it("portStart が '0' であること", () => {
      // Given: PORT_SCAN_DEFAULTS が定義されている
      // When: portStart を参照する
      // Then: '0' が返る
      expect(PORT_SCAN_DEFAULTS.portStart).toBe("0");
    });

    it("portEnd が '1024' であること", () => {
      // Given: PORT_SCAN_DEFAULTS が定義されている
      // When: portEnd を参照する
      // Then: '1024' が返る
      expect(PORT_SCAN_DEFAULTS.portEnd).toBe("1024");
    });

    it("プロパティが targetIp, portStart, portEnd の3つであること", () => {
      // Given: PORT_SCAN_DEFAULTS が定義されている
      // When: オブジェクトのキーを取得する
      // Then: キーが3つで、targetIp, portStart, portEnd を含む
      const keys = Object.keys(PORT_SCAN_DEFAULTS);
      expect(keys).toHaveLength(3);
      expect(keys).toContain("targetIp");
      expect(keys).toContain("portStart");
      expect(keys).toContain("portEnd");
    });

    // --- 型検証 ---

    it("全プロパティの値が string 型であること", () => {
      // Given: PORT_SCAN_DEFAULTS が定義されている
      // When: 各プロパティの typeof を確認する
      // Then: すべて 'string' である
      expect(typeof PORT_SCAN_DEFAULTS.targetIp).toBe("string");
      expect(typeof PORT_SCAN_DEFAULTS.portStart).toBe("string");
      expect(typeof PORT_SCAN_DEFAULTS.portEnd).toBe("string");
    });

    it("string 型の値が代入可能であること（ミュータブル）", () => {
      // Given: PORT_SCAN_DEFAULTS のコピーを作る
      // When: 一般的な string 値を代入する
      // Then: 代入後の値が反映される
      const copy = { ...PORT_SCAN_DEFAULTS };
      copy.targetIp = "192.168.1.1";
      copy.portStart = "80";
      copy.portEnd = "65535";
      expect(copy.targetIp).toBe("192.168.1.1");
      expect(copy.portStart).toBe("80");
      expect(copy.portEnd).toBe("65535");
    });

    // --- 構造検証 ---

    it("オブジェクトであること", () => {
      // Given: PORT_SCAN_DEFAULTS が定義されている
      // When: typeof を確認する
      // Then: 'object' であり null でない
      expect(typeof PORT_SCAN_DEFAULTS).toBe("object");
      expect(PORT_SCAN_DEFAULTS).not.toBeNull();
      expect(PORT_SCAN_DEFAULTS).not.toBeUndefined();
    });

    // --- 異常系 ---

    it("存在しないプロパティが undefined であること", () => {
      // Given: PORT_SCAN_DEFAULTS が定義されている
      // When: 存在しないプロパティを参照する
      // Then: undefined が返る
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((PORT_SCAN_DEFAULTS as any).nonExistent).toBeUndefined();
    });
  });

  // =============================================================
  // ARP_SPOOF_DEFAULTS
  // =============================================================
  describe("ARP_SPOOF_DEFAULTS", () => {
    // --- 正常系 ---

    it("packetCount が '200' であること", () => {
      // Given: ARP_SPOOF_DEFAULTS が定義されている
      // When: packetCount を参照する
      // Then: '200' が返る
      expect(ARP_SPOOF_DEFAULTS.packetCount).toBe("200");
    });

    it("プロパティが packetCount の1つであること", () => {
      // Given: ARP_SPOOF_DEFAULTS が定義されている
      // When: オブジェクトのキーを取得する
      // Then: キーが1つで、packetCount を含む
      const keys = Object.keys(ARP_SPOOF_DEFAULTS);
      expect(keys).toHaveLength(1);
      expect(keys).toContain("packetCount");
    });

    // --- 型検証 ---

    it("packetCount の値が string 型であること", () => {
      // Given: ARP_SPOOF_DEFAULTS が定義されている
      // When: packetCount の typeof を確認する
      // Then: 'string' である
      expect(typeof ARP_SPOOF_DEFAULTS.packetCount).toBe("string");
    });

    it("string 型の値が代入可能であること（ミュータブル）", () => {
      // Given: ARP_SPOOF_DEFAULTS のコピーを作る
      // When: 一般的な string 値を代入する
      // Then: 代入後の値が反映される
      const copy = { ...ARP_SPOOF_DEFAULTS };
      copy.packetCount = "500";
      expect(copy.packetCount).toBe("500");
    });

    // --- 構造検証 ---

    it("オブジェクトであること", () => {
      // Given: ARP_SPOOF_DEFAULTS が定義されている
      // When: typeof を確認する
      // Then: 'object' であり null でない
      expect(typeof ARP_SPOOF_DEFAULTS).toBe("object");
      expect(ARP_SPOOF_DEFAULTS).not.toBeNull();
      expect(ARP_SPOOF_DEFAULTS).not.toBeUndefined();
    });

    // --- 異常系 ---

    it("存在しないプロパティが undefined であること", () => {
      // Given: ARP_SPOOF_DEFAULTS が定義されている
      // When: 存在しないプロパティを参照する
      // Then: undefined が返る
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((ARP_SPOOF_DEFAULTS as any).nonExistent).toBeUndefined();
    });
  });

  // =============================================================
  // 横断的な検証
  // =============================================================
  describe("横断的検証", () => {
    it("全定数の全プロパティ値が string 型であること", () => {
      // Given: 全定数が定義されている
      // When: 全プロパティの typeof を確認する
      // Then: すべて 'string' である
      const allDefaults = [
        LAN_SCAN_DEFAULTS,
        PORT_SCAN_DEFAULTS,
        ARP_SPOOF_DEFAULTS,
      ];
      for (const defaults of allDefaults) {
        for (const value of Object.values(defaults)) {
          expect(typeof value).toBe("string");
        }
      }
    });

    it("全定数が空でないオブジェクトであること", () => {
      // Given: 全定数が定義されている
      // When: 各定数のキー数を確認する
      // Then: すべて1つ以上のプロパティを持つ
      const allDefaults = [
        LAN_SCAN_DEFAULTS,
        PORT_SCAN_DEFAULTS,
        ARP_SPOOF_DEFAULTS,
      ];
      for (const defaults of allDefaults) {
        expect(Object.keys(defaults).length).toBeGreaterThan(0);
      }
    });

    it("全定数のプロパティ値が空文字でないこと", () => {
      // Given: 全定数が定義されている
      // When: 各プロパティ値を確認する
      // Then: すべて空文字でない
      const allDefaults = [
        LAN_SCAN_DEFAULTS,
        PORT_SCAN_DEFAULTS,
        ARP_SPOOF_DEFAULTS,
      ];
      for (const defaults of allDefaults) {
        for (const value of Object.values(defaults)) {
          expect(value).not.toBe("");
        }
      }
    });
  });
});
