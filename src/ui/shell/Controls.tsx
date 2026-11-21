/**
 * Header controls: role switch, theme menu, export menu, view navigation.
 * Validates: review-ui 11.1, 11.2, 15.1, 15.2, 15.3
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ChevronDown, Download, Monitor, Moon, Sun } from 'lucide-react';
import { exportCaseFile, toFhirBundle } from '@core';
import { copy } from '../copy';
import { shortId } from '../format';
import { useDownload } from '../hooks';
import { cn } from '../lib/utils';
import { useTheme } from '../state/ThemeProvider';
import { systemClock, useStore } from '../state/store';
import type { Theme } from '../state/theme';
import { Button } from '../components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { ToggleGroup, ToggleGroupItem } from '../components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip';

export const segmentItem =
  'h-10 min-w-10 px-3 text-small font-semibold text-ink-muted border border-transparent data-[state=on]:bg-violet data-[state=on]:text-on-violet hover:bg-surface-2 hover:text-ink data-[state=on]:hover:bg-violet data-[state=on]:hover:text-on-violet';

export function RoleSwitch() {
  const { state, dispatch } = useStore();
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2">
            <span id="role-label" className="text-small text-ink-muted">
              {copy.role.label}
            </span>
            <ToggleGroup
              type="single"
              value={state.role}
              aria-labelledby="role-label"
              aria-describedby="role-help"
              className="rounded-[var(--radius-row)] border border-line-strong p-0.5 gap-0.5"
              onValueChange={(v) => {
                if (v === 'clinician' || v === 'pharmacist') dispatch({ type: 'SET_ROLE', role: v });
              }}
            >
              <ToggleGroupItem value="clinician" data-testid="role-clinician" className={segmentItem} size="sm">
                {copy.role.clinician}
              </ToggleGroupItem>
              <ToggleGroupItem value="pharmacist" data-testid="role-pharmacist" className={segmentItem} size="sm">
                {copy.role.pharmacist}
              </ToggleGroupItem>
            </ToggleGroup>
            <span id="role-help" className="sr-only">
              {copy.role.tooltip}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent>{copy.role.tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

const THEME_ICON: Record<Theme, typeof Sun> = { system: Monitor, light: Sun, dark: Moon };

export function ThemeMenu() {
  const { theme, setTheme } = useTheme();
  const Icon = THEME_ICON[theme];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="default" data-testid="theme-menu" aria-label={`${copy.theme.label}: ${copy.theme[theme]}`}>
          <Icon size={16} aria-hidden="true" />
          <span className="hidden lg:inline">{copy.theme[theme]}</span>
          <ChevronDown size={14} aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setTheme(v as Theme)}>
          {(['system', 'light', 'dark'] as const).map((t) => (
            <DropdownMenuRadioItem key={t} value={t} data-testid={`theme-${t}`}>
              {copy.theme[t]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ExportMenu() {
  const { state } = useStore();
  const download = useDownload();
  const head = state.history[state.history.length - 1];
  const hasCase = state.sources.length > 0 && state.patient !== null;
  const fhirEnabled = state.ui.fhirReady && head !== undefined;

  const exportCase = () => {
    if (!state.patient) return;
    const text = exportCaseFile(
      {
        scenarioId: state.scenarioId,
        patient: state.patient,
        syntheticNotice: state.syntheticNotice ?? '',
        rawSources: state.rawSources,
        history: state.history,
        resolutions: state.resolutions,
      },
      systemClock,
    );
    download(`medgit-case-${state.scenarioId ?? 'imported'}-${state.resolutions.length === 0 && head ? shortId(head.id) : 'draft'}.json`, text);
  };
  const exportFhir = () => {
    if (!head || !state.patient) return;
    download(`medgit-fhir-${shortId(head.id)}.json`, JSON.stringify(toFhirBundle(head, { patientLabel: state.patient.label }), null, 2));
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" data-testid="export-menu" disabled={!hasCase}>
          <Download size={16} aria-hidden="true" />
          <span className="hidden sm:inline">{copy.export.label}</span>
          <ChevronDown size={14} aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-w-72">
        <DropdownMenuItem data-testid="export-case" onSelect={exportCase}>
          {copy.export.case}
        </DropdownMenuItem>
        <DropdownMenuItem data-testid="export-fhir" disabled={!fhirEnabled} onSelect={exportFhir} className="flex-col items-start">
          <span>{copy.export.fhir}</span>
          {!fhirEnabled && <span className="text-small text-ink-muted whitespace-normal">{copy.export.fhirDisabled}</span>}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ViewNav() {
  const { state } = useStore();
  const hasCase = state.sources.length > 0;
  const items = [
    { view: 'start', label: copy.nav.start, enabled: true },
    { view: 'reconcile', label: copy.nav.reconcile, enabled: hasCase },
    { view: 'history', label: copy.nav.history, enabled: hasCase },
  ] as const;
  return (
    <nav aria-label="Views">
      <ul className="flex items-center gap-1">
        {items.map((i) =>
          i.enabled ? (
            <li key={i.view}>
              <a
                href={`#/${i.view}`}
                data-testid={`nav-${i.view}`}
                aria-current={state.view === i.view ? 'page' : undefined}
                className={cn(
                  'inline-flex items-center h-10 px-2 sm:px-3 rounded-[var(--radius-row)] text-small font-semibold text-ink-muted hover:bg-surface-2 hover:text-ink no-underline',
                  state.view === i.view && 'text-ink underline decoration-violet decoration-2 underline-offset-8',
                )}
              >
                {i.label}
              </a>
            </li>
          ) : null,
        )}
      </ul>
    </nav>
  );
}

/** Validates: review-ui 16.1 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    void error;
    void info;
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="max-w-xl mx-auto my-12 p-6 bg-surface border border-line rounded-[var(--radius-dialog)]">
        <h1 className="text-title font-bold text-ink mb-2">{copy.err.generic}</h1>
        <Button onClick={() => window.location.reload()}>{copy.err.reload}</Button>
      </div>
    );
  }
}
