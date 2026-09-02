import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/currency";

// ─── Types ────────────────────────────────────────────────────────────────────
export type DebtKind = "customer" | "supplier";

export interface Debt {
  id: number;
  /** customerName or supplierName, normalised to "name" by the hook layer */
  name: string;
  phone?: string | null;
  description: string;
  amount: number;
  amountPaid: number;
  remaining: number;
  dueDate?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── API helpers (no generated hooks — we call fetch directly) ────────────────
const BASE = "/api";

async function apiPost(path: string, body: unknown): Promise<Debt> {
  const r = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function apiPatch(path: string, body: unknown): Promise<Debt> {
  const r = await fetch(`${BASE}${path}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

// ─── Query keys ───────────────────────────────────────────────────────────────
export const CUSTOMER_DEBTS_KEY = ["debts", "customers"] as const;
export const SUPPLIER_DEBTS_KEY = ["debts", "suppliers"] as const;

// ─── form schema ──────────────────────────────────────────────────────────────
const schema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().optional(),
  description: z.string().min(1, "Description is required"),
  amount: z.coerce.number().positive("Must be positive"),
  amountPaid: z.coerce.number().min(0, "Cannot be negative"),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
}).refine((d) => d.amountPaid <= d.amount, {
  message: "Amount paid cannot exceed the total",
  path: ["amountPaid"],
});

type FormValues = z.infer<typeof schema>;

interface DebtDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  kind: DebtKind;
  debt?: Debt | null;
}

export function DebtDialog({ open, onOpenChange, kind, debt }: DebtDialogProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const queryKey = kind === "customer" ? CUSTOMER_DEBTS_KEY : SUPPLIER_DEBTS_KEY;
  const path = kind === "customer" ? "/debts/customers" : "/debts/suppliers";
  const label = kind === "customer" ? "Customer" : "Supplier";

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      phone: "",
      description: "",
      amount: 0,
      amountPaid: 0,
      dueDate: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset(
        debt
          ? {
              name: debt.name,
              phone: debt.phone ?? "",
              description: debt.description,
              amount: debt.amount,
              amountPaid: debt.amountPaid,
              dueDate: debt.dueDate ?? "",
              notes: debt.notes ?? "",
            }
          : { name: "", phone: "", description: "", amount: 0, amountPaid: 0, dueDate: "", notes: "" },
      );
    }
  }, [open, debt, form]);

  const isPending = form.formState.isSubmitting;

  const onSubmit = async (values: FormValues) => {
    try {
      const body = {
        name: values.name,
        phone: values.phone || undefined,
        description: values.description,
        amount: values.amount,
        amountPaid: values.amountPaid,
        dueDate: values.dueDate || undefined,
        notes: values.notes || undefined,
      };
      if (debt) {
        await apiPatch(`${path}/${debt.id}`, body);
        toast({ title: `${label} debt updated` });
      } else {
        await apiPost(path, body);
        toast({ title: `${label} debt recorded` });
      }
      qc.invalidateQueries({ queryKey });
      onOpenChange(false);
    } catch {
      toast({ title: "Something went wrong", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>
            {debt ? `Edit ${label} Debt` : `Add ${label} Debt`}
          </DialogTitle>
          <DialogDescription>
            {kind === "customer"
              ? "Record money a customer owes you."
              : "Record money you owe to a supplier."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-1">
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>{label} Name</FormLabel>
                  <FormControl><Input placeholder={kind === "customer" ? "e.g. Jane Doe" : "e.g. Supplier Co."} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone <span className="text-muted-foreground text-xs">(optional)</span></FormLabel>
                  <FormControl><Input placeholder="07xx…" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="dueDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Due Date <span className="text-muted-foreground text-xs">(optional)</span></FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl><Input placeholder="What is this debt for?" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="amount" render={({ field }) => (
                <FormItem>
                  <FormLabel>Total Amount (KSh)</FormLabel>
                  <FormControl><Input type="number" min="0" step="0.01" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="amountPaid" render={({ field }) => (
                <FormItem>
                  <FormLabel>Already Paid (KSh)</FormLabel>
                  <FormControl><Input type="number" min="0" step="0.01" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {/* live remaining preview */}
            {(() => {
              const amt = Number(form.watch("amount") || 0);
              const paid = Number(form.watch("amountPaid") || 0);
              const rem = Math.max(0, amt - paid);
              if (amt <= 0) return null;
              return (
                <p className="text-xs text-muted-foreground px-1">
                  Remaining:{" "}
                  <span className={rem > 0 ? "font-semibold text-foreground" : "text-primary font-semibold"}>
                    {formatCurrency(rem)}
                  </span>
                  {rem === 0 && " — fully settled 🎉"}
                </p>
              );
            })()}

            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Notes <span className="text-muted-foreground text-xs">(optional)</span></FormLabel>
                <FormControl><Textarea placeholder="Any extra context…" rows={2} {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : debt ? "Save Changes" : "Add Debt"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Record Payment dialog ────────────────────────────────────────────────────
const paySchema = z.object({ amountPaid: z.coerce.number().min(0) });

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  kind: DebtKind;
  debt: Debt | null;
}

export function RecordPaymentDialog({ open, onOpenChange, kind, debt }: PaymentDialogProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const queryKey = kind === "customer" ? CUSTOMER_DEBTS_KEY : SUPPLIER_DEBTS_KEY;
  const path = kind === "customer" ? "/debts/customers" : "/debts/suppliers";

  const form = useForm<{ amountPaid: number }>({
    resolver: zodResolver(paySchema),
    defaultValues: { amountPaid: 0 },
  });

  useEffect(() => {
    if (open && debt) form.reset({ amountPaid: debt.amountPaid });
  }, [open, debt, form]);

  if (!debt) return null;

  const onSubmit = async (values: { amountPaid: number }) => {
    try {
      await apiPatch(`${path}/${debt.id}/payment`, { amountPaid: values.amountPaid });
      toast({ title: "Payment recorded" });
      qc.invalidateQueries({ queryKey });
      onOpenChange(false);
    } catch {
      toast({ title: "Failed to record payment", variant: "destructive" });
    }
  };

  const newRemaining = Math.max(0, debt.amount - Number(form.watch("amountPaid") || 0));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[360px]">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
          <DialogDescription>
            Update how much has been paid on this debt.
          </DialogDescription>
        </DialogHeader>
        <div className="text-sm space-y-0.5 py-1">
          <p className="font-medium text-foreground">{debt.name}</p>
          <p className="text-muted-foreground text-xs">{debt.description}</p>
          <p className="text-xs text-muted-foreground">
            Total: <span className="font-medium text-foreground">{formatCurrency(debt.amount)}</span>
          </p>
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="amountPaid" render={({ field }) => (
              <FormItem>
                <FormLabel>Total Amount Paid So Far (KSh)</FormLabel>
                <FormControl><Input type="number" min="0" max={debt.amount} step="0.01" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <p className="text-xs text-muted-foreground">
              Still remaining:{" "}
              <span className={newRemaining === 0 ? "text-primary font-semibold" : "font-semibold text-foreground"}>
                {formatCurrency(newRemaining)}
              </span>
              {newRemaining === 0 && " — fully settled 🎉"}
            </p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Saving…" : "Save Payment"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
