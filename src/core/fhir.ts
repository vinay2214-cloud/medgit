/**
 * A deliberately small FHIR R4 subset: one Bundle (collection) of MedicationStatement resources
 * built from a commit. Local code system URNs, no terminology. Not a validated FHIR profile.
 * Validates interop-export 3.x, 4.x.
 */

import { err, ok, type FhirError, type Result } from './errors';
import { formatFrequency, formatStrength, parseStrength } from './normalise/index';
import { compareCodeUnits, norm } from './text';
import type { Commit, Frequency, MedEntry, ReasonCode, Status } from './types';

export interface FhirCoding {
  system: string;
  code: string;
  display: string;
}

export interface FhirTag {
  system: 'urn:medgit:tags';
  code: 'synthetic';
  display: 'Synthetic data, not for clinical use';
}

export interface FhirDosage {
  text?: string;
  timing?: { repeat: { frequency: number; period: 1; periodUnit: 'd' } };
  asNeededBoolean?: boolean;
}

export interface FhirMedicationStatement {
  resourceType: 'MedicationStatement';
  id: string;
  meta: { tag: FhirTag[] };
  status: Status;
  medicationCodeableConcept: { coding?: FhirCoding[]; text: string };
  subject: { display: string };
  dateAsserted: string;
  extension?: { url: 'urn:medgit:ext:strength'; valueString: string }[];
  dosage?: FhirDosage[];
  note?: { text: string }[];
}

export interface FhirBundle {
  resourceType: 'Bundle';
  type: 'collection';
  meta: { tag: FhirTag[] };
  identifier: { system: 'urn:medgit:commit'; value: string };
  timestamp: string;
  entry: { fullUrl: string; resource: FhirMedicationStatement }[];
}

export const SYNTHETIC_TAG: FhirTag = { system: 'urn:medgit:tags', code: 'synthetic', display: 'Synthetic data, not for clinical use' };

export const REASON_LABELS: Readonly<Record<ReasonCode, string>> = {
  VERIFIED_WITH_PRESCRIBER: 'Verified with prescriber',
  CONFIRMED_WITH_PATIENT: 'Confirmed with patient',
  PER_DISPENSING_RECORD: 'Per dispensing record',
  PER_DISCHARGE_SUMMARY: 'Per discharge summary',
  CLINICAL_JUDGEMENT: 'Clinical judgement',
  NEEDS_PHARMACIST_REVIEW: 'Needs pharmacist review',
};

function noteFor(commit: Commit, entry: MedEntry): string | null {
  const forDrug = commit.resolutions
    .filter((r) => r.conflictId.slice(0, r.conflictId.lastIndexOf('::')) === entry.drugKey)
    .filter((r) => r.decision.type !== 'escalate' && !(r.conflictId.endsWith('::OMISSION') && r.decision.type === 'exclude'))
    .sort((a, b) => compareCodeUnits(a.conflictId, b.conflictId));
  const custom = forDrug.find((r) => r.decision.type === 'custom');
  if (custom) return `Entered by hand: ${REASON_LABELS[custom.reasonCode]}`;
  const first = forDrug[0];
  if (first) return `Decided: ${REASON_LABELS[first.reasonCode]}`;
  if (commit.agreements.some((a) => a.drugKey === entry.drugKey)) return 'Agreed by all sources';
  return null;
}

function dosageOf(entry: MedEntry): FhirDosage | null {
  const parts = [entry.strength ? formatStrength(entry.strength) : null, entry.frequency ? formatFrequency(entry.frequency) : null].filter(
    (p): p is string => p !== null,
  );
  if (parts.length === 0) return null;
  const d: FhirDosage = { text: parts.join(', ') };
  if (entry.frequency?.kind === 'scheduled') {
    d.timing = { repeat: { frequency: entry.frequency.perDay, period: 1, periodUnit: 'd' } };
    d.asNeededBoolean = false;
  } else if (entry.frequency?.kind === 'prn') {
    d.asNeededBoolean = true;
  }
  return d;
}

