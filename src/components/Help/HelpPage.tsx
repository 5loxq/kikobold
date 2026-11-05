import React from 'react';
import { useTranslation } from 'react-i18next';
import { version as appVersion } from '../../../package.json';
import { getRecentLogEntries } from '../../services/logging';

interface HelpPageProps {
  /** Return to the previous view (e.g. the chat). window.close() only works
   *  for script-opened windows, so without this the button does nothing. */
  onNavigateBack?: () => void;
  /** Restart the guided tour (from the help page) */
  onRestartTour?: () => void;
  /** Show the full "what's new" list (from the help page) */
  onShowWhatsNew?: () => void;
}

export const HelpPage: React.FC<HelpPageProps> = ({ onNavigateBack, onRestartTour, onShowWhatsNew }) => {
  const { t } = useTranslation();
  // Diagnostic report (v4.3.44): system info + recent log entries as a
  // copyable text block. Generated on demand - nothing is collected in
  // the background, and chat content never enters the report.
  const [diagnosticReport, setDiagnosticReport] = React.useState<string | null>(null);
  const [diagnosticCopied, setDiagnosticCopied] = React.useState(false);

  const buildDiagnosticReport = async (): Promise<void> => {
    const lines: string[] = [`KI Kobold v${appVersion}`];
    lines.push(`Generated: ${new Date().toISOString()}`);
    try {
      const { getSystemSummary } = await import('../../services/system-info');
      const summary = await getSystemSummary();
      lines.push(`Browser: ${summary.browser}`);
      lines.push(`OS: ${summary.os}`);
      lines.push(`GPU: ${summary.gpu}`);
      lines.push(`Memory: ${summary.memory}`);
      lines.push(`WebGPU: ${summary.webgpu ? 'yes' : 'no'}`);
      lines.push(`WASM: ${summary.wasm ? 'yes' : 'no'}`);
      lines.push(`Storage: ${summary.storage}`);
    } catch (err) {
      lines.push(`System info unavailable: ${err instanceof Error ? err.message : String(err)}`);
    }
    lines.push('');
    lines.push('Recent log entries (oldest first, no chat content):');
    const entries = getRecentLogEntries();
    if (entries.length === 0) {
      lines.push('(none)');
    } else {
      for (const entry of entries) {
        lines.push(
          `[${new Date(entry.timestamp).toISOString()}] ${entry.level.toUpperCase()}: ${entry.message}`
        );
      }
    }
    setDiagnosticReport(lines.join('\n'));
  };

  const copyDiagnosticReport = (): void => {
    if (!diagnosticReport) {
      return;
    }
    void navigator.clipboard.writeText(diagnosticReport).then(() => {
      setDiagnosticCopied(true);
      setTimeout(() => setDiagnosticCopied(false), 2000);
    }).catch(() => {
      // Clipboard access can fail (e.g. lost focus) - the textarea below
      // still allows manual copying.
    });
  };

  const canItems = [t('help.modelsCan1'), t('help.modelsCan2'), t('help.modelsCan3')];
  const cannotItems = [
    t('help.modelsCannot1'),
    t('help.modelsCannot2'),
    t('help.modelsCannot3'),
    t('help.modelsCannot4'),
  ];
  const importExportItems = [
    t('help.importExportList1'),
    t('help.importExportList2'),
    t('help.importExportList3'),
    t('help.importExportList4'),
  ];
  const attachmentCanItems = [
    t('help.attachCan1'),
    t('help.attachCan2'),
    t('help.attachCan3'),
  ];
  const attachmentCannotItems = [
    t('help.attachCannot1'),
    t('help.attachCannot2'),
    t('help.attachCannot3'),
  ];
  const tips = [t('help.tip1'), t('help.tip2'), t('help.tip3'), t('help.tip4')];

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-3xl mx-auto p-6 md:p-8">
        <h1 className="text-3xl font-bold mb-6 text-zinc-800 dark:text-zinc-100">{t('help.title')}</h1>

        {/* Welcome / What is this */}
        <section className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800 mb-4">
          <h2 className="text-xl font-semibold mb-3 text-zinc-700 dark:text-zinc-200">
            🧌 {t('help.welcome')}
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
            {t('help.introText')}
          </p>
        </section>

        {/* Getting started */}
        <section className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800 mb-4">
          <h2 className="text-xl font-semibold mb-3 text-zinc-700 dark:text-zinc-200">
            {t('help.gettingStarted')}
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
            {t('help.gettingStartedText')}
          </p>
        </section>

        {/* Models: can / cannot */}
        <section className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800 mb-4">
          <h2 className="text-xl font-semibold mb-4 text-zinc-700 dark:text-zinc-200">
            {t('help.modelsTitle')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-green-200 dark:border-green-900/60 bg-green-50/60 dark:bg-green-950/20 p-4">
              <h3 className="font-semibold text-green-700 dark:text-green-400 mb-2">
                ✅ {t('help.modelsCanTitle')}
              </h3>
              <ul className="space-y-1.5">
                {canItems.map((item) => (
                  <li key={item} className="text-sm text-zinc-600 dark:text-zinc-400 flex items-start gap-2">
                    <span className="text-green-600 dark:text-green-500 mt-0.5">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/60 dark:bg-red-950/20 p-4">
              <h3 className="font-semibold text-red-700 dark:text-red-400 mb-2">
                ⛔ {t('help.modelsCannotTitle')}
              </h3>
              <ul className="space-y-1.5">
                {cannotItems.map((item) => (
                  <li key={item} className="text-sm text-zinc-600 dark:text-zinc-400 flex items-start gap-2">
                    <span className="text-red-500 dark:text-red-400 mt-0.5">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-4 leading-relaxed">
            💡 {t('help.modelsHint')}
          </p>
        </section>

        {/* Context: how the AI sees the chat */}
        <section className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800 mb-4">
          <h2 className="text-xl font-semibold mb-3 text-zinc-700 dark:text-zinc-200">
            {t('help.contextTitle')}
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
            {t('help.contextText')}
          </p>
        </section>

        {/* Profiles */}
        <section className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800 mb-4">
          <h2 className="text-xl font-semibold mb-3 text-zinc-700 dark:text-zinc-200">
            {t('help.profilesTitle')}
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
            {t('help.profilesDescription')}
          </p>
        </section>

        {/* Memory */}
        <section className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800 mb-4">
          <h2 className="text-xl font-semibold mb-3 text-zinc-700 dark:text-zinc-200">
            🧠 {t('help.memoryTitle')}
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-3">
            {t('help.memoryText')}
          </p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed border-l-4 border-indigo-300 dark:border-indigo-800 pl-3">
            💡 {t('help.memoryHowTo')}
          </p>
        </section>

        {/* Import / Export */}
        <section className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800 mb-4">
          <h2 className="text-xl font-semibold mb-3 text-zinc-700 dark:text-zinc-200">
            {t('help.importExportTitle')}
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-3 leading-relaxed">
            {t('help.importExportIntro')}
          </p>
          <ul className="space-y-1.5 mb-4">
            {importExportItems.map((item) => (
              <li key={item} className="text-sm text-zinc-600 dark:text-zinc-400 flex items-start gap-2">
                <span className="text-indigo-500 dark:text-indigo-400 mt-0.5">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed border-l-4 border-indigo-300 dark:border-indigo-800 pl-3">
            {t('help.importExportHint')}
          </p>
        </section>

        {/* Privacy */}
        <section className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800 mb-4">
          <h2 className="text-xl font-semibold mb-3 text-zinc-700 dark:text-zinc-200">
            🔒 {t('help.privacyTitle')}
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
            {t('help.privacyText')}
          </p>
        </section>

        {/* Tips */}
        <section className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800 mb-4">
          <h2 className="text-xl font-semibold mb-3 text-zinc-700 dark:text-zinc-200">
            {t('help.tipsTitle')}
          </h2>
          <ul className="space-y-1.5">
            {tips.map((tip) => (
              <li key={tip} className="text-sm text-zinc-600 dark:text-zinc-400 flex items-start gap-2">
                <span className="text-indigo-500 dark:text-indigo-400 mt-0.5">•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Attachments & Library */}
        <section className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800 mb-4">
          <h2 className="text-xl font-semibold mb-3 text-zinc-700 dark:text-zinc-200">
            📎 {t('help.attachmentsTitle')}
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
            {t('help.attachmentsIntro')}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="rounded-xl border border-green-200 dark:border-green-900/60 bg-green-50/60 dark:bg-green-950/20 p-4">
              <h3 className="font-semibold text-green-700 dark:text-green-400 mb-2">
                ✅ {t('help.attachCanTitle')}
              </h3>
              <ul className="space-y-1.5">
                {attachmentCanItems.map((item) => (
                  <li key={item} className="text-sm text-zinc-600 dark:text-zinc-400 flex items-start gap-2">
                    <span className="text-green-600 dark:text-green-500 mt-0.5">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/60 dark:bg-red-950/20 p-4">
              <h3 className="font-semibold text-red-700 dark:text-red-400 mb-2">
                ⛔ {t('help.attachCannotTitle')}
              </h3>
              <ul className="space-y-1.5">
                {attachmentCannotItems.map((item) => (
                  <li key={item} className="text-sm text-zinc-600 dark:text-zinc-400 flex items-start gap-2">
                    <span className="text-red-500 dark:text-red-400 mt-0.5">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed border-l-4 border-amber-300 dark:border-amber-800 pl-3 mb-4">
            ⚠️ {t('help.attachDropHint')}
          </p>
          <h3 className="font-semibold text-zinc-700 dark:text-zinc-200 mb-2">
            📚 {t('help.libraryTitle')}
          </h3>
          <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-2">
            {t('help.libraryText')}
          </p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed border-l-4 border-indigo-300 dark:border-indigo-800 pl-3">
            💡 {t('help.libraryHint')}
          </p>
        </section>

        {/* Keyboard shortcuts */}
        <section className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800 mb-4">
          <h2 className="text-xl font-semibold mb-3 text-zinc-700 dark:text-zinc-200">
            ⌨️ {t('help.shortcutsTitle')}
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-3">
            {t('help.shortcutsIntro')}
          </p>
          <ul className="space-y-1.5">
            {[
              t('help.shortcutSearch'),
              t('help.shortcutCancel'),
              t('help.shortcutSend'),
              t('help.shortcutNewline'),
            ].map((item) => (
              <li key={item} className="text-sm text-zinc-600 dark:text-zinc-400 flex items-start gap-2">
                <span className="text-indigo-500 dark:text-indigo-400 mt-0.5">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Tour & What's New */}
        <section className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800 mb-4">
          <h2 className="text-xl font-semibold mb-3 text-zinc-700 dark:text-zinc-200">
            🧭 {t('help.tourWhatsNewTitle')}
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
            {t('help.tourWhatsNewText')}
          </p>
          <div className="flex flex-wrap gap-2">
            {onRestartTour && (
              <button
                onClick={onRestartTour}
                className="px-4 py-2 text-sm font-semibold rounded-xl bg-indigo-700 text-white hover:opacity-90 transition-opacity"
              >
                {t('help.replayTourButton')}
              </button>
            )}
            {onShowWhatsNew && (
              <button
                onClick={onShowWhatsNew}
                className="px-4 py-2 text-sm rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                {t('help.showWhatsNewButton')}
              </button>
            )}
          </div>
        </section>

        {/* Diagnostic report */}
        <section className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800 mb-4">
          <h2 className="text-xl font-semibold mb-3 text-zinc-700 dark:text-zinc-200">
            🩺 {t('help.diagnosisTitle')}
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
            {t('help.diagnosisText')}
          </p>
          {diagnosticReport === null ? (
            <button
              onClick={() => void buildDiagnosticReport()}
              className="px-4 py-2 text-sm rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            >
              {t('help.diagnosisGenerate')}
            </button>
          ) : (
            <div className="space-y-3">
              <textarea
                readOnly
                value={diagnosticReport}
                aria-label={t('help.diagnosisTitle')}
                className="w-full h-56 px-3 py-2 text-xs font-mono rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 resize-y"
                onFocus={(e) => e.currentTarget.select()}
              />
              <div className="flex gap-2">
                <button
                  onClick={copyDiagnosticReport}
                  className="px-4 py-2 text-sm font-semibold rounded-xl bg-indigo-700 text-white hover:opacity-90 transition-opacity"
                >
                  {diagnosticCopied ? t('help.diagnosisCopied') : t('help.diagnosisCopy')}
                </button>
                <button
                  onClick={() => setDiagnosticReport(null)}
                  className="px-4 py-2 text-sm rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                >
                  {t('help.diagnosisClose')}
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Footer */}
        <section className="text-center mt-8">
          <h3 className="font-semibold text-zinc-700 dark:text-zinc-200 mb-1">
            {t('help.needMoreHelp')}
          </h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
            {t('help.contactSupport')}
          </p>
          <button
            onClick={() => (onNavigateBack ? onNavigateBack() : window.close())}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors"
          >
            {t('help.closeHelp')}
          </button>
        </section>
      </div>
    </div>
  );
};
