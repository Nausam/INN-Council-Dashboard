import Image from "next/image";
import { ContactChip, MailIcon, PhoneIcon } from "@/components/landRent/CouncilInvoiceTemplate";
import {
  fmtDateDhivehi,
  fmtMoney,
} from "@/components/landRent/Statement/landRentStatement.utils";
import type { LandNoticeLeaseSnapshot, LandNoticeType } from "@/lib/landrent/landRentNotice.types";

const GREEN = "#0f4b45";
const ACCOUNT_LINE = "001 700406 7717 ( ރެވެނިޔު 01)";

export type LandRentNoticeLetterData = LandNoticeLeaseSnapshot & {
  /** Null in previews, before a number is assigned. */
  noticeNumber: string | null;
  noticeType: LandNoticeType;
  issueDate: string;
  dueDate: string;
  note?: string;
};

const LEVELS: Record<LandNoticeType, { title: string; band: string; callout: string }> = {
  REMINDER: {
    title: "ކުލި ދެއްކުމަށް ހަނދާންކޮށްދިނުމުގެ ނޯޓިސް",
    band: GREEN,
    callout: "bg-emerald-50 text-emerald-900 ring-emerald-200",
  },
  SECOND: {
    title: "ކުލި ނުދެއްކުމާ ބެހޭ ދެވަނަ ނޯޓިސް",
    band: GREEN,
    callout: "bg-amber-50 text-amber-900 ring-amber-200",
  },
  FINAL: {
    title: "ކުލި ނުދެއްކުމާ ބެހޭ އެންމެ ފަހުގެ ނޯޓިސް",
    band: "#9f1239",
    callout: "bg-red-50 text-red-700 ring-red-200",
  },
};

const CONSEQUENCES: Record<LandNoticeType, string> = {
  REMINDER:
    "މި ނޯޓިސް ލިބުމުގެ ކުރިން ފައިސާ ދައްކާފައިވާނަމަ، މި ނޯޓިސް ބާތިލް ކަމުގައި ބަލައިދެއްވުން އެދެމެވެ.",
  SECOND:
    "މި ނޯޓިހުގައި ދީފައިވާ މުއްދަތުގެ ތެރޭގައި ފައިސާ ނުދައްކައިފިނަމަ، އެގްރިމެންޓާއި ޤަވާޢިދާ އެއްގޮތަށް ފިޔަވަޅު އަޅަން މަޖުބޫރުވާނެ ކަމުގައި ދަންނަވަމެވެ.",
  FINAL:
    "މިއީ މި މައްސަލައިގައި ފޮނުވާ އެންމެ ފަހުގެ ނޯޓިސް ކަމުން، ދީފައިވާ މުއްދަތުގެ ތެރޭގައި ފައިސާ ނުދައްކައިފިނަމަ، އެގްރިމެންޓް ބާތިލްކޮށް، ބާކީ ފައިސާ ހޯދުމަށް ޤާނޫނީ ފިޔަވަޅު އެޅުމަށް މައްސަލަ ކޯޓަށް ހުށަހަޅާނެ ކަމުގައި ދަންނަވަމެވެ.",
};

function Ltr({ children }: { children: React.ReactNode }) {
  return <bdi dir="ltr" className="font-sans">{children}</bdi>;
}

/**
 * The printable notice sent to a lease holder with unpaid rent or fines.
 * Built as a companion to the land rent statement: same letterhead, green
 * title band, info cards, green-header table and contact chips, and the same
 * stamped PDF export. Sized to fit one A4 page with room for the stamp.
 */
