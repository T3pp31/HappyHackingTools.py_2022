import React from "react";
import { NavLink } from "react-router-dom";
import styles from "./Sidebar.module.css";

type NavItem = {
  path: string;
  label: string;
  exact?: boolean;
};

type NavGroup = {
  title: string;
  items: readonly NavItem[];
};

const NAV_GROUPS: readonly NavGroup[] = [
  {
    title: "CTF Solver",
    items: [
      { path: "/", label: "CTF Workspace", exact: true },
      { path: "/ctf", label: "String Transform" },
      { path: "/binary", label: "Artifact Analyzer" },
    ],
  },
  {
    title: "Advanced / Network Lab",
    items: [
      { path: "/web-check", label: "Web Check" },
      { path: "/portscan", label: "Port Scan" },
      { path: "/lanscan", label: "LAN Scan" },
      { path: "/arp-spoof", label: "ARP Spoof" },
    ],
  },
] as const;

export const Sidebar: React.FC = () => {
  return (
    <nav className={styles.sidebar}>
      <div className={styles.logo}>
        <h2>HHTools</h2>
        <p>Local-first CTF Assistant</p>
      </div>
      <div className={styles.navGroups}>
        {NAV_GROUPS.map((group) => (
          <section key={group.title} className={styles.navGroup}>
            <h3 className={styles.groupTitle}>{group.title}</h3>
            <ul className={styles.navList}>
              {group.items.map((item) => (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    end={item.exact}
                    className={({ isActive }) =>
                      `${styles.navLink} ${isActive ? styles.active : ""}`
                    }
                  >
                    <span>{item.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </nav>
  );
};
