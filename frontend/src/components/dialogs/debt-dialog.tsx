import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
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

// ─── API helpers ───────────────────────────────────────────────────────────────
const API_BASE_URL = (
  import.meta.env.VITE_API_URL ?? ""
).replace(/\/+$/, "");

async function apiPost(
  path: string,
  body: unknown,
): Promise<Debt> {
  const r = await fetch(`${API_BASE_URL}/api${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    throw new Error(await r.text());
  }

  return r.json();
}

async function apiPatch(
  path: string,
  body: unknown,
): Promise<Debt> {
  const r = await fetch(`${API_BASE_URL}/api${path}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    throw new Error(await r.text());
  }

  return r.json();
}

// ─── Query keys ───────────────────────────────────────────────────────────────
export const CUSTOMER_DEBTS_KEY = [
  "debts",
  "customers",
] as const;

export const SUPPLIER_DEBTS_KEY = [
  "debts",
  "suppliers",
] as const;

// ─── form schema ──────────────────────────────────────────────────────────────
const schema = z
  .object({
    name: z.string().min(1, "Name is required"),
    phone: z.string().optional(),
    description: z
      .string()
      .min(1, "Description is required"),
    amount: z.coerce
      .number()
      .positive("Must be positive"),
    amountPaid: z.coerce
      .number()
      .min(0, "Cannot be negative"),
    dueDate: z.string().optional(),
    notes: z.string().optional(),
  })
  .refine((d) => d.amountPaid <= d.amount, {
    message:
      "Amount paid cannot exceed the total",
    path: ["amountPaid"],
  });

type FormValues = z.infer<typeof schema>;

interface DebtDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  kind: DebtKind;
  debt?: Debt | null;
}

