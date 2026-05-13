import React from "react";
import { CTF_DETECTORS } from "../features/ctf/detectors";
import { DEFAULT_FLAG_PATTERNS } from "../features/ctf/flagPatterns";
import { CTF_HINT_SECTIONS } from "../features/ctf/hints";
import { CTF_TRANSFORMS } from "../features/ctf/transforms";

const cardStyle: React.CSSProperties = {
  backgroundColor: "var(--bg-secondary)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  padding: "16px",
  marginBottom: "12px",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "12px",
};

const metadataStyle: React.CSSProperties = {
  color: "var(--text-secondary)",
  fontSize: "12px",
  marginTop: "4px",
};

export const CtfPage: React.FC = () => {
  return (
    <div>
      <h2 style={{ marginBottom: "20px", fontSize: "20px" }}>
        CTF Reference
      </h2>

      <section aria-labelledby="ctf-hints-heading">
        <h3 id="ctf-hints-heading" style={{ fontSize: "16px", marginBottom: "12px" }}>
          Hints
        </h3>
        {CTF_HINT_SECTIONS.map((section) => (
          <div key={section.title} style={cardStyle}>
            <h4 style={{ fontSize: "14px", color: "var(--accent)", marginBottom: "8px" }}>
              {section.title}
            </h4>
            <ul style={{ paddingLeft: "20px", fontSize: "13px", color: "var(--text-secondary)" }}>
              {section.items.map((item) => (
                <li key={item} style={{ marginBottom: "4px" }}>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section aria-labelledby="ctf-transforms-heading" style={{ marginTop: "24px" }}>
        <h3 id="ctf-transforms-heading" style={{ fontSize: "16px", marginBottom: "12px" }}>
          Transforms
        </h3>
        <div style={gridStyle}>
          {CTF_TRANSFORMS.map((transform) => (
            <article key={transform.id} style={cardStyle}>
              <h4 style={{ fontSize: "14px", color: "var(--accent)", marginBottom: "8px" }}>
                {transform.label}
              </h4>
              <p style={{ color: "var(--text-secondary)", fontSize: "13px", margin: 0 }}>
                {transform.description}
              </p>
              <p style={metadataStyle}>Category: {transform.category}</p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="ctf-detectors-heading" style={{ marginTop: "24px" }}>
        <h3 id="ctf-detectors-heading" style={{ fontSize: "16px", marginBottom: "12px" }}>
          Detectors
        </h3>
        <div style={gridStyle}>
          {CTF_DETECTORS.map((detector) => (
            <article key={detector.id} style={cardStyle}>
              <h4 style={{ fontSize: "14px", color: "var(--accent)", marginBottom: "8px" }}>
                {detector.label}
              </h4>
              <p style={metadataStyle}>ID: {detector.id}</p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="ctf-flag-patterns-heading" style={{ marginTop: "24px" }}>
        <h3 id="ctf-flag-patterns-heading" style={{ fontSize: "16px", marginBottom: "12px" }}>
          Flag Patterns
        </h3>
        <div style={gridStyle}>
          {DEFAULT_FLAG_PATTERNS.map((pattern) => (
            <article key={pattern.id} style={cardStyle}>
              <h4 style={{ fontSize: "14px", color: "var(--accent)", marginBottom: "8px" }}>
                {pattern.label}
              </h4>
              <p style={{ color: "var(--text-secondary)", fontSize: "13px", margin: 0 }}>
                {pattern.description}
              </p>
              <p style={metadataStyle}>/{pattern.source}/{pattern.flags}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
};
