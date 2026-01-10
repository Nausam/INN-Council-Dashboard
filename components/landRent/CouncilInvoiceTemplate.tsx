// components/CouncilInvoiceTemplate.tsx
import Image from "next/image";

type ContactInfo = {
  email: string;
  phone: string;
  whatsapp?: string;
};

type TextRun =
  | string
  | {
      text: string;
      highlight?: boolean;
      className?: string;
    };

type InfoBlock = {
  lines: TextRun[];
  amount?: TextRun;
};

type TableColumn = {
  key: string;
  label: TextRun;
  className?: string;
};

type CellValue =
  | string
  | number
  | null
  | undefined
  | {
      value: string | number | null | undefined;
      highlight?: boolean;
      className?: string;
    };

type CouncilInvoiceTemplateProps = {
  leftLogoSrc?: string;
  crestSrc?: string;
  headerCenterLines: TextRun[];

  title: TextRun;

  leftInfo: InfoBlock;
  rightInfo: InfoBlock;

  contact: ContactInfo;

  columns: TableColumn[];
  rows: Array<Record<string, CellValue>>;

  totalLabel: TextRun;
  totalAmount: TextRun;

  footerNote: TextRun;
  children?: React.ReactNode;

  breakBeforeChildren?: boolean; // default true
};

const GREEN = "#0f4b45";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function renderText(run: TextRun, baseClass = "") {
  if (typeof run === "string") return <span className={baseClass}>{run}</span>;
  return (
    <span className={cx(baseClass, run.highlight && "font-dh1", run.className)}>
      {run.text}
    </span>
  );
}

function renderCell(v: CellValue) {
  const base = "inline-block";
  if (v === null || v === undefined || v === "")
    return <span className={base}>-</span>;
  if (typeof v === "string" || typeof v === "number")
    return <span className={base}>{String(v)}</span>;

  const value =
    v.value === null || v.value === undefined || v.value === ""
      ? "-"
      : String(v.value);

  return (
    <span className={cx(base, v.highlight && "font-dh1", v.className)}>
      {value}
    </span>
  );
}

function MailIcon(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={props.className}>
      <path d="M20 4H4a2 2 0 0 0-2 2v.01L12 13 22 6.01V6a2 2 0 0 0-2-2Zm2 6.24-9.4 6.58a1 1 0 0 1-1.2 0L2 10.24V18a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-7.76Z" />
    </svg>
  );
}
function PhoneIcon(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={props.className}>
      <path d="M20.5 16.9c-1.2 0-2.4-.2-3.5-.6a1 1 0 0 0-1 .2l-2.2 1.7a16.3 16.3 0 0 1-7.7-7.7l1.7-2.2a1 1 0 0 0 .2-1c-.4-1.1-.6-2.3-.6-3.5A1 1 0 0 0 6.4 3H4.2A1.2 1.2 0 0 0 3 4.2C3 14.6 9.4 21 19.8 21a1.2 1.2 0 0 0 1.2-1.2v-2.2a1 1 0 0 0-.5-.7 1 1 0 0 0-.5-.1Z" />
    </svg>
  );
}
function WhatsAppIcon(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={props.className}>
      <path d="M12.04 2C6.58 2 2.2 6.38 2.2 11.84c0 1.92.56 3.77 1.6 5.35L2 22l4.95-1.76a9.8 9.8 0 0 0 5.1 1.4h.01c5.46 0 9.84-4.38 9.84-9.84C21.9 6.38 17.5 2 12.04 2Zm5.73 14.12c-.24.69-1.2 1.26-1.86 1.4-.45.1-1.03.18-1.68-.03-.4-.13-.92-.3-1.58-.58-2.78-1.19-4.6-4.04-4.74-4.22-.14-.18-1.12-1.49-1.12-2.84 0-1.34.7-2 1-2.28.3-.28.65-.35.86-.35h.62c.2 0 .47-.07.73.56.27.63.9 2.18.98 2.33.08.16.13.35.03.56-.1.21-.15.35-.3.54-.15.19-.31.43-.44.58-.15.18-.31.37-.13.73.18.36.8 1.32 1.71 2.14 1.18 1.05 2.16 1.38 2.47 1.54.31.16.5.14.69-.08.19-.22.79-.92 1-1.23.21-.31.42-.26.7-.16.28.1 1.78.84 2.09.99.31.15.52.23.6.35.08.12.08.7-.16 1.39Z" />
    </svg>
  );
}

