[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet('run', 'open', 'setup', 'update', 'install', 'package', 'build', 'test', 'doctor', 'status', 'clean', 'help')]
    [string]$Mode = 'run',

    [Parameter(Position = 1)]
    [string]$Target = 'default'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# Launched from WSL, the inherited Path can start with empty entries (";;C:\..."), and cmd.exe then
# finds nothing on it, not even npm.cmd. Child processes get the Path without them.
$env:Path = (($env:Path -split ';') | Where-Object { $_ }) -join ';'

$LauncherRoot = Split-Path -Parent $PSScriptRoot
$PackageFile = Join-Path $LauncherRoot 'package.json'
$DeveloperRuntime = Join-Path $env:LOCALAPPDATA 'Instrumenta\developer-runtime'
$ElectronExe = Join-Path $DeveloperRuntime 'node_modules\electron\dist\electron.exe'
$InstalledCandidates = @(
    (Join-Path $env:LOCALAPPDATA 'Programs\instrumenta-launcher\Instrumenta.exe'),
    (Join-Path $env:LOCALAPPDATA 'Programs\Instrumenta\Instrumenta.exe')
)

function Write-Stage([string]$Message) {
    Write-Host "`n  $Message" -ForegroundColor Cyan
}

function Assert-LastCommand([string]$Description) {
    if ($LASTEXITCODE -ne 0) {
        throw "$Description failed with exit code $LASTEXITCODE."
    }
}

function Require-Node {
    if (-not (Get-Command 'node.exe' -ErrorAction SilentlyContinue) -or
        -not (Get-Command 'npm.cmd' -ErrorAction SilentlyContinue)) {
        throw @"
Instrumenta's desktop runtime is not installed yet because Node.js was not found.

Install the current Node.js LTS from https://nodejs.org, then double-click Instrumenta.cmd again.
This is only needed when running Instrumenta directly from its source folder; the packaged
Instrumenta installer does not require Node.js.
"@
    }
}

function Invoke-Maintenance([string]$Command) {
    Require-Node
    & node.exe (Join-Path $LauncherRoot 'scripts\workspace-maintenance.cjs') $Command
    Assert-LastCommand "Instrumenta $Command"
}

function Assert-PackageIcons {
    Invoke-Maintenance 'check-icon'
}

function Install-LauncherDependencies {
    if (Test-Path $ElectronExe) { return }
    Require-Node
    Write-Stage 'Preparing the Instrumenta desktop app (first run only)...'
    New-Item -ItemType Directory -Path $DeveloperRuntime -Force | Out-Null
    $RuntimePackage = @'
{
  "name": "instrumenta-developer-runtime",
  "private": true,
  "dependencies": {
    "electron": "43.2.0"
  }
}
'@
    Set-Content -LiteralPath (Join-Path $DeveloperRuntime 'package.json') -Value $RuntimePackage -Encoding UTF8
    # Keep the Windows runtime on a normal Windows path. npm.cmd cannot use a
    # WSL UNC folder as its process working directory.
    Push-Location $DeveloperRuntime
    try {
        & npm.cmd install --no-audit --no-fund
        Assert-LastCommand 'Instrumenta desktop setup'
        if (-not (Test-Path $ElectronExe)) {
            & node.exe (Join-Path $DeveloperRuntime 'node_modules\electron\install.js')
            Assert-LastCommand 'Electron runtime download'
        }
    } finally {
        Pop-Location
    }
    if (-not (Test-Path $ElectronExe)) {
        throw "Electron did not produce its Windows runtime at $ElectronExe"
    }
}

function Get-SourceVersion {
    try {
        return [version](Get-Content -LiteralPath $PackageFile -Raw | ConvertFrom-Json).version
    } catch {
        return [version]'0.0.0'
    }
}

function Get-SourceCandidate {
    $Times = @((Get-Item -LiteralPath $PackageFile).LastWriteTimeUtc)
    foreach ($Relative in @('electron', 'brand', 'packaging')) {
        $Directory = Join-Path $LauncherRoot $Relative
        if (Test-Path $Directory) {
            $Times += Get-ChildItem -LiteralPath $Directory -File -Recurse -ErrorAction SilentlyContinue |
                Select-Object -ExpandProperty LastWriteTimeUtc
        }
    }
    return [pscustomobject]@{
        Kind = 'source'
        Path = $LauncherRoot
        Version = (Get-SourceVersion)
        BuiltAt = ($Times | Sort-Object -Descending | Select-Object -First 1)
    }
}

