import React from "react";

interface LoadingSpinnerProps {
  message?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  message = "Loading...",
}) => {
  return (
    <div style={{ textAlign: "center", padding: "40px", color: "var(--text-secondary)" }}>
      <div style={{ fontSize: "14px" }}>{message}</div>
    </div>
  );
};