function ContactChip(props: {
  value: string;
  icon: React.ReactNode;
  accent: "blue" | "indigo" | "emerald";
}) {
  const accentClass =
    props.accent === "blue"
      ? "bg-sky-600"
      : props.accent === "indigo"
      ? "bg-indigo-600"
      : "bg-emerald-600";

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white/80 px-4 py-2 ring-1 ring-black/10">
      <span className="text-sm font-semibold text-black">{props.value}</span>
      <span
        className={cx(
          "inline-flex h-9 w-9 items-center justify-center rounded-2xl text-white",
          accentClass
        )}
      >
        {props.icon}
      </span>
    </div>
  );
}

export default function CouncilInvoiceTemplate(
  props: CouncilInvoiceTemplateProps
) {
  const {
    leftLogoSrc,
    crestSrc,
    headerCenterLines,
    title,
    leftInfo,
    rightInfo,
    contact,
    columns,
    rows,
    totalLabel,
    totalAmount,
    footerNote,
    children,
    breakBeforeChildren = true,
  } = props;

  return (
    <section className="w-full font-dh2 print:bg-white">
      <div className="a4-page mx-auto w-full max-w-[1157px] px-6 py-6 print:max-w-none print:px-0 print:py-0">
        {/* PAGE 1 */}
        <div className="avoid-break relative rounded-3xl bg-gradient-to-br from-black/10 via-black/5 to-black/10 p-[1px] print:bg-none print:p-0">
          <div className="relative overflow-hidden rounded-3xl bg-white ring-1 ring-black/10 print:ring-0">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(1200px_520px_at_20%_-10%,rgba(15,75,69,.10),transparent_60%),radial-gradient(900px_420px_at_90%_0%,rgba(56,189,248,.08),transparent_55%)] print:hidden" />

            <div className="relative p-8 print:p-10">
              {/* Header */}
              <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-6">
                <div className="flex items-start">
                  {leftLogoSrc ? (
                    <Image
                      src={leftLogoSrc}
                      alt="Council logo"
                      width={160}
                      height={160}
                      priority
                      className="h-auto w-[160px] object-contain"
                    />
                  ) : (
                    <div className="h-[160px] w-[160px] rounded-xl bg-black/5 ring-1 ring-black/10" />
                  )}
                </div>

                <div className="flex flex-col items-center">
                  {crestSrc ? (
                    <Image
                      src={crestSrc}
                      alt="Crest"
                      width={66}
                      height={66}
                      priority
                      className="h-auto w-[66px] object-contain"
                    />
                  ) : (
                    <div className="h-[66px] w-[66px] rounded-2xl bg-black/5 ring-1 ring-black/10" />
                  )}

                  {/* ✅ Mark as "must stay centered in PDF capture" */}
                  <div
                    data-pdf-center-rtl="1"
                    className="mt-10 rounded-2xl bg-white/80 px-7 py-4 text-center text-base leading-snug text-black ring-1 ring-black/10"
                    dir="rtl"
                  >
                    <div className="space-y-1.5">
                      {headerCenterLines.map((l, i) => (
                        <div key={i} className="font-semibold">
                          {renderText(l)}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div />
              </div>

              {/* Title */}
              <div className="mt-10 relative overflow-hidden rounded-2xl ring-1 ring-black/10">
                <div
                  className="absolute inset-0"
                  style={{ backgroundColor: GREEN }}
                />
                <div className="relative flex items-center justify-center px-5 py-4">
                  {/* ✅ Mark as "must stay centered in PDF capture" */}
                  <div
                    data-pdf-center-rtl="1"
                    className="text-center text-2xl font-semibold text-white"
                    dir="rtl"
                  >
                    {renderText(title, "text-white")}
                  </div>
                </div>
              </div>

              {/* Info blocks */}
              <div className="mt-10 grid gap-5 lg:grid-cols-2">
                <div className="rounded-2xl bg-white/90 p-6 ring-1 ring-black/10">
                  <div
                    className="space-y-6 text-base leading-relaxed text-black"
                    dir="rtl"
                  >
                    {leftInfo.lines.map((l, i) => (
                      <div key={i} className="font-semibold">
                        {renderText(l)}
                      </div>
                    ))}
                    {leftInfo.amount ? (
                      <div className="mt-4 rounded-2xl bg-black/[0.03] px-5 py-4 text-center text-lg font-semibold ring-1 ring-black/10">
                        {renderText(leftInfo.amount)}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-2xl bg-white/90 p-6 ring-1 ring-black/10">
                  <div
                    className="space-y-6 text-base leading-relaxed text-black"
                    dir="rtl"
                  >
                    {rightInfo.lines.map((l, i) => (
                      <div key={i} className="font-semibold">
                        {renderText(l)}
                      </div>
                    ))}
                    {rightInfo.amount ? (
                      <div className="mt-4 rounded-2xl bg-black/[0.03] px-5 py-4 text-center text-lg font-semibold ring-1 ring-black/10">
                        {renderText(rightInfo.amount)}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Contact */}
              <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
                <ContactChip
                  value={contact.email}
                  accent="blue"
                  icon={<MailIcon className="h-4 w-4" />}
                />
                <ContactChip
                  value={contact.phone}
                  accent="indigo"
                  icon={<PhoneIcon className="h-4 w-4" />}
                />
                {contact.whatsapp ? (
                  <ContactChip
                    value={contact.whatsapp}
                    accent="emerald"
                    icon={<WhatsAppIcon className="h-4 w-4" />}
                  />
                ) : null}
              </div>

              {/* Table */}
              <div className="mt-10 overflow-hidden rounded-2xl ring-1 ring-black/15">
                <table className="w-full border-collapse">
                  {/* ✅ Mark header row for forced centering in PDF capture */}
                  <thead dir="rtl" data-pdf-center-rtl="1">
                    <tr style={{ backgroundColor: GREEN }}>
                      {columns.map((c) => (
                        <th
                          key={c.key}
                          className={cx(
                            "px-4 py-4 text-center text-sm font-semibold text-white",
                            "border-r border-white/20 last:border-r-0",
                            c.className
                          )}
                        >
                          {renderText(c.label, "text-white")}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody dir="rtl">
                    {rows.map((r, idx) => (
                      <tr
                        key={idx}
                        className={cx(
                          "text-center text-sm font-semibold text-black",
                          idx % 2 === 0 ? "bg-white" : "bg-black/[0.015]"
                        )}
                      >
                        {columns.map((c) => (
                          <td
                            key={c.key}
                            className="px-4 py-4 border-t border-r border-black/10 last:border-r-0"
                          >
                            {renderCell(r[c.key])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>

                  <tfoot dir="rtl">
                    <tr className="bg-black/[0.03]">
                      <td
                        colSpan={2}
                        className="px-4 py-4 text-center text-lg font-extrabold text-black border-t border-r border-black/10"
                      >
                        {renderText(totalAmount)}
                      </td>

                      <td
                        colSpan={Math.max(columns.length - 2, 1)}
                        className="px-5 py-4 text-right text-base font-semibold text-black border-t border-black/15"
                      >
                        {renderText(totalLabel)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Footer note */}
              <div className="mt-10 flex justify-center">
                {/* ✅ Mark footer for centering stability */}
                <div
                  data-pdf-center-rtl="1"
                  className="max-w-3xl rounded-2xl bg-red-50 px-6 py-4 text-center text-sm font-semibold text-red-700 ring-1 ring-red-200"
                  dir="rtl"
                >
                  {renderText(footerNote, "text-red-700")}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* PAGE 2+ */}
        {children ? (
          <>
            {breakBeforeChildren ? <div className="pdf-break" /> : null}
            <div className="mt-4">{children}</div>
          </>
        ) : null}
      </div>
    </section>
  );
}
