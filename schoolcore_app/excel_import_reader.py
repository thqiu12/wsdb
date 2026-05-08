#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from pathlib import Path

import pandas as pd


COLUMN_ALIASES = {
    "name": ["name", "氏名", "姓名", "学生姓名", "学生名", "応募者氏名", "Applicant Name"],
    "nationality": ["nationality", "国籍", "国籍・地域", "国籍地域"],
    "admission_term": ["admission_term", "入学期", "入学時期", "入学时期", "入学予定期"],
    "desired_study_length": ["desired_study_length", "語学学校滞在予定期間", "滞在予定期間", "语校滞留时长", "在留予定期間", "就学期間"],
    "agent_name": ["agent_name", "エージェント名", "中介名", "代理店名", "agency"],
    "email": ["email", "メール", "メールアドレス", "电子邮箱", "邮箱"],
    "phone": ["phone", "電話", "電話番号", "联系电话", "手机"],
    "birth_date": ["birth_date", "生年月日", "生日"],
    "passport_no": ["passport_no", "旅券番号", "パスポート番号", "護照號碼", "护照号码"],
    "address": ["address", "住所", "現住所", "地址"],
    "highest_education": ["highest_education", "最終学歴", "最高学历"],
    "school_name": ["school_name", "卒業学校名", "学校名", "毕业院校"],
    "graduation_year": ["graduation_year", "卒業年", "毕业年份"],
    "education_notes": ["education_notes", "学歴備考", "学历备注"],
    "previous_application": ["previous_application", "申請歴", "申请经历"],
    "japanese_study_history": ["japanese_study_history", "日本語学習歴", "日语学习经历"],
    "visa_history": ["visa_history", "在留資格歴", "签证经历"],
    "application_notes": ["application_notes", "申請備考", "申请备注"],
    "sponsor_name": ["sponsor_name", "経費支弁者氏名", "经费支付人姓名"],
    "sponsor_relationship": ["sponsor_relationship", "続柄", "关系"],
    "sponsor_phone": ["sponsor_phone", "経費支弁者電話", "经费支付人电话"],
    "sponsor_income": ["sponsor_income", "年収", "收入"],
    "financial_notes": ["financial_notes", "経費支弁備考", "经费支付备注"],
}


def normalize_header(value: object) -> str:
    return str(value or "").strip().casefold()


def normalize_cell(value: object) -> str:
    if value is None:
        return ""
    if pd.isna(value):
        return ""
    text = str(value).strip()
    return "" if text.lower() == "nan" else text


def choose_columns(df: pd.DataFrame) -> dict[str, str]:
    normalized = {normalize_header(column): column for column in df.columns}
    resolved: dict[str, str] = {}
    for canonical, aliases in COLUMN_ALIASES.items():
        for alias in aliases:
            actual = normalized.get(normalize_header(alias))
            if actual:
                resolved[canonical] = actual
                break
    return resolved


def main() -> int:
    if len(sys.argv) != 2:
        print(json.dumps({"ok": False, "message": "file path required"}, ensure_ascii=False))
        return 1
    path = Path(sys.argv[1])
    try:
        if path.suffix.lower() == ".csv":
            df = pd.read_csv(path)
        else:
            df = pd.read_excel(path)
    except Exception as exc:
        print(json.dumps({"ok": False, "message": f"ファイルを読み込めませんでした: {exc}"}, ensure_ascii=False))
        return 0

    df = df.dropna(how="all")
    columns = choose_columns(df)
    rows = []
    for _, record in df.iterrows():
        item = {key: normalize_cell(record.get(column)) for key, column in columns.items()}
        if not any(item.values()):
            continue
        rows.append(item)

    print(
        json.dumps(
            {
                "ok": True,
                "message": "xlsx/csv を取り込みました。",
                "row_count": len(rows),
                "mapped_columns": sorted(columns.keys()),
                "rows": rows,
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
