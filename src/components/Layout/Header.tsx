import React from "react";
import styles from "./Header.module.css";

export const Header: React.FC = () => {
  return (
    <header className={styles.header}>
      <h1 className={styles.title}>HappyHackingTools</h1>
    </header>
  );
};
