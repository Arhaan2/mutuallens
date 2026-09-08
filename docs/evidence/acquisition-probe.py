#!/usr/bin/env python3
"""Bounded, unauthenticated acquisition preflight; never starts a scan.

Uses fixed public schemas and GET endpoints with no target/account query.
Does not read environment variables, credentials, cookies, or local exports.
Only schema field names and redacted error metadata are persisted.
Run from repository root: python3 docs/evidence/acquisition-probe.py
"""

import concurrent.futures
import datetime
import hashlib
import json
import pathlib
import time
import urllib.error
import urllib.request

SOURCES = (
    ("hiker-schema", "https://api.hikerapi.com/openapi.json"),
    ("socialcrawl-schema", "https://www.socialcrawl.dev/v1/openapi.json"),
    ("hiker-followers-auth", "https://api.hikerapi.com/g2/user/followers"),
    ("hiker-following-auth", "https://api.hikerapi.com/g2/user/following"),
    ("socialcrawl-followers-auth", "https://www.socialcrawl.dev/v1/instagram/followers"),
    ("socialcrawl-following-auth", "https://www.socialcrawl.dev/v1/instagram/following"),
)
MAX_BYTES = 32 * 1024 * 1024


def fields(schema):
    return sorted(schema.get("properties", {}).keys())


def fetch(source):
    label, url = source
    started = time.monotonic()
    result = {"label": label, "method": "GET", "url": url,
              "authentication_sent": False, "target_sent": False}
    request = urllib.request.Request(url, headers={"User-Agent": "MutualLens-feasibility/0.1"})
    try:
        try:
            response = urllib.request.urlopen(request, timeout=20)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            body = response.read(MAX_BYTES + 1)
            result.update(status=response.status, final_url=response.url,
                          content_type=response.headers.get("Content-Type"))
        if len(body) > MAX_BYTES:
            raise ValueError("response exceeds documentation byte limit")
        result["sha256"] = hashlib.sha256(body).hexdigest()
        payload = json.loads(body)
        if label.endswith("-schema") and result["status"] == 200:
            result["schema_version"] = payload.get("info", {}).get("version")
            result["openapi_version"] = payload.get("openapi")
            wanted = (["/g2/user/followers", "/g2/user/following"]
                      if label.startswith("hiker") else ["/instagram/followers", "/instagram/following"])
            result["endpoints"] = {}
            for endpoint in wanted:
                operation = payload["paths"][endpoint]["get"]
                item = {"parameters": [{"name": p["name"], "in": p["in"],
                                         "required": p.get("required", False)}
                                        for p in operation.get("parameters", [])],
                        "security": operation.get("security"),
                        "credit_cost": operation.get("x-credit-cost")}
                response_doc = operation["responses"]["200"]["content"]["application/json"]
                schema = response_doc["schema"]
                item["response_schema_ref"] = schema.get("$ref")
                if schema.get("$ref"):
                    schema = payload["components"]["schemas"][schema["$ref"].split("/")[-1]]
                item["response_fields"] = fields(schema)
                item["pagination_fields"] = fields(schema.get("properties", {}).get("pagination", {}))
                item["data_fields"] = fields(schema.get("properties", {}).get("data", {}))
                item["example_response_field_names_only"] = fields({"properties": response_doc.get("example", {}).get("response", {})})
                result["endpoints"][endpoint] = item
        elif isinstance(payload, dict):
            # Never save arbitrary response bodies or unexpected account data.
            result["body_keys"] = sorted(payload.keys())
            error = payload.get("error")
            if isinstance(error, dict):
                result["error_type"] = error.get("type")
            if payload.get("detail") == "Not authenticated":
                result["error_type"] = "Not authenticated"
            if isinstance(payload.get("credits_used"), (int, float)):
                result["credits_used"] = payload["credits_used"]
    except Exception as error:
        result["transport_error_type"] = type(error).__name__
    result["elapsed_seconds"] = round(time.monotonic() - started, 3)
    return result


def main():
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        observations = list(pool.map(fetch, SOURCES))
    report = {
        "observed_at_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "purpose": "Public schema and authentication-boundary observations only; no live list test",
        "live_target_test": "NOT RUN",
        "observations": observations,
    }
    output = pathlib.Path(__file__).with_name("acquisition-probe-results.json")
    # Preserve prior evidence if this fixed preflight is rerun.
    if output.exists():
        previous = output.with_name("acquisition-probe-results-previous.json")
        previous.write_text(output.read_text())
    output.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
