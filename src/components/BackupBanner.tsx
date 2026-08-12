type Props = {
  visible: boolean;
  onExport: () => void;
  onLater: () => void;
};

export function BackupBanner({ visible, onExport, onLater }: Props) {
  if (!visible) return null;

  return (
    <div className="backup-banner" role="status">
      <div className="backup-banner__text">
        <p className="backup-banner__title">该备份了</p>
      </div>
      <div className="backup-banner__actions">
        <button type="button" className="btn-ghost" onClick={onLater}>
          稍后
        </button>
        <button type="button" className="btn-primary btn-primary--sm" onClick={onExport}>
          导出
        </button>
      </div>
    </div>
  );
}
