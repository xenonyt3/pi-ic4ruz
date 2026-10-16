"""Import selected MIT OMP components from the pinned npm tarball, without executing it."""
import base64
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tarfile

ROOT = Path(__file__).resolve().parent.parent
INTEGRITY = 'xvHDKLcAsGvDwLQG6PHZEYiELQPKJ4NiSc/yeurja8IZkC7yALjR+2pbEiCT4cSdyIfEmHFDhDUze8hSxYpiZA=='
archive = Path(sys.argv[1])
if base64.b64encode(hashlib.sha512(archive.read_bytes()).digest()).decode() != INTEGRITY:
    raise SystemExit('OMP_ARCHIVE_INTEGRITY_MISMATCH')
dest = ROOT / 'vendor/oh-my-pi'
dest.mkdir(parents=True, exist_ok=True)
records = []
with tarfile.open(archive) as tar:
    def read(name):
        data = tar.extractfile('package/' + name).read()
        records.append({'path': name, 'sha256': hashlib.sha256(data).hexdigest()})
        return data.decode('utf-8')

    (dest / 'LICENSE').write_text(read('LICENSE'), encoding='utf-8', newline='\n')
    web_priority = json.loads(read('src/priority.json'))['web']
    sources = {
        'readable': read('src/tools/browser/readable.ts'),
        'turndown': read('src/utils/turndown.ts'),
        'console-capture': read('src/tools/browser/console-capture.ts'),
        'snapshot-plus': read('src/tools/browser/snapshot-plus.ts'),
        'aria-snapshot': read('src/tools/browser/aria/aria-snapshot.ts'),
    }
    sources['readable'] = sources['readable'].replace('@oh-my-pi/pi-utils/readability', '../../tools/web/dom.mjs').replace('@oh-my-pi/pi-utils/dom', '../../tools/web/dom.mjs').replace('../../web/scrapers/types', './html-markdown.mjs')
    sources['turndown'] = sources['turndown'].replace('import TurndownService, { gfm } from "@oh-my-pi/pi-utils/turndown";', 'import { TurndownService, gfm } from "../../tools/web/dom.mjs";')
    sources['aria-snapshot'] = sources['aria-snapshot'].replace('import { ToolError } from "@oh-my-pi/pi-tui/tools/tool-errors";', 'const ToolError = Error;').replace('"../snapshot-plus"', '"./snapshot-plus.mjs"').replace('import ariaBundle from "./aria-snapshot.bundle.txt" with { type: "text" };', 'import fs from "node:fs";\nconst ariaBundle = fs.readFileSync(new URL("./aria-snapshot.bundle.txt", import.meta.url), "utf8");')
    ddg = read('src/web/search/providers/duckduckgo.ts')
    sources['duckduckgo'] = ddg[ddg.index('interface ParsedResult'):ddg.index('/**\n * Query syntax')]
    sources['duckduckgo'] += '\nexport { parseHtmlResults, isAnomalyResponse };\n'
    google = read('src/web/search/providers/google.ts')
    utils = read('src/web/search/providers/utils.ts')
    normalize = utils[utils.index('export function normalizeSearchText'):utils.index('/**\n * Bare, deduplicated hosts')]
    sources['google'] = 'import { parseHTML } from "../../tools/web/dom.mjs";\n' + normalize + google[google.index('const GOOGLE_HOME_URL'):google.index('function buildSearchUrl')]
    sources['google'] += '\nexport { parseHtmlResults };\n'
    exa = read('src/web/search/providers/exa.ts')
    records_src = 'const asRecord = value => value && typeof value === "object" && !Array.isArray(value) ? value : undefined;\n'
    sources['exa'] = records_src + exa[exa.index('function isSearchResponse'):exa.index('export function normalizeSearchType')]
    sources['exa'] += exa[exa.index('function buildExaMcpArgs'):exa.index('async function callExaMcpSearch')]
    sources['exa'] += '\nexport { isSearchResponse, normalizeExaMcpPayload, parseExaMcpTextPayload, buildExaMcpArgs };\n'
    rpc = read('src/mcp/json-rpc.ts')
    sources['json-rpc'] = 'const isRecord = value => value !== null && typeof value === "object" && !Array.isArray(value);\n' + rpc[rpc.index('function decodeJsonRpcResponse'):rpc.index('/**\n * Read the matching JSON-RPC response')]
    sources['json-rpc'] += '\nexport { decodeJsonRpcResponse };\n'
    types = read('src/web/scrapers/types.ts')
    fn = types[types.index('export async function htmlToBasicMarkdown'):types.index('/**\n * Build a RenderResult')]
    sources['html-markdown'] = 'import { createTurndown } from "./turndown.mjs";\nlet instance;\nconst getTurndown = async () => instance ??= createTurndown();\n' + fn
    bundle = read('src/tools/browser/aria/aria-snapshot.bundle.txt')
    (dest / 'aria-snapshot.bundle.txt').write_text(bundle, encoding='utf-8', newline='\n')

for name, source in sources.items():
    script = "const fs=require('fs');const {stripTypeScriptTypes}=require('node:module');process.stdout.write(stripTypeScriptTypes(fs.readFileSync(0,'utf8'),{mode:'strip'}));"
    result = subprocess.run(['node', '--disable-warning=ExperimentalWarning', '-e', script], input=source, encoding='utf-8', capture_output=True, check=True)
    output = '\n'.join(line.rstrip() for line in result.stdout.splitlines()).rstrip() + '\n'
    (dest / (name + '.mjs')).write_text('// Adapted from @oh-my-pi/pi-coding-agent 18.10.1; see LICENSE and provenance.json.\n' + output, encoding='utf-8', newline='\n')
(dest / 'provenance.json').write_text(json.dumps({'package':'@oh-my-pi/pi-coding-agent','version':'18.10.1','repository':'https://github.com/can1357/oh-my-pi','npmIntegrity':'sha512-'+INTEGRITY,'defaultWebRolePriority':web_priority,'sources':records,'changes':['TypeScript types removed with Node; Node-compatible dependency imports','DDG/Google parsing and keyless Exa MCP helpers selected; no auth or hosted-model imports','Strict JSON-RPC decoder selected for bounded terminal-aware MCP response handling','Readability/Turndown use separately installed upstream libraries','ARIA bundle retained byte content; fs loader replaces Bun text import']},indent=2)+'\n',encoding='utf-8',newline='\n')
print(json.dumps({'imported':len(sources),'sourceFiles':len(records),'integrityVerified':True}))
