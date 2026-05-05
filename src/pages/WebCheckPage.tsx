import React, { useState } from "react";
import { ErrorMessage } from "../components/common/ErrorMessage";
import { LoadingSpinner } from "../components/common/LoadingSpinner";
import { WEB_CHECK_DEFAULTS } from "../config/defaults";
import { useTauriCommand } from "../hooks/useTauriCommand";
import { buttonStyle, inputStyle, labelStyle } from "../styles/formStyles";
import type { WebCheckResult } from "../types";

type WebCheckMode = "passive" | "manualActive" | "discovery";

const sectionStyle: React.CSSProperties = {
  borderTop: "1px solid var(--border)",
  paddingTop: "14px",
  marginTop: "14px",
};

const mutedStyle: React.CSSProperties = {
  color: "var(--text-secondary)",
  fontSize: "13px",
};

const valueStyle: React.CSSProperties = {
  color: "var(--text-primary)",
  fontSize: "13px",
  wordBreak: "break-word",
};

const headingStyle: React.CSSProperties = {
  color: "var(--accent)",
  fontSize: "14px",
  marginBottom: "10px",
};

const formatLabel = (key: string) =>
  key.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

const formatValue = (value: unknown): string => {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  if (Array.isArray(value)) {
    return value.map(formatValue).join(", ");
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
};

const objectEntries = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }
  return Object.entries(value as Record<string, unknown>);
};

const renderKeyValueGrid = (value: unknown) => {
  const entries = objectEntries(value);

  if (entries.length === 0) {
    return <p style={mutedStyle}>No data.</p>;
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: "10px 16px",
      }}
    >
      {entries.map(([key, entryValue]) => (
        <div key={key}>
          <div style={{ ...mutedStyle, fontSize: "12px" }}>
            {formatLabel(key)}
          </div>
          <div style={valueStyle}>{formatValue(entryValue)}</div>
        </div>
      ))}
    </div>
  );
};