function Select-NewestCandidate([object[]]$Candidates) {
    $Available = @($Candidates | Where-Object { $_ })
    $Node = Get-Command 'node.exe' -ErrorAction SilentlyContinue
    if ($Node) {
        $SerializableCandidates = @($Available | ForEach-Object {
            @{ kind = $_.Kind; version = $_.Version.ToString(); builtAt = $_.BuiltAt.ToFileTimeUtc() }
        })
        $Serializable = ConvertTo-Json -InputObject $SerializableCandidates -Compress
        $EncodedCandidates = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($Serializable))
        $SelectedKind = & node.exe (Join-Path $LauncherRoot 'scripts\release-selection.cjs') select-base64 $EncodedCandidates
        if ($LASTEXITCODE -eq 0) {
            return $Available | Where-Object { $_.Kind -eq $SelectedKind } | Select-Object -First 1
        }
    }
    return $Available |
        Sort-Object @{ Expression = 'Version'; Descending = $true },
                    @{ Expression = 'BuiltAt'; Descending = $true } |
        Select-Object -First 1
}

function Find-PortablePackage {
    # Version is authoritative; build time breaks equal-version ties so a fresh
    # package with new artwork is not hidden behind an older installed copy.
    $Portable = Get-ChildItem -Path (Join-Path $LauncherRoot 'release') `
        -Filter 'Instrumenta-Portable-*.exe' -File -ErrorAction SilentlyContinue |
        ForEach-Object {
            $Parsed = $null
            if ([version]::TryParse(($_.BaseName -replace '^Instrumenta-Portable-', ''), [ref]$Parsed)) {
                [pscustomobject]@{ Kind = 'portable'; Path = $_.FullName; Version = $Parsed; BuiltAt = $_.LastWriteTimeUtc }
            }
        } |
        Sort-Object Version, BuiltAt -Descending |
        Select-Object -First 1
    return $Portable
}

function Find-InstalledApplication {
    $Installed = $InstalledCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
    if (-not $Installed) { return $null }
    $Parsed = [version]'0.0.0'
    $InstalledFile = Get-Item -LiteralPath $Installed
    $Product = $InstalledFile.VersionInfo.ProductVersion
    if ($Product) { [void][version]::TryParse(($Product -split '-')[0], [ref]$Parsed) }
    # NSIS preserves the packaged executable timestamp, while the containing
    # directory records when that package was actually installed. Include both
    # so an equal-version installation wins over the portable file it came from.
    $InstallDirectoryTime = (Get-Item -LiteralPath (Split-Path -Parent $Installed)).LastWriteTimeUtc
    $InstalledAt = @($InstalledFile.LastWriteTimeUtc, $InstallDirectoryTime) |
        Sort-Object -Descending |
        Select-Object -First 1
    return [pscustomobject]@{ Kind = 'installed'; Path = $Installed; Version = $Parsed; BuiltAt = $InstalledAt }
}

function Get-CatalogSourceDirectories {
    $CatalogFile = Join-Path $LauncherRoot 'products\catalog.json'
    if (-not (Test-Path $CatalogFile)) { return @() }
    return @((Get-Content -LiteralPath $CatalogFile -Raw | ConvertFrom-Json).products |
        ForEach-Object { $_.sourceDirectory })
}

function Save-LocalWorkspacePreference {
    # A workspace is the launcher checkout plus at least one registered product checkout. Nobody
    # has to clone every product to have one.
    $WorkspaceRoot = Split-Path -Parent $LauncherRoot
    $Present = @(Get-CatalogSourceDirectories | Where-Object { Test-Path (Join-Path $LauncherRoot $_) })
    if ($Present.Count -eq 0) { return }
    $SettingsDirectory = Join-Path $env:APPDATA 'instrumenta-launcher'
    $SettingsFile = Join-Path $SettingsDirectory 'settings.json'
    New-Item -ItemType Directory -Path $SettingsDirectory -Force | Out-Null
    # Merge rather than replace: settings.json also holds the launcher's update preferences, and
    # writing only the workspace used to throw those away on every install.
    $Settings = [ordered]@{}
    if (Test-Path -LiteralPath $SettingsFile) {
        try {
            $Existing = Get-Content -LiteralPath $SettingsFile -Raw | ConvertFrom-Json
            foreach ($Property in $Existing.PSObject.Properties) { $Settings[$Property.Name] = $Property.Value }
        } catch {
            # An unreadable file is replaced, as it always was.
        }
    }
    $Settings['workspace'] = $WorkspaceRoot
    $Json = [pscustomobject]$Settings | ConvertTo-Json -Depth 8
    $Utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($SettingsFile, $Json, $Utf8WithoutBom)
}

function Assert-InstalledRelease([string]$ExpectedVersion) {
    $Candidates = @($InstalledCandidates | ForEach-Object {
        if (Test-Path -LiteralPath $_) {
            $Item = Get-Item -LiteralPath $_
            @{ path = $Item.FullName; exists = $true; version = [string]$Item.VersionInfo.ProductVersion }
        } else {
            @{ path = $_; exists = $false; version = '' }
        }
    })
    $Json = ConvertTo-Json -InputObject $Candidates -Compress
    $Encoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($Json))
    $InstalledPath = & node.exe (Join-Path $LauncherRoot 'scripts\install-verification.cjs') $ExpectedVersion $Encoded
    Assert-LastCommand 'Instrumenta installation verification'
    return ($InstalledPath | Select-Object -Last 1)
}

function Find-ObsoleteInstalledCopies([string]$CurrentPath, [version]$CurrentVersion) {
    $CurrentDirectory = if ($CurrentPath) { [IO.Path]::GetFullPath((Split-Path -Parent $CurrentPath)) } else { '' }
    return @($InstalledCandidates | Where-Object {
        (Test-Path -LiteralPath $_) -and
        ([IO.Path]::GetFullPath((Split-Path -Parent $_)) -ne $CurrentDirectory)
    } | ForEach-Object {
        $Item = Get-Item -LiteralPath $_
        $Parsed = [version]'0.0.0'
        $Product = $Item.VersionInfo.ProductVersion
        $ParsedSuccessfully = $false
        if ($Product) { $ParsedSuccessfully = [version]::TryParse(($Product -split '-')[0], [ref]$Parsed) }
        if ($ParsedSuccessfully -and $Parsed -lt $CurrentVersion) {
            [pscustomobject]@{
                Path = $_
                Directory = Split-Path -Parent $_
                Version = $Parsed
            }
        }
    })
}

function Confirm-CleanupObsoleteCopies([object[]]$Copies) {
    $Available = @($Copies | Where-Object { $_ -and (Test-Path -LiteralPath $_.Directory) })
    if (-not $Available) { return }
    Add-Type -AssemblyName System.Windows.Forms
    $Details = ($Available | ForEach-Object { "  $($_.Version) - $($_.Directory)" }) -join "`n"
    $Message = "Instrumenta is installed successfully. The following older installation folder(s) are no longer needed:`n`n$Details`n`nRemove them now? User settings and documents are kept."
    $Choice = [System.Windows.Forms.MessageBox]::Show(
        $Message,
        'Clean up older Instrumenta versions?',
        [System.Windows.Forms.MessageBoxButtons]::YesNo,
        [System.Windows.Forms.MessageBoxIcon]::Question)
    if ($Choice -ne [System.Windows.Forms.DialogResult]::Yes) {
        Write-Host '  Older installation folders were kept.' -ForegroundColor DarkGray
        return
    }
    foreach ($Copy in $Available) {
        if (Test-Path -LiteralPath $Copy.Directory) {
            Remove-Item -LiteralPath $Copy.Directory -Recurse -Force
            Write-Host "  Removed obsolete Instrumenta $($Copy.Version): $($Copy.Directory)" -ForegroundColor DarkGray
        }
    }
}

