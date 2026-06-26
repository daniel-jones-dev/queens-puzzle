import { NavLink, Outlet, Link } from "react-router-dom";
import { SettingsProvider } from "../contexts/SettingsContext";
import styles from "./AppShell.module.css";

export function AppShell() {
  return (
    <SettingsProvider>
      <div className={styles.shell}>
        <header className={styles.header}>
          <Link to="/play" className={styles.logo}>♛ Queens</Link>
          <nav className={styles.nav}>
            <NavLink
              to="/play"
              className={({ isActive }) => `${styles.navLink}${isActive ? ` ${styles.navLinkActive}` : ""}`}
            >
              Play
            </NavLink>
            <NavLink
              to="/solve"
              className={({ isActive }) => `${styles.navLink}${isActive ? ` ${styles.navLinkActive}` : ""}`}
            >
              Solve
            </NavLink>
            <NavLink
              to="/editor"
              className={({ isActive }) => `${styles.navLink}${isActive ? ` ${styles.navLinkActive}` : ""}`}
            >
              Editor
            </NavLink>
            <NavLink
              to="/generator"
              className={({ isActive }) => `${styles.navLink}${isActive ? ` ${styles.navLinkActive}` : ""}`}
            >
              Generator
            </NavLink>
          </nav>
        </header>

        <main className={styles.main}>
          <Outlet />
        </main>

        <footer className={styles.footer}>
          <span>
            Made by{" "}
            <a href="https://github.com/daniel-jones-dev" target="_blank" rel="noopener">
              Daniel Jones
            </a>
          </span>
          <span className={styles.sep}>·</span>
          <a href="https://github.com/daniel-jones-dev/queens-puzzle" target="_blank" rel="noopener">
            GitHub
          </a>
          <span className={styles.sep}>·</span>
          <span>
            Inspired by{" "}
            <a href="https://www.linkedin.com/games/queens/" target="_blank" rel="noopener">
              LinkedIn Queens
            </a>
          </span>
        </footer>

        <nav className={styles.tabBar}>
          <NavLink
            to="/play"
            className={({ isActive }) => `${styles.tab}${isActive ? ` ${styles.tabActive}` : ""}`}
          >
            <span className={`${styles.tabIcon} ${styles.tabIconText}`}>♛</span>
            <span>Play</span>
          </NavLink>
          <NavLink
            to="/solve"
            className={({ isActive }) => `${styles.tab}${isActive ? ` ${styles.tabActive}` : ""}`}
          >
            <span className={styles.tabIcon}>→</span>
            <span>Solve</span>
          </NavLink>
          <NavLink
            to="/editor"
            className={({ isActive }) => `${styles.tab}${isActive ? ` ${styles.tabActive}` : ""}`}
          >
            <span className={styles.tabIcon}>✏</span>
            <span>Editor</span>
          </NavLink>
          <NavLink
            to="/generator"
            className={({ isActive }) => `${styles.tab}${isActive ? ` ${styles.tabActive}` : ""}`}
          >
            <span className={styles.tabIcon}>⚡</span>
            <span>Generator</span>
          </NavLink>
        </nav>
      </div>
    </SettingsProvider>
  );
}
