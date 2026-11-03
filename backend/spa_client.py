"""SPA (https://203.135.2.93) login client.

The site is ASP.NET WebForms. Login works as follows:
  1. GET /Login.aspx -> fetch __VIEWSTATE, __VIEWSTATEGENERATOR, __EVENTVALIDATION + cookies
  2. Encrypt username and password with AES-128-CBC (key=iv='9090808080809090') and post them
     base64-encoded in the HDusername / HDPassword hidden fields.
  3. Successful auth redirects to /Welcome.aspx.
"""
from __future__ import annotations

import base64
import io
import re
from typing import Any, Optional
from urllib.parse import urljoin

import requests
import urllib3
from bs4 import BeautifulSoup
from Crypto.Cipher import AES
from Crypto.Util.Padding import pad

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

BASE_URL = "https://203.135.2.93"
LOGIN_PATH = "/Login.aspx"

_AES_KEY = b"9090808080809090"
_AES_IV = b"9090808080809090"


def _aes_encrypt(plain: str) -> str:
    """Matches CryptoJS.AES.encrypt CBC/Pkcs7 used in SubmitsEncry() on Login.aspx."""
    cipher = AES.new(_AES_KEY, AES.MODE_CBC, _AES_IV)
    return base64.b64encode(cipher.encrypt(pad(plain.encode(), AES.block_size))).decode()


class SPAError(Exception):
    pass


