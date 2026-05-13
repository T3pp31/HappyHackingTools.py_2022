import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { renderHook, act } from "@testing-library/react";

const mockInvoke = vi.hoisted(() => vi.fn());
const mockOpen = vi.hoisted(() => vi.fn());
const mockListen = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: (...args: unknown[]) => mockOpen(...args),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: (...args: unknown[]) => mockListen(...args),
}));

const { PortScanPage } = await import("../src/pages/PortScanPage");
const { WebCheckPage } = await import("../src/pages/WebCheckPage");
const { BinaryPage } = await import("../src/pages/BinaryPage");
const { useArpSpoof } = await import("../src/hooks/useArpSpoof");

describe("Tauri invoke args", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListen.mockResolvedValue(vi.fn());
  });

  afterEach(() => {
    cleanup();
  });

  it("port_scanをcamelCase argsで呼ぶこと", async () => {
    mockInvoke.mockResolvedValue({
      ip: "127.0.0.1",
      scanned_range: [0, 1024],
      open_ports: [],
    });

    render(<PortScanPage />);

    fireEvent.click(screen.getByRole("button", { name: "Scan" }));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("port_scan", {
        ip: "127.0.0.1",
        portStart: 0,
        portEnd: 1024,
      });
    });
  });

  it("web_checkをcamelCase argsで呼ぶこと", async () => {
    mockInvoke.mockResolvedValue({
      target_url: "https://example.com",
      final_url: "https://example.com",
      status_code: 200,
      response_time_ms: 42,
      redirected: false,
      uses_https: true,
      tls_valid: true,
      tls_error: null,
      content_type: "text/html",
      server_header: null,
      security_headers: [],
      cors_checks: [],
      cookie_checks: [],
      allowed_methods: [],
      path_checks: [],
      input_checks: [],
      form_candidates: [],
      findings: [],
    });

    render(<WebCheckPage />);

    fireEvent.click(screen.getByRole("checkbox", {
      name: "許可済み対象であること",
    }));
    fireEvent.click(screen.getByRole("button", { name: "Check" }));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("web_check", {
        targetUrl: "https://example.com",
        mode: "passive",
        authHeaders: [],
        extraPaths: [],
        inputChecks: [],
      });
    });
  });

  it("start_arp_spoofをcamelCase argsで呼ぶこと", async () => {
    mockInvoke.mockResolvedValue("started");

    const { result } = renderHook(() => useArpSpoof());

    await act(async () => {
      await result.current.start("192.0.2.10", "192.0.2.1", 7);
    });

    expect(mockInvoke).toHaveBeenCalledWith("start_arp_spoof", {
      targetIp: "192.0.2.10",
      gatewayIp: "192.0.2.1",
      packetCount: 7,
    });
  });

  it("read_binary_fileをcamelCase argsで呼ぶこと", async () => {
    mockOpen.mockResolvedValue("/tmp/sample.bin");
    mockInvoke.mockResolvedValue({
      file_name: "sample.bin",
      file_size: 0,
      hex_dump: "",
      decoded_text: "",
      magic_bytes: "",
      file_type_guess: "Unknown",
      sha256: "",
      printable_strings: [],
      flag_candidates: [],
      entropy: 0,
      warnings: [],
    });

    render(<BinaryPage />);

    fireEvent.click(screen.getByRole("button", { name: "Select File" }));

    await waitFor(() => {
      expect(mockOpen).toHaveBeenCalledWith({ multiple: false });
      expect(mockInvoke).toHaveBeenCalledWith("read_binary_file", {
        filePath: "/tmp/sample.bin",
      });
    });
  });
});
