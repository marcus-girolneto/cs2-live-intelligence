#!/usr/bin/env python3
"""Start the local stack and optionally load the checksum-pinned public demo."""
import argparse
import json
from pathlib import Path
import secrets
import subprocess
import time
import urllib.request

ROOT = Path(__file__).resolve().parents[1]

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--with-demo', action='store_true')
    args = parser.parse_args()
    env_file = ROOT / '.env'
    if not env_file.exists():
        value = (ROOT / '.env.example').read_text()
        for placeholder in ['replace-device-token', 'replace-browser-token', 'replace-local-gsi-token']:
            value = value.replace(placeholder, secrets.token_urlsafe(32))
        env_file.write_text(value)
        env_file.chmod(0o600)
    subprocess.run(['docker','compose','-f','compose.yaml','-f','compose.local.yaml','up','-d','--build','--wait'],cwd=ROOT,check=True)
    print('Local app: http://127.0.0.1:3000 (no sign-in needed in local mode).')
    if not args.with_demo:
        return
    subprocess.run(['python3','apps/demo-parser/scripts/fetch-fixture.py'],cwd=ROOT,check=True)
    config={line.split('=',1)[0]:line.split('=',1)[1] for line in env_file.read_text().splitlines() if '=' in line and not line.startswith('#')}
    token=config['WEB_TOKEN']
    def request(path, data=None, headers=None):
        req=urllib.request.Request('http://127.0.0.1:4000'+path,data=data,headers={'Authorization':'Bearer '+token,**(headers or {})})
        with urllib.request.urlopen(req,timeout=120) as response:
            return json.load(response)
    matches=request('/v1/matches')['matches']
    existing=next((m for m in matches if m['filename']=='public-cs2.dem' and m['status']=='complete'),None)
    if existing:
        print('Public demo already analyzed:',existing['id'])
        return
    demo=ROOT/'apps/demo-parser/testdata/public-cs2.dem'
    job=request('/v1/demos/uploads',demo.read_bytes(),{'Content-Type':'application/octet-stream','x-filename':'public-cs2.dem'})
    for _ in range(120):
        match=request('/v1/matches/'+job['id'])
        if match['status']=='failed':
            raise RuntimeError(match.get('error','Demo processing failed'))
        if match['status']=='complete':
            print('Real public demo analyzed. Open /history and select public-cs2.dem.')
            return
        time.sleep(1)
    raise RuntimeError('Demo analysis did not finish within 120 seconds')

if __name__=='__main__':
    main()
