// components/CouncilInvoiceTemplate.tsx
import Image from "next/image";

type ContactInfo = {
  email: string;
  phone: string;
  whatsapp?: string;
};

/** A text run that can optionally use the highlight font (aammufkF) */
type TextRun =
  | string
  | {
      text: string;
      highlight?: boolean; // if true => font-dh1
      className?: string; // optional extra classes (e.g. bg-yellow-200)
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
      highlight?: boolean; // if true => font-dh1
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
};

const GREEN = "#0f4b45";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function renderText(run: TextRun, baseClass = "") {
  if (typeof run === "string") return <span className={baseClass}>{run}</span>;

  return (
    <span
      className={cx(
        baseClass,
        run.highlight && "font-dh1", // aammufkF
        run.className
      )}
    >
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

  return (
    <span className={cx(base, v.highlight && "font-dh1", v.className)}>
      {v.value === null || v.value === undefined || v.value === ""
        ? "-"
        : String(v.value)}
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
  } = props;

  return (
    // Default = Faruma everywhere
    <section className="w-full bg-white font-dh2">
      <div className="mx-auto w-full max-w-[1157px] px-6 py-6">
        {/* Header */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-start">
          <div className="flex items-start gap-3">
            {leftLogoSrc ? (
              <Image
                src={leftLogoSrc}
                alt="Council logo"
                width={170}
                height={110}
                priority
                className="h-auto w-[170px] object-contain"
              />
            ) : (
              <div className="h-[110px] w-[170px] rounded-md bg-black/5" />
            )}
          </div>

          <div className="flex flex-col items-center">
            {crestSrc ? (
              <Image
                src={crestSrc}
                alt="Crest"
                width={70}
                height={70}
                priority
                className="h-auto w-[70px] object-contain"
              />
            ) : (
              <div className="h-[70px] w-[70px] rounded-full bg-black/5" />
            )}

            <div
              className="mt-2 space-y-1 text-center text-[16px] leading-snug text-black"
              dir="rtl"
            >
              {headerCenterLines.map((l, i) => (
                <div key={i} className="font-semibold">
                  {renderText(l)}
                </div>
              ))}
            </div>
          </div>

          <div />
        </div>

        {/* Title bar */}
        <div className="mt-5 w-full" style={{ backgroundColor: GREEN }}>
          <div
            className="flex h-12 items-center justify-center px-4 text-center text-[22px] font-semibold text-white"
            dir="rtl"
          >
            {renderText(title, "text-white")}
          </div>
        </div>

        {/* Main info box */}
        <div
          className="mt-5 rounded-lg border-[3px] p-5"
          style={{ borderColor: GREEN }}
        >
          <div className="grid grid-cols-2 gap-6">
            <div
              className="space-y-2 text-[16px] leading-relaxed text-black"
              dir="rtl"
            >
              {leftInfo.lines.map((l, i) => (
                <div key={i} className="font-semibold">
                  {renderText(l)}
                </div>
              ))}
              {leftInfo.amount ? (
                <div className="pt-1 text-center text-[18px] font-semibold">
                  {renderText(leftInfo.amount)}
                </div>
              ) : null}
            </div>

            <div
              className="space-y-2 text-[16px] leading-relaxed text-black"
              dir="rtl"
            >
              {rightInfo.lines.map((l, i) => (
                <div key={i} className="font-semibold">
                  {renderText(l)}
                </div>
              ))}
              {rightInfo.amount ? (
                <div className="pt-1 text-center text-[18px] font-semibold">
                  {renderText(rightInfo.amount)}
                </div>
              ) : null}
            </div>
          </div>

          {/* Contact */}
          <div className="mt-6 flex items-center justify-center gap-10">
            <div className="flex items-center gap-3">
              <span className="text-[16px] font-semibold text-black">
                {contact.email}
              </span>
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-700 text-white">
                <MailIcon className="h-5 w-5" />
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[18px] font-semibold text-black">
                {contact.phone}
              </span>
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-indigo-700 text-white">
                <PhoneIcon className="h-5 w-5" />
              </span>
            </div>

            {contact.whatsapp ? (
              <div className="flex items-center gap-3">
                <span className="text-[16px] font-semibold text-black">
                  {contact.whatsapp}
                </span>
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-purple-600 text-white">
                  <WhatsAppIcon className="h-5 w-5" />
                </span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Table */}
        <div className="mt-4">
          <div className="overflow-hidden border border-black/40">
            <table className="w-full border-collapse">
              <thead>
                <tr style={{ backgroundColor: GREEN }} dir="rtl">
                  {columns.map((c) => (
                    <th
                      key={c.key}
                      className={cx(
                        "border-r border-black/40 px-3 py-3 text-center text-[15px] font-semibold text-white",
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
                  <tr key={idx} className="bg-white">
                    {columns.map((c) => (
                      <td
                        key={c.key}
                        className="border-t border-r border-black/40 px-3 py-3 text-center text-[16px] font-semibold text-black"
                      >
                        {renderCell(r[c.key])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>

              <tfoot dir="rtl">
                <tr className="bg-white">
                  <td
                    colSpan={2}
                    className="border-t border-r border-black/40 px-3 py-3 text-center text-[18px] font-extrabold text-black"
                  >
                    {renderText(totalAmount)}
                  </td>

                  <td
                    colSpan={Math.max(columns.length - 2, 1)}
                    className="border-t border-black/40 px-4 py-3 text-right text-[16px] font-semibold text-black"
                  >
                    {renderText(totalLabel)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Footer note */}
        <p
          className="mt-6 text-center text-[16px] font-semibold text-red-600"
          dir="rtl"
        >
          {renderText(footerNote, "text-red-600")}
        </p>
      </div>
    </section>
  );
}