function Open-Instrumenta {
    # Open the newest Instrumenta that exists, never simply the installed one.
    # An old installed copy used to win unconditionally, so this command could
    # open a build with different artwork and fewer instruments than the release
    # sitting beside it.
    $Source = Get-SourceCandidate
    $Installed = Find-InstalledApplication
    $Portable = Find-PortablePackage

    $Best = Select-NewestCandidate @($Source, $Installed, $Portable)

    if ($Best.Kind -eq 'source') {
        if ($Installed -or $Portable) {
            Write-Host "`n  Opening Instrumenta $($Source.Version) from source because it is the newest build." -ForegroundColor Cyan
        }
        Install-LauncherDependencies
        Start-Process -FilePath $ElectronExe -ArgumentList @($LauncherRoot) -WorkingDirectory $DeveloperRuntime
        return
    }

    if ($Best) {
        if ($Installed -and $Best.Path -ne $Installed.Path) {
            Write-Host "`n  The installed Instrumenta is $($Installed.Version); opening the newer $($Best.Version) package instead." -ForegroundColor Yellow
            Write-Host '  Open the freshly built Instrumenta-Setup executable to replace the installed application.' -ForegroundColor Yellow
        }
        Start-Process -FilePath $Best.Path -WorkingDirectory (Split-Path -Parent $Best.Path)
        return
    }
}

