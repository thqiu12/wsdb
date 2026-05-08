import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile, Workbook } from "@oai/artifact-tool";

function baseSheet(title, fields) {
  const rows = [[title, ""], ["帳票番号", fields.document_no || fields.receipt_no || ""], ["発行日", fields.issue_date || ""]];
  return rows;
}

function receiptRows(fields) {
  return [
    ...baseSheet("領収書", fields),
    ["校舎", fields.campus_name || ""],
    ["宛名", fields.payer_display_name || ""],
    ["学生名", fields.student_name || ""],
    ["入学期", fields.admission_term || ""],
    ["区分", fields.payment_type || ""],
    ["金額", fields.amount || 0],
    ["但し書き", fields.line_note || ""],
  ];
}

function acceptanceRows(fields) {
  return [
    ...baseSheet("合格通知書", fields),
    ["校舎", fields.campus_name || ""],
    ["氏名", fields.student_name || ""],
    ["入学期", fields.admission_term || ""],
    ["在学予定期間", fields.study_length || ""],
    ["エージェント", fields.agent_name || ""],
    ["通知文", fields.message || ""],
  ];
}

function withdrawalRows(fields) {
  return [
    ...baseSheet("離脱届", fields),
    ["学校名", fields.school_name || ""],
    ["学生番号", fields.student_no || ""],
    ["氏名", fields.student_name || ""],
    ["国籍", fields.nationality || ""],
    ["クラス", fields.class_name || ""],
    ["在留カード番号", fields.residence_card_no || ""],
    ["在留期限", fields.residence_expiry || ""],
    ["理由", fields.reason || ""],
  ];
}

function studentCertificateRows(fields) {
  return [
    ...baseSheet(fields.certificate_type || "証明書", fields),
    ["学生番号", fields.student_no || ""],
    ["氏名", fields.student_name || ""],
    ["国籍", fields.nationality || ""],
    ["クラス", fields.class_name || ""],
    ["入学日", fields.admission_date || ""],
    ["出席率", fields.attendance_rate === "" ? "" : `${fields.attendance_rate}%`],
    ["用途", fields.purpose || ""],
    ["部数", fields.copies || 1],
    ["発行者", fields.issued_by || ""],
  ];
}

function rowsFor(documentType, fields) {
  if (documentType === "receipt") return receiptRows(fields);
  if (documentType === "acceptance_notice") return acceptanceRows(fields);
  if (documentType === "withdrawal_report") return withdrawalRows(fields);
  if (documentType === "student_certificate") return studentCertificateRows(fields);
  return [["Document", documentType]];
}

async function exportSemiannualAttendanceReport(payload) {
  const workbook = Workbook.create();
  const summarySheet = workbook.worksheets.add("半期報告");
  const detailSheet = workbook.worksheets.add("明細");
  const fields = payload.fields || {};
  const students = fields.students || [];
  const lows = fields.low_attendance_students || [];

  const summaryRows = [
    ["半期毎出席率報告", ""],
    ["帳票番号", fields.document_no || ""],
    ["報告期間", fields.report_period || ""],
    ["発行日", fields.issue_date || ""],
    ["在籍者数", students.length],
    ["平均出席率", `${fields.average_attendance || 0}%`],
    ["80%未満", lows.length],
    ["状態", fields.status || ""],
  ];
  summarySheet.getRange(`A1:B${summaryRows.length}`).values = summaryRows;

  const detailRows = [
    ["学生番号", "氏名", "国籍", "クラス", "在籍状態", "在留期限", "出席率"],
    ...students.map((item) => [
      item.student_no || "",
      item.name || "",
      item.nationality || "",
      item.class_name || "",
      item.status || "",
      item.residence_expiry || "",
      item.attendance_rate ?? "",
    ]),
  ];
  detailSheet.getRange(`A1:G${detailRows.length}`).values = detailRows;

  if (lows.length) {
    const lowStart = detailRows.length + 3;
    const lowRows = [
      ["80%未満対象者", "", "", "", "", "", ""],
      ["学生番号", "氏名", "国籍", "クラス", "在籍状態", "在留期限", "出席率"],
      ...lows.map((item) => [
        item.student_no || "",
        item.name || "",
        item.nationality || "",
        item.class_name || "",
        item.status || "",
        item.residence_expiry || "",
        item.attendance_rate ?? "",
      ]),
    ];
    detailSheet.getRange(`A${lowStart}:G${lowStart + lowRows.length - 1}`).values = lowRows;
  }

  const output = await SpreadsheetFile.exportXlsx(workbook);
  await output.save(payload.outputPath);
}

