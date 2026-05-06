#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
import sys
import urllib.parse
import urllib.request
import urllib.error
import json

from _bootstrap import load_local_env


AUTH_URL = "https://www.amazon.com/ap/oa"
TOKEN_URL = "https://api.amazon.com/auth/o2/token"
ADS_SCOPE = "advertising::campaign_management"


def require_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise SystemExit(f"Missing {name}")
    return value


def auth_url() -> None:
    client_id = require_env("ADS_CLIENT_ID")
    redirect_uri = require_env("ADS_REDIRECT_URI")
    params = {
        "client_id": client_id,
        "scope": ADS_SCOPE,
        "response_type": "code",
        "redirect_uri": redirect_uri,
    }
    print(AUTH_URL + "?" + urllib.parse.urlencode(params))


def exchange_code(code: str) -> None:
    client_id = require_env("ADS_CLIENT_ID")
    client_secret = require_env("ADS_CLIENT_SECRET")
    redirect_uri = require_env("ADS_REDIRECT_URI")
    body = urllib.parse.urlencode(
        {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirect_uri,
            "client_id": client_id,
            "client_secret": client_secret,
        }
    ).encode()
    request = urllib.request.Request(
        TOKEN_URL,
        data=body,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            payload = json.loads(response.read().decode())
    except urllib.error.HTTPError as exc:
        try:
            payload = json.loads(exc.read().decode())
        except Exception:
            payload = {}
        print(f"status={exc.code}")
        print(f"error={payload.get('error')}")
        print(f"error_description={payload.get('error_description')}")
        raise SystemExit(1)

    refresh_token = payload.get("refresh_token")
    print("exchange=ok" if refresh_token else "exchange=missing_refresh_token")
    if refresh_token:
        print(f"ADS_REFRESH_TOKEN=set len={len(refresh_token)}")


def main() -> None:
    load_local_env()
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("url")
    exchange = subparsers.add_parser("exchange")
    exchange.add_argument("code")
    args = parser.parse_args()

    if args.command == "url":
        auth_url()
    elif args.command == "exchange":
        exchange_code(args.code)
    else:
        raise SystemExit(2)


if __name__ == "__main__":
    sys.exit(main())
