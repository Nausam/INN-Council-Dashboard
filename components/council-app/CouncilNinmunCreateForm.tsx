/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useRouter } from "next/navigation";
import React, { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { ninmunService } from "@/lib/appwrite/app/ninmim.actions";
import { NinmunVoteValue } from "@/lib/types/database";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  RefreshCw,
  Save,
  Sparkles,
  Users,
  Vote,
} from "lucide-react";

const COUNCILLORS = [
  { id: "c1", name: "ޢަޙްމަދު އަޒުމީނު" },
  { id: "c2", name: "ޢަޙްމަދު ރުޒާނު" },
  { id: "c3", name: "އިބްރާހިމް ނުހާނު" },
  { id: "c4", name: "އާމިނަތު ސަމާޙާ" },
  { id: "c5", name: "އާއިޝަތު ސަމާހާ" },
] as const;

function emptyVotes() {
  const v: Record<string, NinmunVoteValue> = {};
  for (const c of COUNCILLORS) v[c.id] = "ABSENT";
  return v;
}

function voteLabel(v: NinmunVoteValue) {
  switch (v) {
    case "FOR":
      return "އެއްބަސް";
    case "AGAINST":
      return "އެންޓި";
    case "ABSTAIN":
      return "އަބްސްޓޭން";
    case "ABSENT":
    default:
      return "ހާޒިރު ނުވެ";
  }
}

function voteBadgeVariant(v: NinmunVoteValue) {
  if (v === "FOR") return "default";
  if (v === "AGAINST") return "destructive";
  if (v === "ABSTAIN") return "secondary";
  return "outline";
}

function voteColor(v: NinmunVoteValue) {
  if (v === "FOR")
    return "from-emerald-500/20 to-green-500/20 border-emerald-500/30";
  if (v === "AGAINST")
    return "from-red-500/20 to-rose-500/20 border-red-500/30";
  if (v === "ABSTAIN")
    return "from-amber-500/20 to-yellow-500/20 border-amber-500/30";
  return "from-slate-500/10 to-gray-500/10 border-slate-500/20";
}