async function exportMayNovemberReport(payload) {
  const workbook = Workbook.create();
  const summarySheet = workbook.worksheets.add("受入状況");
  const residentSheet = workbook.worksheets.add("在留者リスト");
  const fields = payload.fields || {};
  const students = fields.students || [];
  const expiring = fields.expiring_students || [];

  const summaryRows = [
    ["5月/11月 受け入れ状況報告", ""],
    ["帳票番号", fields.document_no || ""],
    ["報告期間", fields.report_period || ""],
    ["発行日", fields.issue_date || ""],
    ["在籍者数", students.length],
    ["在留期限確認対象", expiring.length],
    ["状態", fields.status || ""],
  ];
  summarySheet.getRange(`A1:B${summaryRows.length}`).values = summaryRows;

  const residentRows = [
    ["学生番号", "氏名", "国籍", "クラス", "在籍状態", "在留カード番号", "在留期限", "出席率"],
    ...students.map((item) => [
      item.student_no || "",
      item.name || "",
      item.nationality || "",
      item.class_name || "",
      item.status || "",
      item.residence_card_no || "",
      item.residence_expiry || "",
      item.attendance_rate ?? "",
    ]),
  ];
  residentSheet.getRange(`A1:H${residentRows.length}`).values = residentRows;

  if (expiring.length) {
    const start = residentRows.length + 3;
    const expiringRows = [
      ["在留期限確認対象", "", "", "", "", "", "", ""],
      ["学生番号", "氏名", "国籍", "クラス", "在籍状態", "在留カード番号", "在留期限", "出席率"],
      ...expiring.map((item) => [
        item.student_no || "",
        item.name || "",
        item.nationality || "",
        item.class_name || "",
        item.status || "",
        item.residence_card_no || "",
        item.residence_expiry || "",
        item.attendance_rate ?? "",
      ]),
    ];
    residentSheet.getRange(`A${start}:H${start + expiringRows.length - 1}`).values = expiringRows;
  }

  const output = await SpreadsheetFile.exportXlsx(workbook);
  await output.save(payload.outputPath);
}

async function exportResidenceRenewalReport(payload) {
  const workbook = Workbook.create();
  const sheet = workbook.worksheets.add("更新五表");
  const fields = payload.fields || {};
  const targets = fields.targets || [];
  const rows = [
    ["在留期間更新五表", ""],
    ["帳票番号", fields.document_no || ""],
    ["発行日", fields.issue_date || ""],
    ["対象人数", targets.length],
    ["次回期限", fields.next_expiry || ""],
    ["状態", fields.status || ""],
    ["" , ""],
    ["学生番号", "氏名", "国籍", "クラス", "在留カード番号", "在留期限", "残日数", "出席率"],
    ...targets.map((item) => [
      item.student_no || "",
      item.name || "",
      item.nationality || "",
      item.class_name || "",
      item.residence_card_no || "",
      item.residence_expiry || "",
      item.days_left ?? "",
      item.attendance_rate ?? "",
    ]),
  ];
  sheet.getRange(`A1:H${rows.length}`).values = rows;
  const output = await SpreadsheetFile.exportXlsx(workbook);
  await output.save(payload.outputPath);
}