class SPAClient:
    """Maintains one authenticated HTTP session against the SPA server."""

    def __init__(
        self,
        base_url: str = BASE_URL,
        username: str = "",
        password: str = "",
        timeout: float = 45.0,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.username = username
        self.password = password
        self.timeout = timeout
        self.session = requests.Session()
        self.session.verify = False
        self.session.headers["User-Agent"] = (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        )
        self._logged_in = False

    # ---------- internals -------------------------------------------------

    @staticmethod
    def _extract_hidden_fields(html: str) -> dict[str, str]:
        soup = BeautifulSoup(html, "html.parser")
        fields: dict[str, str] = {}
        for tag in soup.find_all("input", {"type": "hidden"}):
            name = tag.get("name")
            if name:
                fields[name] = tag.get("value", "")
        return fields

    def _full_url(self, path: str) -> str:
        return urljoin(self.base_url + "/", path.lstrip("/"))

    # ---------- auth -------------------------------------------------------

    def login(self, username: str = "", password: str = "") -> dict[str, Any]:
        user = username or self.username
        pwd = password or self.password
        if not user or not pwd:
            raise SPAError("username and password required")

        self._logged_in = False
        self.last_login: dict[str, Any] = {}

        self.session.cookies.clear()

        page = self.session.get(self._full_url(LOGIN_PATH), timeout=self.timeout)
        page.raise_for_status()
        fields = self._extract_hidden_fields(page.text)
        for required in ("__VIEWSTATE", "__EVENTVALIDATION"):
            if required not in fields:
                raise SPAError(f"login page missing {required}")

        payload = {
            "__VIEWSTATE": fields.get("__VIEWSTATE", ""),
            "__VIEWSTATEGENERATOR": fields.get("__VIEWSTATEGENERATOR", ""),
            "__EVENTVALIDATION": fields.get("__EVENTVALIDATION", ""),
            "responseCaptcha": "",
            "HDusername": _aes_encrypt(user),
            "HDPassword": _aes_encrypt(pwd),
            "txtUserName": "",
            "hfUserName": "",
            "txtPassword": "",
            "hfUserPassword": "",
            "Button1": "Log in",
        }
        resp = self.session.post(
            self._full_url(LOGIN_PATH), data=payload, timeout=self.timeout
        )
        resp.raise_for_status()

        if "Login.aspx" in resp.url:
            error = ""
            soup = BeautifulSoup(resp.text, "html.parser")
            div = soup.find(id="ErrorDiv")
            if div:
                error = div.get_text(strip=True)
            raise SPAError(error or "login failed")

        self._logged_in = True
        self.last_login = {
            "status": "success",
            "username": user,
            "landing_url": resp.url,
            "cookies": self.session.cookies.get_dict(),
        }
        return self.last_login

    def is_logged_in(self) -> bool:
        if not self._logged_in:
            return False
        try:
            resp = self.session.get(
                self._full_url("/Welcome.aspx"), timeout=self.timeout
            )
            ok = "Login.aspx" not in resp.url
        except requests.RequestException:
            ok = False
        self._logged_in = ok
        return ok

    def logout(self) -> dict[str, Any]:
        was = self._logged_in
        self._logged_in = False
        self.session.close()
        self.session = requests.Session()
        self.session.verify = False
        self.session.headers["User-Agent"] = (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        )
        return {"status": "logged_out", "was_logged_in": was}

    # ---------- authenticated fetching ------------------------------------

    def get_page(self, path: str) -> dict[str, Any]:
        if not self._logged_in:
            raise SPAError("not logged in")
        resp = self.session.get(self._full_url(path), timeout=self.timeout)
        if "Login.aspx" in resp.url:
            self._logged_in = False
            raise SPAError("session expired")
        resp.raise_for_status()
        return self.summarize_page(resp.text, resp.url)

    def post_form(self, path: str, extra_fields: dict[str, Any]) -> dict[str, Any]:
        """POST back to a WebForms page carrying its hidden fields + extra data."""
        if not self._logged_in:
            raise SPAError("not logged in")
        url = self._full_url(path)
        page = self.session.get(url, timeout=self.timeout)
        fields = {
            k: v
            for k, v in self._extract_hidden_fields(page.text).items()
            if k in ("__VIEWSTATE", "__VIEWSTATEGENERATOR", "__EVENTVALIDATION")
        }
        fields.update({k: str(v) for k, v in extra_fields.items()})
        resp = self.session.post(url, data=fields, timeout=self.timeout)
        resp.raise_for_status()
        return self.summarize_page(resp.text, resp.url)

    # ---------- complaint data (page-method) -------------------------------

    def get_complaints(
        self, start: str, end: str, filters: dict[str, Any] | None = None
    ) -> list[dict[str, Any]]:
        """Calls ComplaintList.aspx/getComplaintList (the WebMethod the page's
        JS uses). Dates use mm/dd/yyyy. Defaults to last 30 days on the page."""
        if not self._logged_in:
            raise SPAError("not logged in")

        page = self.session.get(
            self._full_url("/MembersArea/Complaints/ComplaintList.aspx"),
            timeout=self.timeout,
        )
        if "Login.aspx" in page.url:
            self._logged_in = False
            raise SPAError("session expired")

        m = re.search(r'id="userIdLogin"[^>]*value="([^"]*)"', page.text)
        payload = {
            "ComplaintListType": "",
            "startDate": start,
            "endDate": end,
            "complaint_status_id": "",
            "complaint_category_id": "",
            "complaint_service_provider_id": "",
            "complaint_nature_id": "",
            "city_id": "",
            "zone_id": "",
            "complaint_mode_id": "",
            "complaint_reffered_by_id": "",
            "complainant_cnic": "",
            "complainant_email": "",
            "SearchQuery": "",
            "SearchQuery1": "",
            "resolveDate": "",
            "onDeskUserType": "",
            "complaint_uc_id": "",
            "complaint_zone_id": "",
            "complaint_town_id": "",
            "complaint_ref_no": "",
            "complaint_source_id": "",
            "complaint_district_id": "",
            "complaint_division_id": "",
            "userIdLogin": m.group(1) if m else "",
        }
        if filters:
            payload.update({k: str(v) for k, v in filters.items()})

        resp = self.session.post(
            self._full_url(
                "/MembersArea/Complaints/ComplaintList.aspx/getComplaintList"
            ),
            json=payload,
            timeout=self.timeout,
        )
        resp.raise_for_status()
        return resp.json().get("d", [])


    @staticmethod
    def summarize_page(html: str, url: str) -> dict[str, Any]:
        soup = BeautifulSoup(html, "html.parser")
        title = soup.title.get_text(strip=True) if soup.title else ""
        error_div = soup.find(id="ErrorDiv")
        tables = [SPAClient._html_table(t) for t in soup.find_all("table")]
        return {
            "url": url,
            "title": title,
            "error": error_div.get_text(strip=True) if error_div else None,
            "tables": tables,
            "content_text": re.sub(r"\s+", " ", soup.body.get_text(" ")).strip()[:10_000]
            if soup.body
            else "",
            "html": html,
        }

    @staticmethod
    def _html_table(table) -> dict[str, Any]:
        headers = []
        rows_out: list[dict[str, str]] = [{}]
        trs = table.find_all("tr")
        if not trs:
            return {"headers": [], "rows": []}
        header_cells = trs[0].find_all(["th"])
        if header_cells:
            headers = [c.get_text(strip=True) for c in header_cells]
        rows: list[dict[str, Any]] = []
        for tr in trs[1:] if header_cells else trs:
            cells = tr.find_all(["td"])
            if not cells:
                continue
            vals = [c.get_text(" ", strip=True) for c in cells]
            if headers and len(vals) <= len(headers):
                rows.append(dict(zip(headers, vals)))
            else:
                rows.append({"col%d" % i: v for i, v in enumerate(vals)})
        return {"headers": headers, "rows": rows}