export default function LandRentNoticeLetter({ notice }: { notice: LandRentNoticeLetterData }) {
  const level = LEVELS[notice.noticeType];
  const amount = fmtMoney(notice.outstanding);
  const issueDate = fmtDateDhivehi(notice.issueDate);
  const dueDate = fmtDateDhivehi(notice.dueDate);
  const note = String(notice.note ?? "").trim();

  const columns = [
    "މަހަކު ދައްކަންޖެހޭ ކުލި",
    "އެންމެފަހުން ކުލި ދެއްކި ތާރީޚް",
    "ބާކީ ހުރި ކުލި އާއި ޖޫރިމަނާ",
    "ފައިސާ ދައްކަންޖެހޭ ސުންގަޑި",
  ];
  const values: React.ReactNode[] = [
    <Ltr key="rent">{fmtMoney(notice.monthlyRent)}</Ltr>,
    notice.lastPaymentDate ? fmtDateDhivehi(notice.lastPaymentDate) : "-",
    <Ltr key="due">{amount}</Ltr>,
    dueDate,
  ];

  return (
    <section className="notice-page mx-auto w-full max-w-[1000px] font-dh2">
      <div className="relative rounded-3xl bg-gradient-to-br from-black/10 via-black/5 to-black/10 p-[1px]">
        <div className="relative overflow-hidden rounded-3xl bg-white ring-1 ring-black/10">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(1200px_520px_at_20%_-10%,rgba(15,75,69,.10),transparent_60%),radial-gradient(900px_420px_at_90%_0%,rgba(56,189,248,.08),transparent_55%)]" />

          <div className="relative p-8">
            {/* Letterhead: logo, crest with the office name, notice reference */}
            <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-6">
              <Image
                src="/assets/images/innamaadhoo-logo.png"
                alt="Council logo"
                width={140}
                height={140}
                priority
                // html2canvas crops optimized 2x images, so serve the file as is.
                unoptimized
                className="h-auto w-[140px] object-contain"
              />

              <div className="flex flex-col items-center">
                <Image
                  src="/assets/images/crest.png"
                  alt="Crest"
                  width={60}
                  height={60}
                  priority
                  unoptimized
                  className="h-auto w-[60px] object-contain"
                />
                <div
                  data-pdf-center-rtl="1"
                  dir="rtl"
                  className="mt-6 rounded-2xl bg-white/80 px-7 py-3.5 text-center text-base leading-snug text-black ring-1 ring-black/10"
                >
                  <div className="space-y-1.5 font-dh1 font-semibold">
                    <div>މާޅޮސްމަޑުލު އުތުރުބުރީ އިންނަމާދޫ ކައުންސިލް އިދާރާ</div>
                    <div>ރ.އިންނަމާދޫ، ދިވެހިރާއްޖެ</div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <div dir="rtl" className="min-w-[190px] space-y-3 rounded-2xl bg-white/80 px-5 py-4 text-base text-black ring-1 ring-black/10">
                  <div className="font-dh1 font-semibold">
                    ނަންބަރު:{" "}
                    {notice.noticeNumber ? (
                      <Ltr>{notice.noticeNumber}</Ltr>
                    ) : (
                      <span className="font-sans text-black/35">-</span>
                    )}
                  </div>
                  <div className="font-dh1 font-semibold">ތާރީޚް: {issueDate}</div>
                </div>
              </div>
            </div>

            {/* Title band */}
            <div className="mt-8 overflow-hidden rounded-2xl ring-1 ring-black/10" style={{ backgroundColor: level.band }}>
              <div className="flex items-center justify-center px-5 py-4">
                <div data-pdf-center-rtl="1" dir="rtl" className="text-center font-dh1 text-2xl font-semibold text-white">
                  {level.title}
                </div>
              </div>
            </div>

            {/* Info cards, as on the statement */}
            <div dir="rtl" className="mt-8 grid grid-cols-2 gap-5">
              <div className="rounded-2xl bg-white/90 p-6 ring-1 ring-black/10">
                <div className="space-y-5 text-base leading-relaxed text-black">
                  <div className="font-dh1 font-semibold">ކުއްޔަށް ހިފި ފަރާތް: {notice.tenantName || "-"}</div>
                  <div className="font-dh1 font-semibold">ތަނުގެ ނަން: {notice.landName || "-"}</div>
                  <div className="font-dh1 font-semibold">
                    އެގްރިމެންޓްގެ ނަންބަރު: <Ltr>{notice.agreementNumber || "-"}</Ltr>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl bg-white/90 p-6 ring-1 ring-black/10">
                <div className="space-y-5 text-base leading-relaxed text-black">
                  <div className="font-dh1 font-semibold">
                    ކުލި ޖަމާކުރާ އެކައުންޓް: <Ltr>{ACCOUNT_LINE}</Ltr>
                  </div>
                  <div className="font-dh1 font-semibold">
                    ކުލި ދައްކަންޖެހޭ މުއްދަތު: ކޮންމެ މީލާދީ މަހެއްގެ {notice.paymentDueDay} ވަނަ ދުވަހުގެ ކުރިން
                  </div>
                  <div className="font-dh1 font-semibold">
                    ކުލި ފައިސާ އެކައުންޓަށް ޖަމާކުރާނަމަ ސްލިޕް މިއިދާރާއަށް 3 ދުވަސްތެރޭގައި ފޮނުވުން އެދެން.
                  </div>
                </div>
              </div>
            </div>

            {/* Opening */}
            <p dir="rtl" className="mt-8 font-dh1 text-lg leading-loose text-black">
              މި އިދާރާއާއި ދެމެދު ވެވިފައިވާ ބިން ކުއްޔަށް ދިނުމުގެ އެގްރިމެންޓްގެ ދަށުން، ކޮންމެ މީލާދީ
              މަހެއްގެ {notice.paymentDueDay} ވަނަ ދުވަހުގެ ކުރިން ކުލި ދައްކަންޖެހޭނެ ކަމަށް ބަޔާންވެފައިވީ
              ނަމަވެސް، {issueDate} ވަނަ ދުވަހުގެ ނިޔަލަށް ތިރީގައިވާ ފައިސާ މި އިދާރާއަށް ދައްކާފައި ނުވާކަން
              ދަންނަވަމެވެ.
            </p>

            {/* Figures, in the statement's table style */}
            <div className="avoid-break mt-6 overflow-hidden rounded-2xl ring-1 ring-black/15">
              <table className="w-full border-collapse">
                <thead dir="rtl" data-pdf-center-rtl="1">
                  <tr style={{ backgroundColor: GREEN }}>
                    {columns.map((label) => (
                      <th
                        key={label}
                        className="border-r border-white/20 px-4 py-4 text-center font-dh1 text-sm font-semibold text-white last:border-r-0"
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody dir="rtl">
                  <tr className="bg-white text-center text-sm font-semibold text-black">
                    {values.map((value, index) => (
                      <td key={index} className="border-r border-t border-black/10 px-4 py-4 font-dh1 last:border-r-0">
                        {value}
                      </td>
                    ))}
                  </tr>
                </tbody>
                <tfoot dir="rtl">
                  <tr className="bg-black/[0.03]">
                    <td
                      colSpan={2}
                      className="border-t border-black/15 px-5 py-4 text-right font-dh1 text-base font-semibold text-black"
                    >
                      ޖުމްލަ ދައްކަންޖެހޭ: (ރުފިޔާ)
                    </td>
                    <td
                      colSpan={2}
                      className="border-r border-t border-black/10 px-4 py-4 text-center text-lg font-extrabold text-black"
                    >
                      <Ltr>{amount}</Ltr>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Request */}
            <p dir="rtl" className="mt-6 font-dh1 text-lg leading-loose text-black">
              މިހެންކަމުން، މަތީގައި ބަޔާންކޮށްފައިވާ ޖުމްލަ <Ltr>{amount}</Ltr> ރުފިޔާ، {dueDate} ވަނަ
              ދުވަހުގެ ކުރިން މި އިދާރާއަށް ދައްކައި ނިންމުމަށް އަންގަމެވެ. ފައިސާ ދެއްކުން ލަސްވާ ވަރަކަށް،
              އެގްރިމެންޓްގައިވާ ގޮތުގެ މަތިން ޖޫރިމަނާ އިތުރުވާނެއެވެ.
            </p>

            {/* What happens next */}
            <div className="mt-5 flex justify-center">
              <div
                data-pdf-center-rtl="1"
                dir="rtl"
                className={`max-w-3xl rounded-2xl px-6 py-4 text-center font-dh1 text-sm font-semibold leading-relaxed ring-1 ${level.callout}`}
              >
                {CONSEQUENCES[notice.noticeType]}
              </div>
            </div>

            {note ? (
              <div dir="rtl" className="mt-5 rounded-2xl bg-white/90 px-6 py-4 ring-1 ring-black/10">
                <p className="whitespace-pre-wrap font-dh1 text-base font-semibold leading-loose text-black">{note}</p>
              </div>
            ) : null}

            {/* Contacts and signature */}
            <div className="avoid-break mt-8 flex items-end justify-between gap-6">
              <div className="w-64 space-y-4 text-base font-semibold text-black" dir="rtl">
                <div className="font-dh1">ސޮއި: ..................................</div>
                <div className="font-dh1">ނަން: ..................................</div>
                <div className="font-dh1">މަޤާމު: ................................</div>
              </div>
              <div className="flex flex-col items-end gap-3">
                <ContactChip value="finance@innamaadhoo.gov.mv" accent="blue" icon={<MailIcon className="h-4 w-4" />} />
                <ContactChip value="7380052" accent="indigo" icon={<PhoneIcon className="h-4 w-4" />} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