async function exportPoorAttendanceReport(payload) {
  if (payload.templatePath && payload.templatePath.endsWith(".xlsx")) {
    const input = await FileBlob.load(payload.templatePath);
    const workbook = await SpreadsheetFile.importXlsx(input);
    const sheet = workbook.worksheets.getItem("出席率") || workbook.worksheets.getItem(0);
    const fields = payload.fields || {};
    const targets = fields.targets || [];

    writeCell(sheet, "E2", `出席率が5割を下回った生徒に係る日本語教育機関からの報告（${fields.report_month || ""}）`);
    writeCell(sheet, "A4", `日本語教育機関名：${fields.school_name || ""}`);
    writeCell(sheet, "A5", `設置者名：${fields.operator_name || ""}`);
    writeCell(sheet, "A7", `電話番号：${fields.phone || ""}`);
    writeCell(sheet, "L7", fields.issue_date || "");
    writeCell(sheet, "A8", `担当者氏名：${fields.staff_name || ""}`);
    writeCell(sheet, "K9", `${fields.enrolled_count || 0}`);

    for (let row = 11; row <= 30; row += 1) {
      for (const col of ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"]) {
        writeCell(sheet, `${col}${row}`, "");
      }
    }

    targets.forEach((item, index) => {
      const row = 11 + index;
      writeCell(sheet, `A${row}`, index + 1);
      writeCell(sheet, `B${row}`, item.nationality || "");
      writeCell(sheet, `C${row}`, item.name || "");
      writeCell(sheet, `D${row}`, item.birth_date || "");
      writeCell(sheet, `E${row}`, item.gender || "");
      writeCell(sheet, `F${row}`, item.residence_card_no || "");
      writeCell(sheet, `G${row}`, item.admission_date || "");
      writeCell(sheet, `H${row}`, item.expected_graduation || "");
      writeCell(sheet, `I${row}`, item.attendance_rate === "" ? "" : `${item.attendance_rate}%`);
      writeCell(sheet, `J${row}`, item.previous_attendance || "");
      writeCell(sheet, `K${row}`, item.work_place || "");
      writeCell(sheet, `L${row}`, item.note || "");
    });

    const output = await SpreadsheetFile.exportXlsx(workbook);
    await output.save(payload.outputPath);
    return;
  }
  const workbook = Workbook.create();
  const sheet = workbook.worksheets.add("出席率不佳");
  const fields = payload.fields || {};
  const targets = fields.targets || [];
  const rows = [
    ["出席率不佳報告", ""],
    ["帳票番号", fields.document_no || ""],
    ["発行日", fields.issue_date || ""],
    ["対象人数", targets.length],
    ["最低出席率", fields.lowest_attendance === "" ? "" : `${fields.lowest_attendance}%`],
    ["状態", fields.status || ""],
    ["", ""],
    ["学生番号", "氏名", "国籍", "クラス", "在籍状態", "在留期限", "出席率"],
    ...targets.map((item) => [
      item.student_no || "",
      item.name || "",
      item.nationality || "",
      item.class_name || "",
      item.status || "",
      item.residence_expiry || "",
      item.attendance_rate ?? "",
    ]),
  ];
  sheet.getRange(`A1:G${rows.length}`).values = rows;
  const output = await SpreadsheetFile.exportXlsx(workbook);
  await output.save(payload.outputPath);
}

function parseDateParts(value) {
  const date = value ? new Date(value) : new Date();
  return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
}

function formatJapaneseDate(value) {
  const parts = parseDateParts(value);
  const month = String(parts.month).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");
  return `${parts.year}年${month}月${day}日`;
}

function writeCell(sheet, cell, value) {
  sheet.getRange(cell).values = [[value ?? ""]];
}

async function exportWithdrawalTemplate(payload) {
  const input = await FileBlob.load(payload.templatePath);
  const workbook = await SpreadsheetFile.importXlsx(input);
  const sheet = workbook.worksheets.getItem("活動機関に関する届出(離脱)") || workbook.worksheets.getItem(0);
  const f = payload.fields;
  const issue = parseDateParts(f.issue_date);

  writeCell(sheet, "J9", f.student_name || "");
  writeCell(sheet, "H15", f.address || "");
  writeCell(sheet, "J18", f.residence_card_no || "");
  writeCell(sheet, "AA12", f.nationality || "");
  writeCell(sheet, "J30", issue.year);
  writeCell(sheet, "P30", issue.month);
  writeCell(sheet, "T30", issue.day);
  writeCell(sheet, "J36", f.school_name || "");
  writeCell(sheet, "F47", f.student_name || "");
  writeCell(sheet, "J53", f.phone || "");
  writeCell(sheet, "I64", issue.year);
  writeCell(sheet, "O64", issue.month);
  writeCell(sheet, "S64", issue.day);

  const output = await SpreadsheetFile.exportXlsx(workbook);
  await output.save(payload.outputPath);
}

