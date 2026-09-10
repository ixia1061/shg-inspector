<#
.SYNOPSIS
    소화기 점검 시스템 바탕화면/시작 메뉴 바로가기 아이콘을 투명 소화기 그림으로 통일한다.

.DESCRIPTION
    PWA "앱으로 설치"로 만든 바로가기는 매니페스트 아이콘(과거 흰 배경)을 쓰고,
    브라우저 즐겨찾기로 만든 것은 favicon(투명)을 써서 PC마다 아이콘 배경이 달라 보인다.
    이 스크립트는 shg-inspector 를 가리키는 .url / .lnk 바로가기를 모두 찾아
    투명 배경 extinguisher.ico 를 아이콘으로 지정한다.

    아이콘 파일이 없으면 배포본(https://shg-inspector.vercel.app/extinguisher.ico)에서
    %LOCALAPPDATA%\shg-inspector\extinguisher.ico 로 내려받는다. 어느 PC에서나 실행 가능.

.NOTES
    - 이미 설치한 PWA 앱 자체의 아이콘은 이 스크립트로 못 바꾼다(브라우저가 관리).
      앱을 삭제 후 재설치하면 새 투명 아이콘이 적용된다.
    - 실행 후 바탕화면에서 F5. 그래도 안 바뀌면 로그아웃/재부팅으로 아이콘 캐시를 비운다.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\set-shortcut-icon.ps1
#>

$ErrorActionPreference = 'Continue'

$appUrlHost = 'shg-inspector'
$iconUrl    = 'https://shg-inspector.vercel.app/extinguisher.ico'
$icon       = Join-Path $env:LOCALAPPDATA 'shg-inspector\extinguisher.ico'

if (-not (Test-Path $icon)) {
    New-Item -ItemType Directory -Force -Path (Split-Path $icon) | Out-Null
    Write-Host "아이콘 내려받는 중: $iconUrl"
    Invoke-WebRequest -Uri $iconUrl -OutFile $icon
}

$dirs = @()
$dirs += [Environment]::GetFolderPath('Desktop')
$dirs += [Environment]::GetFolderPath('CommonDesktopDirectory')
$dirs += Join-Path $env:APPDATA     'Microsoft\Windows\Start Menu\Programs'
$dirs += Join-Path $env:ProgramData 'Microsoft\Windows\Start Menu\Programs'
$dirs = $dirs | Where-Object { $_ -and (Test-Path $_) } | Select-Object -Unique

$sh   = New-Object -ComObject WScript.Shell
$done = 0

foreach ($dir in $dirs) {
    # 인터넷 바로가기(.url)
    Get-ChildItem -Path $dir -Recurse -Filter *.url -ErrorAction SilentlyContinue | ForEach-Object {
        $f = $_.FullName
        if ((Get-Content $f -Raw) -match $appUrlHost) {
            $lines  = @(Get-Content $f | Where-Object { $_ -notmatch '^(IconFile|IconIndex)=' })
            $lines += "IconFile=$icon"
            $lines += 'IconIndex=0'
            Set-Content -Path $f -Value $lines -Encoding ASCII
            Write-Host "[url] $($_.Name)"
            $done++
        }
    }
    # 일반/PWA 앱 바로가기(.lnk)
    Get-ChildItem -Path $dir -Recurse -Filter *.lnk -ErrorAction SilentlyContinue | ForEach-Object {
        $lnk = $sh.CreateShortcut($_.FullName)
        if ("$($lnk.TargetPath) $($lnk.Arguments)" -match $appUrlHost) {
            $lnk.IconLocation = "$icon,0"
            $lnk.Save()
            Write-Host "[lnk] $($_.Name)"
            $done++
        }
    }
}

# 아이콘 캐시 새로고침
& ie4uinit.exe -show 2>$null

Write-Host ""
Write-Host "완료: $done 개 바로가기 처리. 바탕화면에서 F5 를 누르세요."
