/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useRouter } from "next/navigation";
import React, { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { iulaanService } from "@/lib/appwrite/app/iulaan.actions";
import {
  AlertCircle,
  FileText,
  Link as LinkIcon,
  RefreshCw,
  Save,
  Sparkles,
} from "lucide-react";

export default function IulaanCreateForm() {
  const router = useRouter();

  const [iulaannumber, setIulaannumber] = useState("");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [content, setContent] = useState("");
  const [fileurl, setFileurl] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return (
      iulaannumber.trim() && title.trim() && subtitle.trim() && content.trim()
    );
  }, [iulaannumber, title, subtitle, content]);

  function resetAll() {
    setIulaannumber("");
    setTitle("");
    setSubtitle("");
    setContent("");
    setFileurl("");
    setError(null);
  }

  async function submit() {
    setError(null);
    if (!canSubmit) {
      setError("އެންމެހައި ފީލްޑުތައް ފުރިހަމަ ކުރައްވާ");
      return;
    }

    setLoading(true);
    try {
      const res = await iulaanService.createIulaan({
        iulaannumber: iulaannumber.trim(),
        title: title.trim(),
        subtitle: subtitle.trim(),
        content: content.trim(),
        fileurl: fileurl.trim() || null,
      });

      if (!res.success || !res.data) {
        setError(res.error || "އިއުލާން ސޭވް ކުރެވުނެއް ނުވޭ");
        return;
      }

      // Redirect to the created iulaan or back to list
      router.push(`/admin/iulaan/${res.data.$id}`);
    } catch (e: any) {
      setError(e?.message || "އިއުލާން ސޭވް ކުރެވުނެއް ނުވޭ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 py-8 px-4 sm:px-6 lg:px-8"
    >
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Decorative Header */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-blue-600/10 blur-3xl"></div>
          <div className="relative bg-white/80 backdrop-blur-xl rounded-3xl border border-blue-100/50 shadow-2xl shadow-blue-500/10 overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>

            <div className="relative p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg shadow-blue-500/30">
                      <Sparkles className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
                        އާ އިއުލާން އުފެއްދުން
                      </h1>
                      <p className="text-sm text-slate-600 mt-1">
                        އިއުލާނުގެ ތަފްޞީލު ލިޔުއްވާ ޕަބްލިޝް ކުރައްވާ
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-2xl border-slate-200 hover:bg-slate-50"
                    onClick={resetAll}
                    disabled={loading}
                  >
                    <RefreshCw className="h-4 w-4 ms-2" />
                    ރީސެޓް
                  </Button>

                  <Button
                    type="button"
                    className="rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg shadow-blue-500/30"
                    disabled={!canSubmit || loading}
                    onClick={submit}
                  >
                    <Save className="h-4 w-4 ms-2" />
                    {loading ? "ސޭވް ކުރަނީ..." : "ޕަބްލިޝް ކުރޭ"}
                  </Button>
                </div>
              </div>

              {error && (
                <div className="mt-4 p-4 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Form Card */}
        <Card className="bg-white/80 backdrop-blur-xl rounded-3xl border border-blue-100/50 shadow-xl overflow-hidden">
          <div className="p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  އިއުލާނުގެ ތަފްޞީލު
                </h2>
                <p className="text-sm text-slate-600">
                  އެންމެހާ މައުލޫމާތު ފުރިހަމަކޮށްލައްވާ
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <FormField label="އިއުލާން ނަންބަރު" required>
                <Input
                  value={iulaannumber}
                  onChange={(e) => setIulaannumber(e.target.value)}
                  placeholder="IUL/2026/001"
                  className="h-12 rounded-2xl text-right bg-white border-slate-200 focus-visible:border-blue-400 focus-visible:ring-blue-400/20"
                />
              </FormField>

              <FormField label="ސުރުޚީ" required>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="އިއުލާނުގެ ސުރުޚީ"
                  className="h-12 rounded-2xl text-right bg-white border-slate-200 focus-visible:border-blue-400 focus-visible:ring-blue-400/20"
                />
              </FormField>

              <FormField label="ސަބް ސުރުޚީ" required className="lg:col-span-2">
                <Input
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="ސަބް ސުރުޚީ ލިޔުއްވާ"
                  className="h-12 rounded-2xl text-right bg-white border-slate-200 focus-visible:border-blue-400 focus-visible:ring-blue-400/20"
                />
              </FormField>

              <FormField label="ތަފްޞީލު" required className="lg:col-span-2">
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="އިއުލާނުގެ ތަފްޞީލު ލިޔުއްވާ..."
                  className="min-h-[200px] rounded-2xl text-right bg-white border-slate-200 focus-visible:border-blue-400 focus-visible:ring-blue-400/20 resize-none"
                />
              </FormField>

              <FormField
                label="ފައިލް ލިންކް"
                className="lg:col-span-2"
                helper="އޮޕްޝަނަލް - ފައިލެއް އެޓޭޗް ކުރަން ބޭނުންނަމަ ލިންކް ލިޔުއްވާ"
              >
                <div className="relative">
                  <Input
                    value={fileurl}
                    onChange={(e) => setFileurl(e.target.value)}
                    placeholder="https://example.com/file.pdf"
                    className="h-12 rounded-2xl text-right bg-white border-slate-200 focus-visible:border-blue-400 focus-visible:ring-blue-400/20 pr-10"
                  />
                  <div className="absolute left-3 top-1/2 -translate-y-1/2">
                    <LinkIcon className="h-4 w-4 text-slate-400" />
                  </div>
                </div>
              </FormField>
            </div>
          </div>
        </Card>

        {/* Info Card */}
        <Card className="bg-gradient-to-br from-blue-50/50 to-purple-50/50 backdrop-blur-xl rounded-2xl border border-blue-100/50 p-6">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-500/10 rounded-xl">
              <AlertCircle className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-slate-900 mb-1">
                މުހިންމު ނޯޓް
              </h3>
              <p className="text-sm text-slate-600">
                އިއުލާން ޕަބްލިޝް ކުރުމުން އެއީ ހުރިހާ ފަރާތްތަކަށް ފެންނާނެ
                އިއުލާނެކެވެ. ޕަބްލިޝް ކުރުމުގެ ކުރިން ތަފްޞީލު ރަނގަޅަށް
                ޗެކްކޮށްލައްވާ.
              </p>
            </div>
          </div>
        </Card>

        {/* Stats Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "ފީލްޑް", value: "5", color: "blue", filled: "5/5" },
            {
              label: "އަކުރު",
              value: content.length,
              color: "purple",
              filled: content.length > 0 ? "✓" : "✗",
            },
            {
              label: "ލިންކް",
              value: fileurl ? "✓" : "✗",
              color: "emerald",
              filled: fileurl ? "އެބަހުރި" : "ނެތް",
            },
            {
              label: "ހާލަތު",
              value: canSubmit ? "✓" : "✗",
              color: canSubmit ? "emerald" : "slate",
              filled: canSubmit ? "ތައްޔާރު" : "މަސައްކަތް",
            },
          ].map((stat) => (
            <Card
              key={stat.label}
              className="bg-white/80 backdrop-blur-xl rounded-2xl border border-slate-100/50 p-4 text-center"
            >
              <div className="text-sm text-slate-600 mb-1">{stat.label}</div>
              <div className={`text-2xl font-bold text-${stat.color}-600 mb-1`}>
                {stat.value}
              </div>
              <Badge variant="outline" className="rounded-lg text-xs">
                {stat.filled}
              </Badge>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function FormField({
  label,
  children,
  required = false,
  helper,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  helper?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block mb-2 text-sm font-medium text-slate-700 text-right">
        {label}
        {required && <span className="text-red-500 mr-1">*</span>}
      </label>
      {children}
      {helper && (
        <p className="mt-1.5 text-xs text-slate-500 text-right">{helper}</p>
      )}
    </div>
  );
}