function Copy-PackageWorkspace {
    $PackageWorkspace = Join-Path $env:LOCALAPPDATA 'Instrumenta\package-workspace'
    $LocalLauncher = Join-Path $PackageWorkspace 'Instrumenta'
    if (Test-Path $PackageWorkspace) {
        Remove-Item -LiteralPath $PackageWorkspace -Recurse -Force
    }
    New-Item -ItemType Directory -Path $LocalLauncher -Force | Out-Null

    foreach ($Item in @('package.json', 'package-lock.json', 'electron', 'brand', 'packaging', 'scripts', 'products')) {
        $Source = Join-Path $LauncherRoot $Item
        if (Test-Path $Source) { Copy-Item -LiteralPath $Source -Destination $LocalLauncher -Recurse -Force }
    }

    # `sourceDirectory` is relative to the launcher root, which is how `product-registry.cjs`
    # resolves it. Joining it to the workspace parent instead counted the `..` twice and pointed
    # every product one level too high, so nothing was found and the package shipped without a
    # single application in it.
    $Catalog = Get-Content -LiteralPath (Join-Path $LauncherRoot 'products\catalog.json') -Raw | ConvertFrom-Json
    $PackageInputs = Get-Content -LiteralPath (Join-Path $LauncherRoot 'scripts\package-inputs.json') -Raw | ConvertFrom-Json
    $InputNames = @($PackageInputs.PSObject.Properties.Name)
    foreach ($Entry in $Catalog.products) {
        $SourceRoot = [IO.Path]::GetFullPath((Join-Path $LauncherRoot $Entry.sourceDirectory))
        $DestinationRoot = Join-Path $PackageWorkspace (Split-Path -Leaf $SourceRoot)
        New-Item -ItemType Directory -Path $DestinationRoot -Force | Out-Null
        $Manifest = Join-Path $SourceRoot 'instrumenta\product.json'
        if (Test-Path $Manifest) {
            $ManifestDestination = Join-Path $DestinationRoot 'instrumenta'
            New-Item -ItemType Directory -Path $ManifestDestination -Force | Out-Null
            Copy-Item -LiteralPath $Manifest -Destination (Join-Path $ManifestDestination 'product.json') -Force
        }
        # Every web product the installer bakes in gets its build inputs, whatever its adapter: a
        # product moving onto managed-web still ships this way until its release takes over. A
        # product names its own input list, or its adapter's default applies. Copying only for
        # web-vite and web-static used to leave any other web product with nothing to build.
        if ($Entry.adapter -in @('web-vite', 'web-static', 'managed-web')) {
            $Items = if ($InputNames -contains $Entry.id) {
                $PackageInputs.($Entry.id)
            } elseif ($InputNames -contains $Entry.adapter) {
                $PackageInputs.($Entry.adapter)
            } else {
                throw "scripts\package-inputs.json names no build inputs for $($Entry.id)."
            }
            foreach ($Item in $Items) {
                $Source = Join-Path $SourceRoot $Item
                if (Test-Path $Source) { Copy-Item -LiteralPath $Source -Destination $DestinationRoot -Recurse -Force }
            }
        }
        # Native bundles are never staged: Fabula's is a per-machine Electron deploy that Prepare
        # builds on each computer.
    }
    return $LocalLauncher
}

