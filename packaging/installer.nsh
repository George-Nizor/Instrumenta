; Instrumenta uses one stable per-user app ID. electron-builder will replace the
; existing installation during an upgrade; this prompt makes that behavior
; explicit and gives a user a safe cancel point. App data is intentionally kept.
!macro customInit
  ; /S is an explicit automation contract. Keep the confirmation for people
  ; running the installer interactively, but never hide a blocking modal in a
  ; silent Instrumenta update.
  IfSilent instrumenta_upgrade_check_done
  ${If} ${FileExists} "$LOCALAPPDATA\Programs\instrumenta-launcher\Instrumenta.exe"
    MessageBox MB_YESNO|MB_ICONQUESTION "An older Instrumenta installation was found. Continue and replace it with Instrumenta ${VERSION}? Your settings and documents will be preserved." IDYES +2
    Abort
  ${EndIf}
  ${If} ${FileExists} "$LOCALAPPDATA\Programs\Instrumenta\Instrumenta.exe"
    MessageBox MB_YESNO|MB_ICONQUESTION "An older Instrumenta installation was found. Continue and replace it with Instrumenta ${VERSION}? Your settings and documents will be preserved." IDYES +2
    Abort
  ${EndIf}
instrumenta_upgrade_check_done:
!macroend

; electron-builder's installer leaves a copy of itself in
; %LOCALAPPDATA%\instrumenta-launcher-updater for electron-updater's differential
; downloads. Instrumenta updates itself (electron/self-update.cjs, from its own
; download cache) and never reads it: 200 MB left behind by every install and
; every update. customInstall runs after the copy is made.
!macro customInstall
  !ifdef APP_INSTALLER_STORE_FILE
    Delete "$LOCALAPPDATA\${APP_INSTALLER_STORE_FILE}"
  !endif
  RMDir "$LOCALAPPDATA\instrumenta-launcher-updater"
!macroend

!macro customUnInstall
  Delete "$LOCALAPPDATA\instrumenta-launcher-updater\installer.exe"
  RMDir "$LOCALAPPDATA\instrumenta-launcher-updater"
!macroend
