import { useSettings } from "../contexts/SettingsContext";
import styles from "./SettingsPanel.module.css";

interface Props {
  onClose: () => void;
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={(e) => { e.stopPropagation(); onChange(!checked); }}
      className={`${styles.toggle}${checked ? ` ${styles.toggleOn}` : ""}`}
    />
  );
}

function SettingsItem({
  icon,
  label,
  checked,
  onChange,
}: {
  icon: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className={styles.item} onClick={() => onChange(!checked)}>
      <span className={styles.icon}>{icon}</span>
      <span className={styles.label}>{label}</span>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

export function SettingsPanel({ onClose }: Props) {
  const { showClock, setShowClock, autoCheck, setAutoCheck, autoPlaceXs, setAutoPlaceXs } = useSettings();

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.panel}>
        <SettingsItem icon="🕐" label="Show clock" checked={showClock} onChange={setShowClock} />
        <SettingsItem icon="✓" label="Auto-check" checked={autoCheck} onChange={setAutoCheck} />
        <SettingsItem icon="✕" label="Auto-place X's" checked={autoPlaceXs} onChange={setAutoPlaceXs} />
      </div>
    </>
  );
}