export function DebtDialog({
  open,
  onOpenChange,
  kind,
  debt,
}: DebtDialogProps) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const queryKey =
    kind === "customer"
      ? CUSTOMER_DEBTS_KEY
      : SUPPLIER_DEBTS_KEY;

  const path =
    kind === "customer"
      ? "/debts/customers"
      : "/debts/suppliers";

  const label =
    kind === "customer"
      ? "Customer"
      : "Supplier";

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
          : {
              name: "",
              phone: "",
              description: "",
              amount: 0,
              amountPaid: 0,
              dueDate: "",
              notes: "",
            },
      );
    }
  }, [open, debt, form]);

  const isPending =
    form.formState.isSubmitting;

  const onSubmit = async (
    values: FormValues,
  ) => {
    try {
      const body = {
        name: values.name,
        phone:
          values.phone || undefined,
        description:
          values.description,
        amount: values.amount,
        amountPaid:
          values.amountPaid,
        dueDate:
          values.dueDate || undefined,
        notes:
          values.notes || undefined,
      };

      if (debt) {
        await apiPatch(
          `${path}/${debt.id}`,
          body,
        );

        toast({
          title: `${label} debt updated`,
        });
      } else {
        await apiPost(path, body);

        toast({
          title: `${label} debt recorded`,
        });
      }

      qc.invalidateQueries({
        queryKey,
      });

      onOpenChange(false);
    } catch {
      toast({
        title: "Something went wrong",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>
            {debt
              ? `Edit ${label} Debt`
              : `Add ${label} Debt`}
          </DialogTitle>

          <DialogDescription>
            {kind === "customer"
              ? "Record money a customer owes you."
              : "Record money you owe to a supplier."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(
              onSubmit,
            )}
            className="space-y-4 pt-1"
          >
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>
                      {label} Name
                    </FormLabel>

                    <FormControl>
                      <Input
                        placeholder={
                          kind ===
                          "customer"
                            ? "e.g. Jane Doe"
                            : "e.g. Supplier Co."
                        }
                        {...field}
                      />
                    </FormControl>

                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Phone{" "}
                      <span className="text-muted-foreground text-xs">
                        (optional)
                      </span>
                    </FormLabel>

                    <FormControl>
                      <Input
                        placeholder="07xx…"
                        {...field}
                      />
                    </FormControl>

                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Due Date{" "}
                      <span className="text-muted-foreground text-xs">
                        (optional)
                      </span>
                    </FormLabel>

                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                      />
                    </FormControl>

                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Description
                  </FormLabel>

                  <FormControl>
                    <Input
                      placeholder="What is this debt for?"
                      {...field}
                    />
                  </FormControl>

                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Total Amount (KSh)
                    </FormLabel>

                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        {...field}
                      />
                    </FormControl>

                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="amountPaid"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Already Paid (KSh)
                    </FormLabel>

                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        {...field}
                      />
                    </FormControl>

                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {(() => {
              const amt = Number(
                form.watch("amount") || 0,
              );

              const paid = Number(
                form.watch("amountPaid") ||
                  0,
              );

              const rem = Math.max(
                0,
                amt - paid,
              );

              if (amt <= 0) {
                return null;
              }

              return (
                <p className="text-xs text-muted-foreground px-1">
                  Remaining:{" "}
                  <span
                    className={
                      rem > 0
                        ? "font-semibold text-foreground"
                        : "text-primary font-semibold"
                    }
                  >
                    {formatCurrency(rem)}
                  </span>

                  {rem === 0 &&
                    " — fully settled 🎉"}
                </p>
              );
            })()}

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Notes{" "}
                    <span className="text-muted-foreground text-xs">
                      (optional)
                    </span>
                  </FormLabel>

                  <FormControl>
                    <Textarea
                      placeholder="Any extra context…"
                      rows={2}
                      {...field}
                    />
                  </FormControl>

                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  onOpenChange(false)
                }
              >
                Cancel
              </Button>

              <Button
                type="submit"
                disabled={isPending}
              >
                {isPending
                  ? "Saving…"
                  : debt
                    ? "Save Changes"
                    : "Add Debt"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Record Payment dialog ────────────────────────────────────────────────────

const paySchema = z.object({
  amountPaid: z.coerce
    .number()
    .positive("Payment must be greater than 0"),
});

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  kind: DebtKind;
  debt: Debt | null;
}

export function RecordPaymentDialog({
  open,
  onOpenChange,
  kind,
  debt,
}: PaymentDialogProps) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const queryKey =
    kind === "customer"
      ? CUSTOMER_DEBTS_KEY
      : SUPPLIER_DEBTS_KEY;

  const path =
    kind === "customer"
      ? "/debts/customers"
      : "/debts/suppliers";

  const form = useForm<{
    amountPaid: number;
  }>({
    resolver: zodResolver(paySchema),
    defaultValues: {
      amountPaid: 0,
    },
  });

  useEffect(() => {
    if (!open || !debt) return;

    form.reset({
      // Customer endpoint still expects the cumulative amount paid.
      // Supplier endpoint now expects only the payment being made now.
      amountPaid:
        kind === "customer"
          ? debt.amountPaid
          : 0,
    });
  }, [open, debt, kind, form]);

  if (!debt) {
    return null;
  }

  const currentRemaining = Math.max(
    0,
    debt.remaining,
  );

  const enteredAmount = Number(
    form.watch("amountPaid") || 0,
  );

  const newRemaining =
    kind === "supplier"
      ? Math.max(
          0,
          currentRemaining -
            enteredAmount,
        )
      : Math.max(
          0,
          debt.amount -
            enteredAmount,
        );

  const onSubmit = async (values: {
    amountPaid: number;
  }) => {
    try {
      if (
        kind === "supplier" &&
        values.amountPaid >
          currentRemaining
      ) {
        form.setError("amountPaid", {
          type: "manual",
          message:
            "Payment cannot exceed the remaining balance",
        });
        return;
      }

      await apiPatch(
        `${path}/${debt.id}/payment`,
        {
          amountPaid:
            values.amountPaid,
        },
      );

      toast({
        title: "Payment recorded",
      });

      qc.invalidateQueries({
        queryKey,
      });

      // A supplier debt may belong to a purchase.
      // Refresh purchase data so its balance/status changes immediately.
      if (kind === "supplier") {
        qc.invalidateQueries({
          queryKey: [
            "/api/stock-purchases",
          ],
        });
      }

      onOpenChange(false);
    } catch (error) {
      toast({
        title:
          "Failed to record payment",
        description:
          error instanceof Error
            ? error.message
            : undefined,
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle>
            Record Payment
          </DialogTitle>

          <DialogDescription>
            {kind === "supplier"
              ? "Record money you are paying to this supplier now."
              : "Update how much the customer has paid on this debt."}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-border bg-muted/20 p-3">
          <p className="text-sm font-medium text-foreground">
            {debt.name}
          </p>

          <p className="mt-0.5 text-xs text-muted-foreground">
            {debt.description}
          </p>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] text-muted-foreground">
                Total debt
              </p>

              <p className="text-sm font-semibold tabular-nums">
                {formatCurrency(
                  debt.amount,
                )}
              </p>
            </div>

            <div>
              <p className="text-[10px] text-muted-foreground">
                {kind === "supplier"
                  ? "Still owed"
                  : "Already paid"}
              </p>

              <p className="text-sm font-semibold tabular-nums">
                {formatCurrency(
                  kind === "supplier"
                    ? currentRemaining
                    : debt.amountPaid,
                )}
              </p>
            </div>
          </div>
        </div>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(
              onSubmit,
            )}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="amountPaid"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {kind === "supplier"
                      ? "Payment Amount (KSh)"
                      : "Total Amount Paid So Far (KSh)"}
                  </FormLabel>

                  <FormControl>
                    <Input
                      type="number"
                      min={
                        kind === "supplier"
                          ? "0.01"
                          : "0"
                      }
                      max={
                        kind === "supplier"
                          ? currentRemaining
                          : debt.amount
                      }
                      step="0.01"
                      placeholder={
                        kind === "supplier"
                          ? "Enter amount paid now"
                          : undefined
                      }
                      {...field}
                    />
                  </FormControl>

                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="rounded-lg bg-muted/40 px-3 py-2.5">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="text-muted-foreground">
                  Balance after payment
                </span>

                <span
                  className={
                    newRemaining === 0
                      ? "font-semibold text-primary"
                      : "font-semibold text-foreground"
                  }
                >
                  {formatCurrency(
                    newRemaining,
                  )}
                </span>
              </div>

              {newRemaining === 0 &&
                enteredAmount > 0 && (
                  <p className="mt-1 text-[10px] font-medium text-primary">
                    This debt will be fully settled.
                  </p>
                )}
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  onOpenChange(false)
                }
              >
                Cancel
              </Button>

              <Button
                type="submit"
                disabled={
                  form.formState
                    .isSubmitting
                }
              >
                {form.formState
                  .isSubmitting
                  ? "Recording…"
                  : "Record Payment"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