export default function CouncilNinmunCreateForm() {
  const router = useRouter();

  const [publicationNumber, setPublicationNumber] = useState("");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [issue, setIssue] = useState("");
  const [issuetakenby, setIssuetakenby] = useState("");
  const [issuepresentedby, setIssuepresentedby] = useState("");
  const [finalnote, setFinalnote] = useState("");

  const [votes, setVotes] =
    useState<Record<string, NinmunVoteValue>>(emptyVotes());

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return (
      publicationNumber.trim() &&
      title.trim() &&
      subtitle.trim() &&
      issue.trim() &&
      issuetakenby.trim() &&
      issuepresentedby.trim() &&
      finalnote.trim()
    );
  }, [
    publicationNumber,
    title,
    subtitle,
    issue,
    issuetakenby,
    issuepresentedby,
    finalnote,
  ]);

  function resetAll() {
    setPublicationNumber("");
    setTitle("");
    setSubtitle("");
    setIssue("");
    setIssuetakenby("");
    setIssuepresentedby("");
    setFinalnote("");
    setVotes(emptyVotes());
    setError(null);
  }

  async function submit() {
    setError(null);
    if (!canSubmit) {
      setError(
        "އެއްޗެއް ހުރި ފީލްޑުތަކެއް ހުސް ކޮށްފައި އެބައިން. ފުރައި ލައްވާ",
      );
      return;
    }

    setLoading(true);
    try {
      const payloadVotes = COUNCILLORS.map((c) => ({
        councillorId: c.id,
        vote: votes[c.id] ?? "ABSENT",
      }));

      const res = await ninmunService.createNinmun({
        publicationNumber: publicationNumber.trim(),
        title: title.trim(),
        subtitle: subtitle.trim(),
        issue: issue.trim(),
        issuetakenby: issuetakenby.trim(),
        issuepresentedby: issuepresentedby.trim(),
        finalnote: finalnote.trim(),
        votes: payloadVotes,
      });

      if (!res.success || !res.data) {
        setError(
          res.error || "ނިމުން ސޭވް ކުރެވޭނެ ނުވަތަ މައްސަލައެއް ޖެހިއްޖެ",
        );
        return;
      }

      router.push(`/admin/ninmun/${res.data.$id}`);
    } catch (e: any) {
      setError(e?.message || "ނިމުން ސޭވް ކުރެވޭނެ ނުވަތަ މައްސަލައެއް");
    } finally {
      setLoading(false);
    }
  }

  const voteStats = useMemo(() => {
    const stats = { FOR: 0, AGAINST: 0, ABSTAIN: 0, ABSENT: 0 };
    Object.values(votes).forEach((v) => stats[v]++);
    return stats;
  }, [votes]);

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-blue-50/20 py-8 px-4 sm:px-6 lg:px-8"
    >
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Decorative Header */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-600/10 via-blue-600/10 to-purple-600/10 blur-3xl"></div>
          <div className="relative bg-white/80 backdrop-blur-xl rounded-3xl border border-purple-100/50 shadow-2xl shadow-purple-500/10 overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-purple-500/10 to-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>

            <div className="relative p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl shadow-lg shadow-purple-500/30">
                      <Sparkles className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h1 className="text-2xl sm:text-3xl font-dh1 text-slate-900">
                        ކައުންސިލް ނިންމުން އުފެއްދުން
                      </h1>
                      <p className="text-sm font-dh1 text-slate-600 mt-1">
                        އާ ނިންމުމެއް ނުވަތަ މިނިޓް ލިޔުއްވާ ސޭވް ކުރައްވާ
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-2xl font-dh1 border-slate-200 hover:bg-slate-50"
                    onClick={resetAll}
                    disabled={loading}
                  >
                    <RefreshCw className="h-4 w-4 ms-2" />
                    ރީސެޓް
                  </Button>

                  <Button
                    type="button"
                    className="rounded-2xl font-dh1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 shadow-lg shadow-purple-500/30"
                    disabled={!canSubmit || loading}
                    onClick={submit}
                  >
                    <Save className="h-4 w-4 ms-2" />
                    {loading ? "ސޭވް ކުރަނީ..." : "ސޭވް ކުރޭ"}
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
        <Card className="bg-white/80 backdrop-blur-xl rounded-3xl border border-purple-100/50 shadow-xl overflow-hidden">
          <div className="p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-dh1 text-slate-900">ތަފްޞީލު</h2>
                <p className="text-sm font-dh1 text-slate-600">
                  އެންމެހާ ތަފްޞީލު ފުރިހަމަކޮށްލައްވާ
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <FormField
                className="font-dh1"
                label="ޕަބްލިކޭޝަން ނަންބަރު"
                required
              >
                <Input
                  value={publicationNumber}
                  onChange={(e) => setPublicationNumber(e.target.value)}
                  placeholder="MTG/307/INDIV/2026/01"
                  className="h-12 rounded-2xl text-right font-dh1 bg-white border-slate-200 focus-visible:border-purple-400 focus-visible:ring-purple-400/20"
                />
              </FormField>

              <FormField className="font-dh1" label="ސުރުޚީ" required>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="ނިންމުމުގެ ސުރުޚީ"
                  className="h-12 rounded-2xl font-dh1 text-right bg-white border-slate-200 focus-visible:border-purple-400 focus-visible:ring-purple-400/20"
                />
              </FormField>

              <FormField
                label="ސަބް ސުރުޚީ"
                required
                className="lg:col-span-2 font-dh1 "
              >
                <Input
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="ސަބް ސުރުޚީ"
                  className="h-12 font-dh1 rounded-2xl text-right bg-white border-slate-200 focus-visible:border-purple-400 focus-visible:ring-purple-400/20"
                />
              </FormField>

              <FormField
                label="މައްސަލަ / އިޝޫ"
                required
                className="lg:col-span-2 font-dh1"
              >
                <Textarea
                  value={issue}
                  onChange={(e) => setIssue(e.target.value)}
                  placeholder="އިޝޫއާބެހޭ ތަފްޞީލު ލިޔުއްވާ..."
                  className="min-h-[160px] font-dh1 rounded-2xl text-right bg-white border-slate-200 focus-visible:border-purple-400 focus-visible:ring-purple-400/20 resize-none"
                />
              </FormField>

              <FormField className="font-dh1" label="އިޝޫ ނެގި ފަރާތް" required>
                <Input
                  value={issuetakenby}
                  onChange={(e) => setIssuetakenby(e.target.value)}
                  placeholder="ނަން ލިޔުއްވާ"
                  className="h-12 font-dh1 rounded-2xl text-right bg-white border-slate-200 focus-visible:border-purple-400 focus-visible:ring-purple-400/20"
                />
              </FormField>

              <FormField
                className="font-dh1"
                label="އިޝޫ ހުށަހަޅާ ފަރާތް"
                required
              >
                <Input
                  value={issuepresentedby}
                  onChange={(e) => setIssuepresentedby(e.target.value)}
                  placeholder="ނަން ލިޔުއްވާ"
                  className="h-12 font-dh1 rounded-2xl text-right bg-white border-slate-200 focus-visible:border-purple-400 focus-visible:ring-purple-400/20"
                />
              </FormField>

              <FormField
                label="ފައިނަލް ނޯޓް"
                required
                className="lg:col-span-2 font-dh1"
              >
                <Textarea
                  value={finalnote}
                  onChange={(e) => setFinalnote(e.target.value)}
                  placeholder="ފައިނަލް ނޯޓް ލިޔުއްވާ..."
                  className="min-h-[140px] font-dh1 rounded-2xl text-right bg-white border-slate-200 focus-visible:border-purple-400 focus-visible:ring-purple-400/20 resize-none"
                />
              </FormField>
            </div>
          </div>
        </Card>

        {/* Voting Section */}
        <Card className="bg-white/80 backdrop-blur-xl rounded-3xl border border-purple-100/50 shadow-xl overflow-hidden">
          <div className="p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl">
                  <Users className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-dh1 text-slate-900">
                    ވޯޓު ލިސްޓް
                  </h2>
                  <p className="text-sm font-dh1 text-slate-600">
                    ކޮންސިލަރުންގެ ވޯޓު ސެޓްކުރައްވާ
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <Badge className="rounded-xl font-dh1 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                  {voteStats.FOR} އެއްބަސް
                </Badge>
                <Badge className="rounded-xl font-dh1 bg-red-100 text-red-700 hover:bg-red-100">
                  {voteStats.AGAINST} އެންޓި
                </Badge>
              </div>
            </div>

            <Separator className="mb-6 bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

            <div className="grid grid-cols-1 gap-4">
              {COUNCILLORS.map((c, idx) => {
                const v = votes[c.id] ?? "ABSENT";
                return (
                  <div
                    key={c.id}
                    className={`relative rounded-2xl bg-gradient-to-br ${voteColor(v)} border-2 p-5 transition-all duration-300 hover:shadow-lg group`}
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/80 font-bold text-slate-700 shadow-sm">
                          {String(idx + 1).padStart(2, "0")}
                        </div>
                        <div>
                          <div className="text-base font-semibold text-slate-900">
                            {c.name}
                          </div>
                          <Badge
                            variant={voteBadgeVariant(v)}
                            className="rounded-lg mt-1"
                          >
                            {voteLabel(v)}
                          </Badge>
                        </div>
                      </div>

                      <div className="w-full sm:w-64">
                        <Select
                          value={v}
                          onValueChange={(val) =>
                            setVotes((prev) => ({
                              ...prev,
                              [c.id]: val as NinmunVoteValue,
                            }))
                          }
                        >
                          <SelectTrigger className="h-12 font-dh1 rounded-2xl bg-white border-slate-200 hover:border-purple-300 focus:ring-purple-400/20 transition-all">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl">
                            <SelectItem
                              value="FOR"
                              className="rounded-xl font-dh1"
                            >
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 font-dh1 rounded-full bg-emerald-500"></div>
                                ފެންނަ
                              </div>
                            </SelectItem>
                            <SelectItem value="AGAINST" className="rounded-xl">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 font-dh1 rounded-full bg-red-500"></div>
                                ނުފެންނަ
                              </div>
                            </SelectItem>
                            <SelectItem value="ABSTAIN" className="rounded-xl">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 font-dh1 rounded-full bg-amber-500"></div>
                                ވޯޓް ނުދޭ
                              </div>
                            </SelectItem>
                            <SelectItem value="ABSENT" className="rounded-xl">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 font-dh1 rounded-full bg-slate-400"></div>
                                ޗުއްޓީގައި
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        {/* Stats Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-dh1">
          {[
            {
              label: "ފެންނަ",
              value: voteStats.FOR,
              color: "emerald",
              icon: CheckCircle2,
            },
            {
              label: "ނުފެންނަ",
              value: voteStats.AGAINST,
              color: "red",
              icon: AlertCircle,
            },
            {
              label: "ވޯޓް ނުދޭ",
              value: voteStats.ABSTAIN,
              color: "amber",
              icon: Vote,
            },
            {
              label: "ޗުއްޓީގައި",
              value: voteStats.ABSENT,
              color: "slate",
              icon: Users,
            },
          ].map((stat) => (
            <Card
              key={stat.label}
              className={`bg-${stat.color}-50/50 backdrop-blur-xl rounded-2xl border border-${stat.color}-100/50 p-4 text-center`}
            >
              <div
                className={`inline-flex items-center justify-center w-10 h-10 rounded-xl bg-${stat.color}-500/10 mb-2`}
              >
                <stat.icon className={`h-5 w-5 text-${stat.color}-600`} />
              </div>
              <div className={`text-3xl font-bold text-${stat.color}-700 mb-1`}>
                {stat.value}
              </div>
              <div className="text-sm text-slate-600">{stat.label}</div>
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
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block mb-2 text-sm font-medium text-slate-700 text-right">
        {label}
        {required && <span className="text-red-500 mr-1">*</span>}
      </label>
      {children}
    </div>
  );
}