/** Deterministic; no clock and no random numbers. Times come from the commit. */
export function toFhirBundle(commit: Commit, ctx: { patientLabel: string }): FhirBundle {
  const short = commit.id.slice(0, 7);
  const entries = [...commit.entries].sort((a, b) => compareCodeUnits(a.drugKey, b.drugKey));
  return {
    resourceType: 'Bundle',
    type: 'collection',
    meta: { tag: [{ ...SYNTHETIC_TAG }] },
    identifier: { system: 'urn:medgit:commit', value: commit.id },
    timestamp: commit.at,
    entry: entries.map((e) => {
      const id = `${short}-${e.drugKey}`;
      const mapped = !e.drugKey.startsWith('unmapped:');
      const resource: FhirMedicationStatement = {
        resourceType: 'MedicationStatement',
        id,
        meta: { tag: [{ ...SYNTHETIC_TAG }] },
        status: e.status,
        medicationCodeableConcept: mapped
          ? { coding: [{ system: 'urn:medgit:formulary', code: e.drugKey, display: e.displayName }], text: e.displayName }
          : { text: e.displayName },
        subject: { display: ctx.patientLabel },
        dateAsserted: commit.at,
      };
      if (e.strength) resource.extension = [{ url: 'urn:medgit:ext:strength', valueString: formatStrength(e.strength) }];
      const dosage = dosageOf(e);
      if (dosage) resource.dosage = [dosage];
      const note = noteFor(commit, e);
      if (note) resource.note = [{ text: note }];
      return { fullUrl: `urn:medgit:${id}`, resource };
    }),
  };
}

// ------------------------------------------------------------------ import (reads only what MedGit writes)

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function bad(message: string): { ok: false; error: FhirError } {
  return err({ code: 'FHIR_INVALID', message });
}

export function fromFhirBundle(bundle: unknown): Result<MedEntry[], FhirError> {
  try {
    if (!isRecord(bundle) || bundle.resourceType !== 'Bundle' || bundle.type !== 'collection') return bad('not a Bundle of type collection');
    if (!Array.isArray(bundle.entry)) return bad('the bundle has no entry list');
    const out: MedEntry[] = [];
    for (let i = 0; i < bundle.entry.length; i++) {
      const wrapper: unknown = bundle.entry[i];
      const res = isRecord(wrapper) ? wrapper.resource : undefined;
      if (!isRecord(res) || res.resourceType !== 'MedicationStatement') return bad(`entry[${i}] is not a MedicationStatement`);
      const status = res.status;
      if (status !== 'active' && status !== 'stopped' && status !== 'on-hold') return bad(`entry[${i}] lacks a valid status`);
      const concept = res.medicationCodeableConcept;
      if (!isRecord(concept)) return bad(`entry[${i}] lacks medicationCodeableConcept`);
      const coding = Array.isArray(concept.coding) ? concept.coding.find((c: unknown) => isRecord(c) && c.system === 'urn:medgit:formulary') : undefined;
      const textValue = typeof concept.text === 'string' ? concept.text : undefined;
      let drugKey: string;
      let displayName: string;
      if (isRecord(coding) && typeof coding.code === 'string' && coding.code !== '') {
        drugKey = coding.code;
        displayName = typeof coding.display === 'string' ? coding.display : (textValue ?? coding.code);
      } else if (textValue !== undefined && textValue.trim() !== '') {
        drugKey = `unmapped:${norm(textValue).replace(/ /g, '-')}`;
        displayName = textValue;
      } else {
        return bad(`entry[${i}] has neither a MedGit coding nor text`);
      }
      const ext = Array.isArray(res.extension) ? res.extension.find((x: unknown) => isRecord(x) && x.url === 'urn:medgit:ext:strength') : undefined;
      const strength = isRecord(ext) && typeof ext.valueString === 'string' ? parseStrength(ext.valueString, null) : null;
      let frequency: Frequency | null = null;
      const dosage: unknown = Array.isArray(res.dosage) ? res.dosage[0] : undefined;
      if (isRecord(dosage)) {
        if (dosage.asNeededBoolean === true) frequency = { kind: 'prn' };
        else if (isRecord(dosage.timing) && isRecord(dosage.timing.repeat)) {
          const r = dosage.timing.repeat;
          const n = r.frequency;
          if (r.period === 1 && r.periodUnit === 'd' && (n === 1 || n === 2 || n === 3 || n === 4)) frequency = { kind: 'scheduled', perDay: n };
        }
      }
      out.push({ drugKey, displayName, strength, frequency, status, flags: [] });
    }
    return ok(out);
  } catch {
    return bad('the bundle could not be read');
  }
}
