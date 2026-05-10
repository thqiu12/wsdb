#!/usr/bin/env python3
import json
import os
import sys
import urllib.error
import urllib.request
from typing import Optional


BASE_URL = os.environ.get("SCHOOLCORE_BASE_URL", "http://127.0.0.1:8766")
TIMEOUT = 10


def fetch_json(path: str, method: str = "GET", payload: Optional[dict] = None, headers: Optional[dict] = None) -> dict:
    data = None
    request_headers = dict(headers or {})
    if payload is not None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        request_headers["content-type"] = "application/json"
    request = urllib.request.Request(f"{BASE_URL}{path}", data=data, headers=request_headers, method=method)
    with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
        body = response.read().decode("utf-8")
        return json.loads(body)


def expect(condition: bool, label: str, detail: str = "") -> None:
    if condition:
        print(f"[PASS] {label}")
        return
    print(f"[FAIL] {label}")
    if detail:
        print(f"       {detail}")
    raise SystemExit(1)


def main() -> None:
    print(f"SchoolCore internal trial smoke check: {BASE_URL}")

    staff_login_id = os.environ.get("SCHOOLCORE_STAFF_LOGIN", "yamada").strip()
    staff_password = os.environ.get("SCHOOLCORE_STAFF_PASSWORD", "Yamada2026!").strip()
    admin_auth_headers = {}

    try:
        staff_login = fetch_json(
            "/api/staff-login",
            method="POST",
            payload={"login_id": staff_login_id, "password": staff_password},
        )
        expect(bool(staff_login.get("staff")) and bool(staff_login.get("session_token")), "staff login API")
        admin_auth_headers["x-staff-session"] = staff_login["session_token"]
    except urllib.error.HTTPError as error:
        print(f"[FAIL] staff login API: {error}")
        raise SystemExit(1)

    try:
        health = fetch_json("/api/health")
        dashboard = fetch_json("/api/dashboard", headers=admin_auth_headers)
        students = fetch_json("/api/students", headers=admin_auth_headers)
        applicants = fetch_json("/api/applicants", headers=admin_auth_headers)
        certificate_requests = fetch_json("/api/certificate-requests", headers=admin_auth_headers)
        attendance_sessions = fetch_json("/api/attendance-checkin-sessions", headers=admin_auth_headers)
        immigration = fetch_json("/api/immigration-reports/annual-completion", headers=admin_auth_headers)
    except urllib.error.URLError as error:
        print(f"[FAIL] API request failed: {error}")
        raise SystemExit(1)

    expect(health.get("ok") is True, "health endpoint")
    expect("student_count" in dashboard and "applicant_count" in dashboard, "dashboard summary keys")
    expect(isinstance(students, list) and len(students) > 0, "students list is available")
    expect(isinstance(applicants, list), "applicants list is available")
    expect(isinstance(certificate_requests, dict) and "items" in certificate_requests, "certificate requests API")
    expect(isinstance(attendance_sessions, dict) and "sessions" in attendance_sessions, "attendance session API")
    expect(isinstance(immigration, dict) and immigration.get("summary") is not None, "annual completion report API")

    login_id = os.environ.get("SCHOOLCORE_STUDENT_LOGIN", "").strip()
    password = os.environ.get("SCHOOLCORE_STUDENT_PASSWORD", "").strip()

    if login_id and password:
        try:
            login = fetch_json(
                "/api/public/student-login",
                method="POST",
                payload={"login_id": login_id, "password": password},
            )
        except urllib.error.HTTPError as error:
            print(f"[FAIL] student login API: {error}")
            raise SystemExit(1)
        expect(bool(login.get("student")) and bool(login.get("session_token")), "student login API")
        try:
            portal = fetch_json(
                "/api/public/student-session",
                method="POST",
                payload={"session_token": login["session_token"]},
            )
        except urllib.error.HTTPError as error:
            print(f"[FAIL] student portal refresh API: {error}")
            raise SystemExit(1)
        expect(bool(portal.get("student")) and "attendance" in portal, "student portal session refresh")
        before_count = len(portal.get("certificate_requests") or [])
        test_purpose = f"内部試運行自検 {login_id}"
        try:
            certificate_request = fetch_json(
                "/api/public/certificate-request",
                method="POST",
                payload={
                    "session_token": login["session_token"],
                    "certificate_type": "修了証明書",
                    "purpose": test_purpose,
                    "copies": 1,
                    "delivery_method": "電子",
                },
            )
        except urllib.error.HTTPError as error:
            print(f"[FAIL] student public certificate request API: {error}")
            raise SystemExit(1)
        expect(certificate_request.get("ok") is True and bool(certificate_request.get("request")), "student public certificate request API")
        portal_after = fetch_json(
            "/api/public/student-session",
            method="POST",
            payload={"session_token": login["session_token"]},
        )
        after_requests = portal_after.get("certificate_requests") or []
        expect(len(after_requests) == before_count + 1, "student certificate request reflected in portal session")
        expect(any(item.get("purpose") == test_purpose for item in after_requests), "student certificate request is visible in portal history")
    else:
        print("[SKIP] student login API (set SCHOOLCORE_STUDENT_LOGIN / SCHOOLCORE_STUDENT_PASSWORD to enable)")

    print("[DONE] internal trial smoke check passed")


if __name__ == "__main__":
    main()