async function exportAnnualCompletionReport(payload) {
  const input = await FileBlob.load(payload.templatePath);
  const workbook = await SpreadsheetFile.importXlsx(input);
  const sheet = workbook.worksheets.getItem("報告様式") || workbook.worksheets.getItem(0);
  const f = payload.fields || {};
  const breakdown = f.course_breakdown || {};

  writeCell(sheet, "G2", `作成年月日：　　　${formatJapaneseDate(f.issue_date)}`);
  writeCell(sheet, "A3", `日本語教育機関名：${f.school_name || ""}`);
  writeCell(sheet, "A4", `設置者名：${f.operator_name || ""}`);
  writeCell(sheet, "G8", f.compliance_mark || "");
  writeCell(sheet, "C10", f.ratio_display || "");
  writeCell(sheet, "C11", f.completed_count || 0);
  writeCell(sheet, "C12", f.qualifying_count || 0);
  writeCell(sheet, "G12", f.withdrawal_count || 0);
  writeCell(sheet, "D17", breakdown["総合2年コース"]?.a || 0);
  writeCell(sheet, "E17", breakdown["総合1年コース"]?.a || 0);
  writeCell(sheet, "D18", breakdown["総合2年コース"]?.b || 0);
  writeCell(sheet, "E18", breakdown["総合1年コース"]?.b || 0);
  writeCell(sheet, "D19", breakdown["総合2年コース"]?.c || 0);
  writeCell(sheet, "E19", breakdown["総合1年コース"]?.c || 0);

  const output = await SpreadsheetFile.exportXlsx(workbook);
  await output.save(payload.outputPath);
}

async function exportAnnualCompletionList(payload) {
  const input = await FileBlob.load(payload.templatePath);
  const workbook = await SpreadsheetFile.importXlsx(input);
  const sheet = workbook.worksheets.getItem("リスト") || workbook.worksheets.getItem(0);
  const entries = payload.fields?.entries || [];

  for (let row = 3; row <= 220; row += 1) {
    for (const col of ["A", "B", "C", "D", "E", "F", "G"]) {
      writeCell(sheet, `${col}${row}`, "");
    }
  }

  entries.forEach((item, index) => {
    const row = 3 + index;
    writeCell(sheet, `A${row}`, item.no || index + 1);
    writeCell(sheet, `B${row}`, item.student_name || "");
    writeCell(sheet, `C${row}`, item.residence_card_no || "");
    writeCell(sheet, `D${row}`, item.requirement || "");
    writeCell(sheet, `E${row}`, item.destination || "");
    writeCell(sheet, `F${row}`, item.certificate_no || "");
    writeCell(sheet, `G${row}`, item.completion_date || "");
  });

  const output = await SpreadsheetFile.exportXlsx(workbook);
  await output.save(payload.outputPath);
}

const payloadPath = process.argv[2];
if (!payloadPath) {
  console.error("payload path required");
  process.exit(1);
}

const payload = JSON.parse(await fs.readFile(payloadPath, "utf8"));
if (payload.documentType === "withdrawal_report" && payload.templatePath && payload.templatePath.endsWith(".xlsx")) {
  await exportWithdrawalTemplate(payload);
} else if (payload.documentType === "semiannual_attendance_report") {
  await exportSemiannualAttendanceReport(payload);
} else if (payload.documentType === "may_november_report") {
  await exportMayNovemberReport(payload);
} else if (payload.documentType === "residence_renewal_report") {
  await exportResidenceRenewalReport(payload);
} else if (payload.documentType === "poor_attendance_report") {
  await exportPoorAttendanceReport(payload);
} else if (payload.documentType === "annual_completion_report" && payload.templatePath && payload.templatePath.endsWith(".xlsx")) {
  await exportAnnualCompletionReport(payload);
} else if (payload.documentType === "annual_completion_list" && payload.templatePath && payload.templatePath.endsWith(".xlsx")) {
  await exportAnnualCompletionList(payload);
} else {
  const workbook = Workbook.create();
  const sheet = workbook.worksheets.add("帳票");
  const rows = rowsFor(payload.documentType, payload.fields);
  sheet.getRange(`A1:B${rows.length}`).values = rows;
  const output = await SpreadsheetFile.exportXlsx(workbook);
  await output.save(payload.outputPath);
}
console.log(payload.outputPath);
