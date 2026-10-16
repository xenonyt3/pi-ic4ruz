if ($MyInvocation.ExpectingInput) {
    $input | & node.exe (Join-Path $PSScriptRoot 'icarus.mjs') @args
} else {
    & node.exe (Join-Path $PSScriptRoot 'icarus.mjs') @args
}
exit $LASTEXITCODE
