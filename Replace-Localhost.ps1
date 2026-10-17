[CmdletBinding()]
param(
    [string[]]$Roots = @('.\caffenacci.company', '.\caffenacci.customer'),
    [switch]$DryRun
)
$ErrorActionPreference = 'Stop'
$utf8 = New-Object System.Text.UTF8Encoding($false)
$bt = [string][char]96
$map = [ordered]@{
    'http://localhost:8000' = 'API_URL'
    'http://localhost:5173' = 'COMPANY_URL'
    'http://localhost:5174' = 'CUSTOMER_URL'
}
$changed = New-Object System.Collections.Generic.List[string]
$manual  = New-Object System.Collections.Generic.List[string]

function Convert-Source([string]$text) {
    $used = New-Object System.Collections.Generic.List[string]
    foreach ($origin in $map.Keys) {
        $name = $map[$origin]; $o = [regex]::Escape($origin); $before = $text

        # 1) wnetrze template literali: `http://localhost:8000${x}` -> `${API_URL}${x}`
        $ev1 = { param($m) $m.Value.Replace($origin, '${' + $name + '}') }.GetNewClosure()
        $text = [regex]::Replace($text, '\x60[^\x60]*\x60', [System.Text.RegularExpressions.MatchEvaluator]$ev1)

        # 2) atrybuty JSX: src="http://localhost:8000/x" -> src={`${API_URL}/x`}
        $ev2 = {
            param($m)
            $p = $m.Groups[3].Value
            if ($p -eq '') { $m.Groups[1].Value + '={' + $name + '}' }
            else { $m.Groups[1].Value + '={' + $bt + '${' + $name + '}' + $p + $bt + '}' }
        }.GetNewClosure()
        $text = [regex]::Replace($text, '(?<!\b(?:const|let|var)\s+)(?<=\s)([\w-]+)=([\x22\x27])' + $o + '([^\x22\x27\x60\r\n]*)\2',
            [System.Text.RegularExpressions.MatchEvaluator]$ev2)

        # 3) sam adres w cudzyslowie: 'http://localhost:8000' -> API_URL
        $ev3 = { param($m) $name }.GetNewClosure()
        $text = [regex]::Replace($text, '([\x22\x27])' + $o + '\1', [System.Text.RegularExpressions.MatchEvaluator]$ev3)

        # 4) adres + sciezka: 'http://localhost:8000/x' -> `${API_URL}/x`
        $ev4 = { param($m) $bt + '${' + $name + '}' + $m.Groups[2].Value + $bt }.GetNewClosure()
        $text = [regex]::Replace($text, '([\x22\x27])' + $o + '([^\x22\x27\x60\r\n]*)\1', [System.Text.RegularExpressions.MatchEvaluator]$ev4)

        if ($text -ne $before) { $used.Add($name) }
    }
    [pscustomobject]@{ Text = $text; Used = $used }
}

foreach ($root in $Roots) {
    $rootFull = (Resolve-Path $root).Path
    $src = Join-Path $rootFull 'src'
    $rootName = Split-Path $rootFull -Leaf
    $files = Get-ChildItem $src -Recurse -File -Include *.ts, *.tsx |
        Where-Object { $_.Name -notlike '*.d.ts' -and $_.FullName -ne (Join-Path $src 'config.ts') }

    foreach ($f in $files) {
        $orig  = [System.IO.File]::ReadAllText($f.FullName)
        $label = "$rootName\" + $f.FullName.Substring($rootFull.Length + 1)

        if ($orig -match '\b(const|let|var)\s+(API_URL|COMPANY_URL|CUSTOMER_URL)\b') {
            $manual.Add("${label}: plik juz deklaruje API_URL/COMPANY_URL/CUSTOMER_URL - pominiety")
            continue
        }

        $r = Convert-Source $orig
        $text = $r.Text

        if ($r.Used.Count -gt 0) {
            $names = @($r.Used | Sort-Object -Unique)
            $missing = @($names | Where-Object {
                $text -notmatch ('\{[^}]*\b' + $_ + '\b[^}]*\}\s*from\s*[\x22\x27][^\x22\x27]*config[\x22\x27]') })
            if ($missing.Count -gt 0) {
                $rel = $f.DirectoryName.Substring($src.Length).Trim('\')
                $depth = if ($rel) { ($rel -split '\\').Count } else { 0 }
                $prefix = if ($depth -gt 0) { '../' * $depth } else { './' }
                $nl = if ($text.Contains("`r`n")) { "`r`n" } else { "`n" }
                $line = "import { $($missing -join ', ') } from '${prefix}config'"
                $ms = [regex]::Matches($text, '(?ms)^import\b.*?[\x22\x27][^\x22\x27\r\n]+[\x22\x27];?[ \t]*(?=\r?$)')
                if ($ms.Count -gt 0) {
                    $last = $ms[$ms.Count - 1]
                    $text = $text.Insert($last.Index + $last.Length, $nl + $line)
                } else {
                    $text = $line + $nl + $text
                }
            }
        }

        if ($text -ne $orig) {
            $changed.Add("$label  [$($r.Used -join ', ')]")
            if (-not $DryRun) { [System.IO.File]::WriteAllText($f.FullName, $text, $utf8) }
        }

        $i = 0
        foreach ($l in ($text -split '\r?\n')) {
            $i++
            if ($l -match 'localhost|127\.0\.0\.1') { $manual.Add("${label}:${i}: $($l.Trim())") }
        }
    }
}

$mode = if ($DryRun) { 'DRY RUN - zmieniono by' } else { 'Zmieniono' }
Write-Host "`n=== $mode ($($changed.Count)) ===" -ForegroundColor Green
$changed | ForEach-Object { "  $_" }
Write-Host "`n=== Do recznej poprawy ($($manual.Count)) ===" -ForegroundColor Yellow
$manual | ForEach-Object { "  $_" }