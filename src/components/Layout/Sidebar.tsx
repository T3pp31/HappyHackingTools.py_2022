import React from "react";
import { NavLink } from "react-router-dom";
import styles from "./Sidebar.module.css";

const NAV_ITEMS = [
  { path: "/", label: "Workspace Home" },
  { path: "/ctf", label: "CTF Workspace" },
  { path: "/binary", label: "Artifact Analyzer" },
  { path: "/web-check", label: "Web Check" },
  { path: "/lanscan", label: "Advanced: LAN Scan" },
  { path: "/portscan", label: "Advanced: Port Scan" },
  { path: "/arp-spoof", label: "Advanced: ARP Spoof" },
] as const;

export const Sidebar: React.FC = () => {
  return (
    <nav className={styles.sidebar}>
      <div className={styles.logo}>
        <h2>HHTools</h2>
      </div>
      <ul className={styles.navList}>
        {NAV_ITEMS.map((item) => (
          <li key={item.path}>
            <NavLink
              to={item.path}
              end={item.path === "/"}
              className={({ isActive }) =>
                `${styles.navLink} ${isActive ? styles.active : ""}`
              }
            >
              <span>{item.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
};