function Prepare-Workspace([string]$Target = 'web', [bool]$InstallAi = $false) {
    Require-Node
    $Arguments = @((Join-Path $LauncherRoot 'scripts\workspace-manager.cjs'), 'prepare', $Target)
    if ($InstallAi) { $Arguments += '--install-ai' }
    & node.exe @Arguments
    Assert-LastCommand 'Instrumenta application preparation'
}

function Build-Packages {
    Require-Node
    Assert-PackageIcons
    Write-Stage 'Creating a normal Windows installer and portable app...'
    $LocalLauncher = Copy-PackageWorkspace
    $PackageWorkspace = Split-Path -Parent $LocalLauncher
    $PackageSucceeded = $false
    Push-Location $LocalLauncher
    try {
        if (Test-Path (Join-Path $LocalLauncher 'package-lock.json')) {
            & npm.cmd ci --no-audit --no-fund
        } else {
            & npm.cmd install --no-audit --no-fund
        }
        Assert-LastCommand 'Instrumenta packaging dependency setup'
        & node.exe (Join-Path $LocalLauncher 'scripts\package-windows.cjs')
        Assert-LastCommand 'Instrumenta packaging'
        $ReleaseSource = Join-Path $LocalLauncher 'release'
        $ReleaseDestination = Join-Path $LauncherRoot 'release'
        $ReleaseNext = Join-Path $LauncherRoot 'release.next'
        $ReleasePrevious = Join-Path $LauncherRoot 'release.previous'
        $Version = (Get-Content -LiteralPath $PackageFile -Raw | ConvertFrom-Json).version
        $Expected = @(
            (Join-Path $ReleaseSource "Instrumenta-Setup-$Version.exe"),
            (Join-Path $ReleaseSource "Instrumenta-Portable-$Version.exe")
        )
        foreach ($Artifact in $Expected) {
            if (-not (Test-Path $Artifact)) { throw "Packaging did not produce $Artifact" }
        }

        # Publish only after both applications exist. This prevents a failed
        # rebuild from replacing the last complete release with half a package.
        Remove-Item -LiteralPath $ReleaseNext -Recurse -Force -ErrorAction SilentlyContinue
        Remove-Item -LiteralPath $ReleasePrevious -Recurse -Force -ErrorAction SilentlyContinue
        New-Item -ItemType Directory -Path $ReleaseNext -Force | Out-Null
        Copy-Item -LiteralPath $Expected -Destination $ReleaseNext -Force
        & node.exe (Join-Path $LauncherRoot 'scripts\release-manifest.cjs') create $ReleaseNext $Version
        Assert-LastCommand 'Instrumenta release manifest'
        & node.exe (Join-Path $LauncherRoot 'scripts\instrumenta-release.cjs') --product instrumenta --version $Version --strategy launcher --minimum 0.10.0 --installer (Join-Path $ReleaseNext "Instrumenta-Setup-$Version.exe") --out (Join-Path $ReleaseNext 'instrumenta-release.json')
        Assert-LastCommand 'Instrumenta self-update manifest'
        try {
            if (Test-Path $ReleaseDestination) {
                Move-Item -LiteralPath $ReleaseDestination -Destination $ReleasePrevious
            }
            Move-Item -LiteralPath $ReleaseNext -Destination $ReleaseDestination
            Remove-Item -LiteralPath $ReleasePrevious -Recurse -Force -ErrorAction SilentlyContinue
        } catch {
            if (-not (Test-Path $ReleaseDestination) -and (Test-Path $ReleasePrevious)) {
                Move-Item -LiteralPath $ReleasePrevious -Destination $ReleaseDestination
            }
            throw
        }
        $PackageSucceeded = $true
    } finally {
        Pop-Location
        # Failed package workspaces are useful forensic evidence. A successful
        # package has already been published atomically, so its dependency-heavy
        # local mirror is disposable and should not accumulate between releases.
        if ($PackageSucceeded -and (Test-Path $PackageWorkspace)) {
            Remove-Item -LiteralPath $PackageWorkspace -Recurse -Force
        }
    }
}

