"use client";
import { useState } from "react";
import { patch, post } from "@/lib/client";
import { DEAL_STAGES, type DealStage } from "@/lib/types";
import { Button, ErrorNote, Field, Input, Modal, Select, Textarea } from "@/components/app/ui";
import { EntityPicker, type PickerOption } from "./EntityPicker";
import type { DealRow } from "./shared";

export type DealPreset = {
  name?: string;
  stage?: DealStage;
  value?: number;
  company?: PickerOption | null;
  contact?: PickerOption | null;
};

/**
 * Create / edit a deal. Mount it with a `key` per deal so the form state resets.
 * Probability follows the stage default until the user edits it.
 */
export function DealFormModal({
  open,
  onClose,
  deal,
  preset,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  deal?: DealRow | null;
  preset?: DealPreset;
  onSaved: (id: string) => void;
}) {
  const editing = !!deal;
  const [name, setName] = useState(deal?.name ?? preset?.name ?? "");
  const [value, setValue] = useState(deal ? String(deal.value || "") : preset?.value ? String(preset.value) : "");
  const [stage, setStage] = useState<DealStage>(deal?.stage ?? preset?.stage ?? "lead");
  const defaultProb = (s: DealStage) => DEAL_STAGES.find((x) => x.id === s)?.probability ?? 10;
  const [probability, setProbability] = useState(String(deal?.probability ?? defaultProb(deal?.stage ?? preset?.stage ?? "lead")));
  const [probTouched, setProbTouched] = useState(!!deal && deal.probability != null && deal.probability !== defaultProb(deal.stage));
  const [closeDate, setCloseDate] = useState(deal?.close_date ?? "");
  const [notes, setNotes] = useState(deal?.notes ?? "");
  const [company, setCompany] = useState<PickerOption | null>(
    deal?.company_id ? { id: deal.company_id, label: deal.company_name || "Company" } : (preset?.company ?? null),
  );
  const [contact, setContact] = useState<PickerOption | null>(
    deal?.contact_id ? { id: deal.contact_id, label: deal.contact_name || deal.contact_email || "Contact" } : (preset?.contact ?? null),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changeStage = (s: DealStage) => {
    setStage(s);
    if (!probTouched) setProbability(String(defaultProb(s)));
  };

  const pickContact = (c: PickerOption | null) => {
    setContact(c);
    if (c?.company_id && !company) setCompany({ id: c.company_id, label: c.company_name || "Company" });
    if (c && !name.trim() && (c.company_name || company?.label)) setName(`${c.company_name || company?.label} deal`);
  };

  const pickCompany = (c: PickerOption | null) => {
    setCompany(c);
    if (c && !name.trim()) setName(`${c.label} deal`);
  };

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!name.trim()) return setError("Give the deal a name");
    const v = value.trim() ? Number(value.replace(/[^0-9.]/g, "")) : 0;
    if (!Number.isFinite(v) || v < 0) return setError("Value must be a positive number");
    const p = probability.trim() === "" ? null : Number(probability);
    if (p != null && (!Number.isFinite(p) || p < 0 || p > 100)) return setError("Probability must be between 0 and 100");
    setSaving(true);
    setError(null);
    const payload = {
      name: name.trim(),
      value: v,
      stage,
      probability: p,
      close_date: closeDate || null,
      notes: notes.trim() || null,
      company_id: company?.id ?? null,
      contact_id: contact?.id ?? null,
    };
    try {
      if (editing) {
        await patch(`/api/deals/${deal!.id}`, payload);
        onSaved(deal!.id);
      } else {
        const r = await post<{ id: string }>("/api/deals", payload);
        onSaved(r.id);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Edit deal" : "New deal"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={saving} onClick={() => submit()}>
            {editing ? "Save changes" : "Create deal"}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <ErrorNote error={error} />
        <Field label="Deal name">
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Acme — annual platform" maxLength={200} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Company">
            <EntityPicker kind="company" value={company} onChange={pickCompany} />
          </Field>
          <Field label="Primary contact">
            <EntityPicker kind="contact" value={contact} onChange={pickContact} companyId={company?.id} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Value (USD)">
            <Input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder="25000" />
          </Field>
          <Field label="Stage">
            <Select value={stage} onChange={(e) => changeStage(e.target.value as DealStage)}>
              {DEAL_STAGES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Win probability (%)" hint={probTouched ? undefined : "Defaults from the stage"}>
            <Input
              type="number"
              min={0}
              max={100}
              value={probability}
              onChange={(e) => {
                setProbability(e.target.value);
                setProbTouched(true);
              }}
            />
          </Field>
          <Field label="Expected close date">
            <Input type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} />
          </Field>
        </div>
        <Field label="Notes">
          <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Context, pain points, next steps…" />
        </Field>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}
