if ($MyInvocation.ExpectingInput) {
    $input | & node.exe (Join-Path $PSScriptRoot 'launch.mjs') @args
} else {
    & node.exe (Join-Path $PSScriptRoot 'launch.mjs') @args
}
exit $LASTEXITCODE