function Test-Launcher {
    Require-Node
    Write-Stage 'Verifying the Instrumenta workspace...'
    & node.exe (Join-Path $LauncherRoot 'scripts\workspace-manager.cjs') verify
    Assert-LastCommand 'Instrumenta verification'
}

function Resolve-PreparationTarget([string]$DefaultTarget) {
    $Selected = if ($Target -eq 'default') { $DefaultTarget } else { $Target }
    $CatalogFile = Join-Path $LauncherRoot 'products\catalog.json'
    $Ids = @()
    if (Test-Path $CatalogFile) {
        $Ids = @((Get-Content -LiteralPath $CatalogFile -Raw | ConvertFrom-Json).products | ForEach-Object { $_.id })
    }
    if ($Selected -notin @('all', 'web', 'launcher', 'ai') -and $Selected -notin $Ids) {
        throw "Unknown Instrumenta target '$Selected'. Registered products: $($Ids -join ', ')."
    }
    return $Selected
}

function Prepare-SelectedWorkspace([string]$DefaultTarget, [bool]$InstallAi = $false) {
    $Selected = Resolve-PreparationTarget $DefaultTarget
    Assert-PackageIcons
    if ($Selected -eq 'launcher') {
        Install-LauncherDependencies
        return
    }
    Prepare-Workspace $Selected $InstallAi
}

function Write-DoctorLine([string]$Name, [bool]$Ready, [string]$Detail) {
    $Label = if ($Ready) { 'OK ' } else { 'FIX' }
    $Colour = if ($Ready) { 'Green' } else { 'Yellow' }
    Write-Host ('  {0}  {1,-18} {2}' -f $Label, $Name, $Detail) -ForegroundColor $Colour
}

function Write-DoctorInfo([string]$Name, [string]$Detail) {
    Write-Host ('  --   {0,-18} {1}' -f $Name, $Detail) -ForegroundColor DarkGray
}

