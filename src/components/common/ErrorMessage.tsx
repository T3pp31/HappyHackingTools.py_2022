import React from "react";

interface ErrorMessageProps {
  message: string;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({ message }) => {
  return (
    <div
      style={{
        padding: "12px 16px",
        backgroundColor: "rgba(239, 68, 68, 0.1)",
        border: "1px solid var(--danger)",
        borderRadius: "var(--radius)",
        color: "var(--danger)",
        fontSize: "13px",
      }}
    >
      {message}
    </div>
  );
};
