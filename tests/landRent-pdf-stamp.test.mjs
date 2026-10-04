import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import ts from "typescript";
import vm from "node:vm";

const module = { exports: {} };
const code = ts.transpileModule(fs.readFileSync(new URL("../lib/landrent/landRent.pdfStamp.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
vm.runInThisContext(`(function(module, exports) {${code}\n})`)(module, module.exports);
const { stampLandRentPdfPages, LAND_RENT_STAMP_MARGIN_MM } = module.exports;

test("each PDF page receives a transparent stamp below its content, including a short final page", () => {
  const width = 210;
  const slice = 297 - LAND_RENT_STAMP_MARGIN_MM;
  const height = slice * 2 + 80;
  const pixels = new Uint8ClampedArray(width * height * 4).fill(255);
  for (const bottom of [220, slice + 245, slice * 2 + 50]) {
    pixels[((bottom - 1) * width + 105) * 4] = 0;
  }
  const canvas = {
    width, height,
    getContext: () => ({ getImageData: (_x, y, _w, h) => ({ data: pixels.slice(y * width * 4, (y + h) * width * 4) }) }),
  };
  let page;
  const stamps = [];
  const pdf = {
    internal: { getNumberOfPages: () => 3, pageSize: { getWidth: () => 210, getHeight: () => 297 } },
    setPage: (value) => { page = value; },
    addImage: (...args) => stamps.push({ page, args }),
  };
  const stamp = { naturalWidth: 1263, naturalHeight: 1246 };
  stampLandRentPdfPages(pdf, canvas, { inner: { width: 210, ratio: slice / width } }, stamp);
  assert.deepEqual(stamps.map((item) => item.page), [1, 2, 3]);
  assert.deepEqual(stamps.map((item) => item.args[3]), [228, 253, 58]);
  for (const { args } of stamps) {
    assert.equal(args[0], stamp);
    assert.equal(args[1], "PNG");
    assert.equal(args[2], 87.5);
    assert.equal(args[4], 35);
    assert.equal(args[5], 35 * 1246 / 1263);
    assert.ok(args[3] + args[5] <= 291);
  }
});

test("transparent pixels and near-white page-break padding do not move the stamp down", () => {
  const data = new Uint8ClampedArray(210 * 100 * 4).fill(255);
  data[((20 - 1) * 210 + 15) * 4] = 0;
  // Transparent black in the last row is not visible content.
  data[(99 * 210 + 15) * 4] = 0;
  data[(99 * 210 + 15) * 4 + 3] = 0;
  data[(90 * 210 + 20) * 4] = 250;
  let y;
  stampLandRentPdfPages({
    internal: { getNumberOfPages: () => 1, pageSize: { getWidth: () => 210, getHeight: () => 297 } },
    setPage() {}, addImage: (_stamp, _format, _x, value) => { y = value; },
  }, {
    width: 210, height: 100, getContext: () => ({ getImageData: () => ({ data }) }),
  }, { inner: { width: 210, ratio: 247 / 210 } }, { naturalWidth: 1263, naturalHeight: 1246 });
  assert.equal(y, 28);
});