function Show-Doctor {
    Write-Stage 'Instrumenta workspace doctor (read-only)'
    $WorkspaceRoot = Split-Path -Parent $LauncherRoot
    $SourceDirectories = @(Get-CatalogSourceDirectories)
    $PresentCheckouts = @($SourceDirectories | Where-Object { Test-Path (Join-Path $LauncherRoot $_) }).Count
    Write-DoctorLine 'workspace' ($PresentCheckouts -gt 0) "$WorkspaceRoot ($PresentCheckouts of $($SourceDirectories.Count) product checkouts)"

    $Node = Get-Command 'node.exe' -ErrorAction SilentlyContinue
    $Npm = Get-Command 'npm.cmd' -ErrorAction SilentlyContinue
    Write-DoctorLine 'Node.js' ([bool]$Node) $(if ($Node) { (& node.exe --version) } else { 'install current Node.js LTS for source commands' })
    Write-DoctorLine 'npm' ([bool]$Npm) $(if ($Npm) { $Npm.Source } else { 'installed with Node.js LTS' })
    Write-DoctorLine 'desktop runtime' (Test-Path $ElectronExe) $(if (Test-Path $ElectronExe) { $ElectronExe } else { 'created by setup or the first source launch' })

    $Source = Get-SourceCandidate
    $Installed = Find-InstalledApplication
    $Release = Find-PortablePackage
    $WouldOpen = Select-NewestCandidate @($Source, $Installed, $Release)
    $Running = Get-Process -Name 'Instrumenta' -ErrorAction SilentlyContinue | Select-Object -First 1
    Write-DoctorLine 'source version' $true "$($Source.Version) ($($Source.BuiltAt.ToString('u')))"
    Write-DoctorLine 'installed version' ([bool]$Installed) $(if ($Installed) { "$($Installed.Version) at $($Installed.Path)" } else { 'not installed' })
    Write-DoctorLine 'package version' ([bool]$Release) $(if ($Release) { "$($Release.Version) at $($Release.Path)" } else { 'run Instrumenta.cmd package on Windows' })
    Write-DoctorInfo 'running version' $(if ($Running) { "$($Running.Path)" } else { 'Instrumenta is not currently running' })
    Write-DoctorLine 'would open' ([bool]$WouldOpen) $(if ($WouldOpen) { "$($WouldOpen.Kind) $($WouldOpen.Version)" } else { 'no launch candidate' })

    if ($Node) {
        & node.exe (Join-Path $LauncherRoot 'scripts\workspace-manager.cjs') status
        Assert-LastCommand 'Instrumenta status'
        $IconCheck = & node.exe (Join-Path $LauncherRoot 'scripts\workspace-maintenance.cjs') check-icon 2>&1
        $IconReady = $LASTEXITCODE -eq 0
        Write-DoctorLine 'package icon' $IconReady ($IconCheck -join ' ')

        $AiStatusOutput = $null
        $AiStatusExitCode = 1
        $PreviousErrorPreference = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        try {
            $AiStatusOutput = & node.exe (Join-Path $LauncherRoot 'ai\setup-agent.cjs') status 2>&1
            $AiStatusExitCode = $LASTEXITCODE
        } finally {
            $ErrorActionPreference = $PreviousErrorPreference
        }
        if ($AiStatusExitCode -eq 0) {
            try {
                $AiStatus = ($AiStatusOutput -join "`n") | ConvertFrom-Json
                # Name lookups rather than properties: under StrictMode a server the registry no
                # longer reports would throw instead of reading as not ready.
                $ServerNames = @($AiStatus.servers.PSObject.Properties.Name)
                $McpReady = @(@('ludere') | Where-Object {
                    ($ServerNames -notcontains $_) -or -not [bool]$AiStatus.servers.$_.ready
                }).Count -eq 0
                $SkillsReady = @($AiStatus.skills.PSObject.Properties.Value |
                    Where-Object { -not [bool]$_.ready }).Count -eq 0
                Write-DoctorLine 'AI MCP entrypoints' $McpReady $(if ($McpReady) { 'Ludere is present' } else { 'run Instrumenta.cmd setup ai' })
                Write-DoctorLine 'AI skills' $SkillsReady $(if ($SkillsReady) { 'current Instrumenta skills installed' } else { 'run Instrumenta.cmd setup ai, then restart the agent' })
                Write-DoctorLine 'Codex MCP config' ([bool]$AiStatus.config.ready) $(if ($AiStatus.config.ready) { $AiStatus.config.path } else { 'run Instrumenta.cmd setup ai' })
                if ($McpReady) {
                    $McpSmokeOutput = $null
                    $McpSmokeExitCode = 1
                    $ErrorActionPreference = 'Continue'
                    try {
                        $McpSmokeOutput = & node.exe (Join-Path $LauncherRoot 'ai\mcp-smoke.cjs') 2>&1
                        $McpSmokeExitCode = $LASTEXITCODE
                    } finally {
                        $ErrorActionPreference = $PreviousErrorPreference
                    }
                    if ($McpSmokeExitCode -eq 0) {
                        $McpSmoke = ($McpSmokeOutput -join "`n") | ConvertFrom-Json
                        $McpDetail = @($McpSmoke.results | ForEach-Object { "$($_.app) $($_.toolCount) tools" }) -join ', '
                        Write-DoctorLine 'AI MCP handshake' $true $McpDetail
                    } else {
                        Write-DoctorLine 'AI MCP handshake' $false (($McpSmokeOutput -join ' ') -replace '\s+', ' ')
                    }
                }
            } catch {
                Write-DoctorLine 'AI integration' $false 'status output was not valid; run Instrumenta.cmd setup ai'
            }
        } else {
            Write-DoctorLine 'AI integration' $false 'run Instrumenta.cmd setup ai'
        }
        if ($Release) {
            $ReleaseDirectory = Split-Path -Parent $Release.Path
            $ManifestFile = Join-Path $ReleaseDirectory 'release-manifest.json'
            if (Test-Path $ManifestFile) {
                $PreviousErrorPreference = $ErrorActionPreference
                $ErrorActionPreference = 'Continue'
                try {
                    $ReleaseCheck = & node.exe (Join-Path $LauncherRoot 'scripts\release-manifest.cjs') verify $ReleaseDirectory 2>&1
                    $ReleaseReady = $LASTEXITCODE -eq 0
                } finally {
                    $ErrorActionPreference = $PreviousErrorPreference
                }
                Write-DoctorLine 'release hashes' $ReleaseReady ($ReleaseCheck -join ' ')
            } else {
                Write-DoctorLine 'release hashes' $false 'release manifest missing; run Instrumenta.cmd package'
            }
            $Signature = Get-AuthenticodeSignature -LiteralPath $Release.Path
            Write-DoctorLine 'code signing' ($Signature.Status -eq 'Valid') $(if ($Signature.Status -eq 'Valid') { $Signature.SignerCertificate.Subject } else { 'unsigned; signing certificate is required for public release' })
        }
    } else {
        Write-DoctorLine 'application status' $false 'Node.js is required to inspect source builds'
        Write-DoctorLine 'package icon' $false 'Node.js is required to compare generated artwork'
    }

    Write-Host "`n  Doctor changes nothing. FIX items identify the next action or unresolved release gate." -ForegroundColor DarkGray
}