const renderList = (items: unknown[], emptyMessage: string) => {
  if (items.length === 0) {
    return <p style={mutedStyle}>{emptyMessage}</p>;
  }

  return (
    <div style={{ display: "grid", gap: "8px" }}>
      {items.map((item, index) => (
        <div
          key={index}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "6px 12px",
            padding: "10px 0",
            borderBottom: "1px solid var(--border)",
          }}
        >
          {objectEntries(item).map(([key, value]) => (
            <div key={key}>
              <div style={{ ...mutedStyle, fontSize: "12px" }}>
                {formatLabel(key)}
              </div>
              <div style={valueStyle}>{formatValue(value)}</div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export const WebCheckPage: React.FC = () => {
  const [targetUrl, setTargetUrl] = useState(WEB_CHECK_DEFAULTS.targetUrl);
  const [authorized, setAuthorized] = useState(false);
  const [mode, setMode] = useState<WebCheckMode>("passive");
  const [authHeaders, setAuthHeaders] = useState("");
  const [extraPaths, setExtraPaths] = useState("");
  const [inputChecks, setInputChecks] = useState("");
  const { data, loading, error, execute } =
    useTauriCommand<WebCheckResult>("web_check");

  const canRun = authorized && targetUrl.trim().length > 0 && !loading;

  const handleCheck = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canRun) {
      return;
    }

    await execute({
      targetUrl: targetUrl.trim(),
      mode,
      authHeaders: parseHeaderLines(authHeaders),
      extraPaths: parseLines(extraPaths),
      inputChecks: parseInputChecks(inputChecks),
    });
  };

  const statusDetails = data
    ? {
        status_code: data.status_code,
        final_url: data.final_url,
        response_time_ms: data.response_time_ms,
        redirected: data.redirected,
        content_type: data.content_type,
        server_header: data.server_header,
        allowed_methods: data.allowed_methods,
      }
    : null;
  const tlsDetails = data
    ? {
        uses_https: data.uses_https,
        tls_valid: data.tls_valid,
        tls_error: data.tls_error,
      }
    : null;

  return (
    <div>
      <h2 style={{ marginBottom: "8px", fontSize: "20px" }}>Web Check</h2>
      <p style={{ ...mutedStyle, marginBottom: "20px" }}>
        HTTP, TLS, headers, cookies, and explicit low-volume vulnerability checks.
      </p>

      <form
        onSubmit={handleCheck}
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "12px",
          marginBottom: "20px",
          alignItems: "end",
        }}
      >
        <div style={{ minWidth: "280px", flex: "1 1 360px" }}>
          <label style={labelStyle}>Target URL</label>
          <input
            type="url"
            value={targetUrl}
            onChange={(event) => setTargetUrl(event.target.value)}
            placeholder="https://example.com"
            style={{ ...inputStyle, width: "100%" }}
          />
        </div>

        <div>
          <label style={labelStyle}>Mode</label>
          <select
            value={mode}
            onChange={(event) => setMode(event.target.value as WebCheckMode)}
            style={{ ...inputStyle, width: "160px" }}
          >
            <option value="passive">Passive</option>
            <option value="manualActive">Manual Active</option>
            <option value="discovery">Discovery</option>
          </select>
        </div>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            color: "var(--text-secondary)",
            fontSize: "12px",
            marginBottom: "9px",
          }}
        >
          <input
            type="checkbox"
            checked={authorized}
            onChange={(event) => setAuthorized(event.target.checked)}
          />
          許可済み対象であること
        </label>

        <button
          type="submit"
          disabled={!canRun}
          style={{
            ...buttonStyle,
            opacity: canRun ? 1 : 0.5,
            cursor: canRun ? "pointer" : "not-allowed",
          }}
        >
          {loading ? "Checking..." : "Check"}
        </button>

        <div style={{ flexBasis: "100%", display: "grid", gap: "12px" }}>
          <div>
            <label style={labelStyle}>Cookie / Headers</label>
            <textarea
              value={authHeaders}
              onChange={(event) => setAuthHeaders(event.target.value)}
              placeholder={"Cookie: session=...\nAuthorization: Bearer ..."}
              rows={3}
              style={{ ...inputStyle, width: "100%", minHeight: "72px" }}
            />
          </div>

          <div>
            <label style={labelStyle}>Extra Paths</label>
            <textarea
              value={extraPaths}
              onChange={(event) => setExtraPaths(event.target.value)}
              placeholder={"/admin\n/health\nhttps://example.com/profile"}
              rows={3}
              style={{ ...inputStyle, width: "100%", minHeight: "72px" }}
            />
          </div>

          {mode === "manualActive" && (
            <div>
              <label style={labelStyle}>Manual Input Checks</label>
              <textarea
                value={inputChecks}
                onChange={(event) => setInputChecks(event.target.value)}
                placeholder={"GET /search q\nPOST /contact message\nGET https://example.com/redirect next"}
                rows={4}
                style={{ ...inputStyle, width: "100%", minHeight: "96px" }}
              />
            </div>
          )}
        </div>
      </form>

      {loading && <LoadingSpinner message="Checking web server..." />}
      {error && <ErrorMessage message={error} />}

      {data && (
        <div
          style={{
            backgroundColor: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            padding: "16px",
          }}
        >
          <h3 style={{ fontSize: "14px", color: "var(--accent)" }}>
            Results: {data.target_url}
          </h3>

          <section style={sectionStyle}>
            <h4 style={headingStyle}>Status</h4>
            {renderKeyValueGrid(statusDetails)}
          </section>

          <section style={sectionStyle}>
            <h4 style={headingStyle}>TLS</h4>
            {renderKeyValueGrid(tlsDetails)}
          </section>

          <section style={sectionStyle}>
            <h4 style={headingStyle}>Security Headers</h4>
            {renderList(data.security_headers, "No security headers reported.")}
          </section>

          <section style={sectionStyle}>
            <h4 style={headingStyle}>CORS</h4>
            {renderList(data.cors_checks, "No CORS headers reported.")}
          </section>

          <section style={sectionStyle}>
            <h4 style={headingStyle}>Cookies</h4>
            {renderList(data.cookie_checks, "No cookies reported.")}
          </section>

          <section style={sectionStyle}>
            <h4 style={headingStyle}>Extra Paths</h4>
            {renderList(data.path_checks, "No extra paths checked.")}
          </section>

          <section style={sectionStyle}>
            <h4 style={headingStyle}>Manual Input Checks</h4>
            {renderList(data.input_checks, "No manual input checks run.")}
          </section>

          <section style={sectionStyle}>
            <h4 style={headingStyle}>Form Candidates</h4>
            {renderList(data.form_candidates, "No form candidates found.")}
          </section>

          <section style={sectionStyle}>
            <h4 style={headingStyle}>Findings</h4>
            {renderList(data.findings, "No findings reported.")}
          </section>
        </div>
      )}
    </div>
  );
};

const parseLines = (value: string) =>
  value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 5);

const parseHeaderLines = (value: string) =>
  parseLines(value)
    .map((line) => {
      const separatorIndex = line.indexOf(":");
      if (separatorIndex === -1) {
        return null;
      }

      const name = line.slice(0, separatorIndex).trim();
      const headerValue = line.slice(separatorIndex + 1).trim();
      if (!name || !headerValue) {
        return null;
      }

      return { name, value: headerValue };
    })
    .filter((header): header is { name: string; value: string } => Boolean(header));

const parseInputChecks = (value: string) =>
  parseLines(value).map((line, index) => {
    const [method = "GET", path = "/", parameter = "q"] = line.split(/\s+/);
    return {
      name: `check-${index + 1}`,
      method: method.toUpperCase(),
      path,
      parameter,
    };
  });
