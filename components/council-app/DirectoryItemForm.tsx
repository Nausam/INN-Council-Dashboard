"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save, Trash2 } from "lucide-react";
import * as React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type DirectoryKind = "service" | "competition";

export type DirectoryItemFormValues = {
  kind: DirectoryKind;
  title: string;
  description: string;
  category?: string;
  published: boolean;
};

const schema = z.object({
  kind: z.enum(["service", "competition"]),
  title: z.string().trim().min(2, "ސުރުޚީ ލިޔުއްވާ"),
  description: z.string().trim().min(2, "ތަފްޞީލު ލިޔުއްވާ"),
  category: z.string().trim().optional(),
  published: z.boolean().default(true),
});

type Props = {
  mode?: "create" | "edit";
  initialValues?: Partial<DirectoryItemFormValues>;
  onSubmit: (values: DirectoryItemFormValues) => Promise<void> | void;

  // Optional: show a delete button in edit mode
  onDelete?: () => Promise<void> | void;

  className?: string;
};

export default function DirectoryItemForm({
  mode = "create",
  initialValues,
  onSubmit,
  onDelete,
  className,
}: Props) {
  const [loading, setLoading] = React.useState(false);
  const isEdit = mode === "edit";

  const form = useForm<DirectoryItemFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      kind: initialValues?.kind ?? "service",
      title: initialValues?.title ?? "",
      description: initialValues?.description ?? "",
      category: initialValues?.category ?? "",
      published: initialValues?.published ?? true,
    },
  });

  const handleSubmit = async (values: DirectoryItemFormValues) => {
    setLoading(true);
    try {
      await onSubmit({
        ...values,
        title: values.title.trim(),
        description: values.description.trim(),
        category: values.category?.trim() || "",
      });
      if (!isEdit) form.reset({ ...values, title: "", description: "" });
    } finally {
      setLoading(false);
    }
  };

  const kindLabel =
    form.watch("kind") === "competition" ? "މުބާރާތު" : "ސާރވިސް";

  return (
    <Card
      className={cn(
        "relative overflow-hidden rounded-2xl border-0 shadow-sm",
        className,
      )}
    >
      {/* gradient micro-frame (clean, modern) */}
      <div className="absolute inset-0 bg-[radial-gradient(1200px_circle_at_20%_-10%,rgba(124,58,237,0.12),transparent_50%),radial-gradient(900px_circle_at_90%_0%,rgba(14,165,233,0.10),transparent_45%)]" />
      <div className="absolute inset-0 rounded-2xl ring-1 ring-slate-200/70" />
      <div className="relative p-6 md:p-7" dir="rtl">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="font-dh1 text-xs text-violet-600 tracking-widest">
              ހިދުމަތްތައް • މުބާރާތުތައް
            </p>
            <h2 className="font-dh1 text-2xl text-slate-900">
              {isEdit ? "ބަދަލުކުރުން" : "އައު ކާޑު ހެދުން"}
            </h2>
          </div>

          <div className="shrink-0 rounded-full bg-white/70 px-3 py-1.5 ring-1 ring-slate-200/70">
            <span className="font-dh1 text-xs text-slate-700">{kindLabel}</span>
          </div>
        </div>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="grid gap-5"
          >
            {/* Kind */}
            <FormField
              control={form.control}
              name="kind"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-dh1 text-slate-800">
                    ބާވަތް
                  </FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="h-12 rounded-2xl bg-white ring-1 ring-slate-200/70 focus-visible:ring-2 focus-visible:ring-violet-500">
                        <SelectValue placeholder="ބާވަތް އިޚްތިޔާރުކުރޭ" />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl">
                        <SelectItem value="service" className="font-dh1">
                          ސާރވިސް
                        </SelectItem>
                        <SelectItem value="competition" className="font-dh1">
                          މުބާރާތު
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormDescription className="font-dh1 text-xs text-slate-500">
                    ކާޑު ހުރި ބާވަތް އިޚްތިޔާރުކުރޭ
                  </FormDescription>
                  <FormMessage className="font-dh1" />
                </FormItem>
              )}
            />

            {/* Title */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-dh1 text-slate-800">
                    ސުރުޚީ
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      className="h-12 rounded-2xl bg-white text-right font-dh1 ring-1 ring-slate-200/70 focus-visible:ring-2 focus-visible:ring-violet-500"
                      placeholder="މިތާ ސުރުޚީ ލިޔުއްވާ..."
                    />
                  </FormControl>
                  <FormMessage className="font-dh1" />
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-dh1 text-slate-800">
                    ތަފްޞީލު
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={5}
                      className="rounded-2xl bg-white text-right font-dh1 ring-1 ring-slate-200/70 focus-visible:ring-2 focus-visible:ring-violet-500 leading-7"
                      placeholder="ކާޑު ގެ ތަފްޞީލު ލިޔުއްވާ..."
                    />
                  </FormControl>
                  <FormMessage className="font-dh1" />
                </FormItem>
              )}
            />

            {/* Optional: Category */}
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-dh1 text-slate-800">
                    ކެޓަގަރީ (އޮޕްޝަނަލް)
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      className="h-12 rounded-2xl bg-white text-right font-dh1 ring-1 ring-slate-200/70 focus-visible:ring-2 focus-visible:ring-violet-500"
                      placeholder="މިސާލު: މައުލޫމާތު / ސްޕޯޓްސް ..."
                    />
                  </FormControl>
                  <FormDescription className="font-dh1 text-xs text-slate-500">
                    ފިލްޓަރ އަދި ސޯޓް އަށް ފަހު ބޭނުންވާ
                  </FormDescription>
                  <FormMessage className="font-dh1" />
                </FormItem>
              )}
            />

            {/* Published toggle */}
            <FormField
              control={form.control}
              name="published"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-2xl bg-white/70 p-4 ring-1 ring-slate-200/70">
                  <div className="space-y-1">
                    <FormLabel className="font-dh1 text-slate-800">
                      ޕަބްލިޝް
                    </FormLabel>
                    <FormDescription className="font-dh1 text-xs text-slate-500">
                      ޕަބްލިޝް ނުކުރެވިއްޖެ ނަމަ އެޕް އަށް ނުފެންނާނެ
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Actions */}
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              {isEdit && onDelete && (
                <Button
                  type="button"
                  variant="destructive"
                  className="rounded-2xl"
                  onClick={onDelete}
                  disabled={loading}
                >
                  <Trash2 className="ml-2 h-4 w-4" />
                  <span className="font-dh1">ޑިލީޓް</span>
                </Button>
              )}

              <div className="flex gap-3 sm:mr-auto">
                <Button
                  type="button"
                  variant="secondary"
                  className="rounded-2xl bg-white ring-1 ring-slate-200/70 hover:bg-white"
                  onClick={() => form.reset()}
                  disabled={loading}
                >
                  <span className="font-dh1">ރީސެޓް</span>
                </Button>

                <Button
                  type="submit"
                  className="rounded-2xl"
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="ml-2 h-4 w-4" />
                  )}
                  <span className="font-dh1">{isEdit ? "ސޭވް" : "އެޑް"}</span>
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </div>
    </Card>
  );
}