function Show-Help {
    Write-Host @'

Instrumenta desktop command

  .\Instrumenta.cmd            Open Instrumenta
  .\Instrumenta.cmd setup      Prepare launcher, Ludere, and AI tools once
  .\Instrumenta.cmd update     Refresh Ludere after source changes
  .\Instrumenta.cmd build      Build every application that is prepared from source
  .\Instrumenta.cmd test       Run the launcher tests and the source-suite checks
  .\Instrumenta.cmd package    Fresh-build installer + portable .exe
  .\Instrumenta.cmd install    Fresh-build and open the Windows installer
  .\Instrumenta.cmd doctor     Read-only toolchain, build, icon, and package checks
  .\Instrumenta.cmd clean      Remove only regenerable build/package/cache state
  .\Instrumenta.cmd help       Show this help

setup, update, and build accept: all, web, a registered product ID, launcher, or ai.
For example:  .\Instrumenta.cmd setup ai

Everyday use is through Instrumenta.cmd or the installed Start menu shortcut.
The packaged app has no npm or Node.js runtime requirement.
'@
}

switch ($Mode) {
    'run' { Open-Instrumenta }
    'open' { Open-Instrumenta }
    'setup' {
        if ((Resolve-PreparationTarget 'web') -ne 'ai') { Install-LauncherDependencies }
        Prepare-SelectedWorkspace 'web' ($Target -eq 'default' -or $Target -eq 'ai')
        Write-Host "`n  Instrumenta setup is complete for $(Resolve-PreparationTarget 'web')." -ForegroundColor Green
    }
    'update' {
        Prepare-SelectedWorkspace 'web' ($Target -eq 'default' -or $Target -eq 'ai')
    }
    'install' {
        Write-Stage 'Building and installing the current Instrumenta release...'
        Build-Packages
        $Installer = Get-ChildItem -Path (Join-Path $LauncherRoot 'release') `
            -Filter 'Instrumenta-Setup-*.exe' -File |
            Sort-Object LastWriteTime -Descending |
            Select-Object -First 1
        if (-not $Installer) { throw 'The Instrumenta installer was not produced.' }
        Start-Process -FilePath $Installer.FullName -Wait
        $Version = (Get-Content -LiteralPath $PackageFile -Raw | ConvertFrom-Json).version
        $InstalledPath = Assert-InstalledRelease $Version
        Confirm-CleanupObsoleteCopies (Find-ObsoleteInstalledCopies $InstalledPath ([version]$Version))
        Save-LocalWorkspacePreference
        Write-Host "`n  Instrumenta $Version is installed and verified." -ForegroundColor Green
        Write-Host "  $InstalledPath" -ForegroundColor DarkGray
    }
    'package' { Build-Packages }
    'build' { Prepare-SelectedWorkspace 'all' }
    'test' { Test-Launcher }
    'doctor' { Show-Doctor }
    'status' { Show-Doctor }
    'clean' { Invoke-Maintenance 'clean' }
    'help' { Show-Help }
}
